/*
 * Copyright 2026 Cai Frazier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { open, type Entry, type ZipFile } from "yauzl";
import { Readable, Transform } from "stream";
import { Decompress } from "fzstd";
import type { AtlasManifest, AtlasSummary, DatasetName } from "./types.js";

const MiB = 1024 * 1024;

export interface AtlasReadLimits {
  maxEntries: number;
  maxZipEntryBytes: number;
  maxJsonRootBytes: number;
  maxPartCompressedBytes: number;
  maxPartDecompressedBytes: number;
  maxBlobCompressedBytes: number;
  maxBlobDecompressedBytes: number;
  maxJsonlLineBytes: number;
}

export const DEFAULT_ATLAS_READ_LIMITS: AtlasReadLimits = {
  maxEntries: 100_000,
  maxZipEntryBytes: 256 * MiB,
  maxJsonRootBytes: 16 * MiB,
  maxPartCompressedBytes: 256 * MiB,
  maxPartDecompressedBytes: 512 * MiB,
  maxBlobCompressedBytes: 256 * MiB,
  maxBlobDecompressedBytes: 256 * MiB,
  maxJsonlLineBytes: 64 * MiB,
};

export interface AtlasReadOptions {
  limits?: Partial<AtlasReadLimits>;
}

export class AtlasResourceLimitError extends Error {
  readonly code = "ATLAS_RESOURCE_LIMIT";

  constructor(
    readonly resource: string,
    readonly limit: number,
    readonly actual?: number
  ) {
    super(
      actual === undefined
        ? `${resource} exceeded Atlas read limit of ${limit} bytes`
        : `${resource} exceeded Atlas read limit of ${limit} bytes (actual ${actual} bytes)`
    );
    this.name = "AtlasResourceLimitError";
  }
}

export class AtlasDuplicateEntryError extends Error {
  readonly code = "ATLAS_DUPLICATE_ENTRY";

  constructor(readonly fileName: string) {
    super(`Duplicate ZIP entry in Atlas archive: ${fileName}`);
    this.name = "AtlasDuplicateEntryError";
  }
}

export class AtlasInvalidEntryNameError extends Error {
  readonly code = "ATLAS_INVALID_ENTRY_NAME";

  constructor(readonly fileName: string) {
    super(`Invalid ZIP entry name in Atlas archive: ${fileName}`);
    this.name = "AtlasInvalidEntryNameError";
  }
}

/**
 * Error thrown when a malformed record is encountered in strict mode.
 *
 * Defined here (rather than in index.ts, its original home) so reader.ts's
 * own readJson()/dataset iteration helpers can throw it directly without
 * creating an index.ts <-> reader.ts import cycle. Re-exported from index.ts
 * for backward compatibility.
 */
export class MalformedRecordError extends Error {
  readonly dataset: string;
  readonly reason: string;
  constructor(dataset: string, reason: string) {
    super(`Malformed ${dataset} record: ${reason}`);
    this.name = 'MalformedRecordError';
    this.dataset = dataset;
    this.reason = reason;
  }
}

// BUG-0229: typed errors for the previously stringly-typed `throw new Error(...)` sites in the
// read path, so consumers can branch on a stable `.code` instead of matching message substrings.
// Messages are kept byte-identical to the pre-existing throws for backward compatibility.

/** Invalid archive path or blob ref passed to a reader entry point. */
export class AtlasPathError extends Error {
  readonly code = "ATLAS_INVALID_PATH";
  constructor(message: string) {
    super(message);
    this.name = "AtlasPathError";
  }
}

/** A read was cancelled via its AbortSignal. */
export class AtlasAbortError extends Error {
  readonly code = "ATLAS_ABORTED";
  constructor(message = "Operation aborted.") {
    super(message);
    this.name = "AtlasAbortError";
  }
}

/** Zstd decompression of a part/blob/entry failed. */
export class AtlasDecompressionError extends Error {
  readonly code = "ATLAS_DECOMPRESSION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "AtlasDecompressionError";
  }
}

/** A requested entry (part file, blob, etc.) is not present in the archive. */
export class AtlasEntryNotFoundError extends Error {
  readonly code = "ATLAS_ENTRY_NOT_FOUND";
  constructor(readonly fileName: string) {
    super(`${fileName} not found in archive`);
    this.name = "AtlasEntryNotFoundError";
  }
}

/**
 * Iterate over all JSONL records in a dataset directory
 * (for example: page_metadata, navigation, assets).
 */
export interface IterateDatasetOptions {
  signal?: AbortSignal;
  zipHandle?: ZipHandle;
  limits?: Partial<AtlasReadLimits>;
}

function resolveLimits(limits?: Partial<AtlasReadLimits>): AtlasReadLimits {
  const merged = { ...DEFAULT_ATLAS_READ_LIMITS, ...(limits ?? {}) };
  for (const [key, value] of Object.entries(merged) as Array<[keyof AtlasReadLimits, number]>) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Atlas read limit ${key} must be a positive finite number.`);
    }
  }
  return merged;
}

function assertAtlasPath(atlsPath: string): void {
  if (typeof atlsPath !== "string" || atlsPath.trim().length === 0) {
    throw new AtlasPathError("Atlas path must be a non-empty string.");
  }
  if (!atlsPath.toLowerCase().endsWith(".atls")) {
    throw new AtlasPathError(`Atlas path must end with ".atls": ${atlsPath}`);
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AtlasAbortError();
  }
}

function openZipFile(atlsPath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    open(atlsPath, { lazyEntries: false, autoClose: false }, (err: Error | null, zipfile?: ZipFile) => {
      if (err || !zipfile) {
        reject(err || new Error("Failed to open ZIP"));
        return;
      }
      resolve(zipfile);
    });
  });
}

function openEntryReadStream(zipfile: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err: Error | null, readStream?: Readable) => {
      if (err || !readStream) {
        reject(err || new Error("Failed to open stream"));
        return;
      }
      resolve(readStream);
    });
  });
}

function validateEntryName(fileName: string): void {
  if (
    fileName.length === 0 ||
    fileName.startsWith("/") ||
    fileName.startsWith("\\") ||
    fileName.includes("..") ||
    fileName.includes("\\") ||
    /[\x00-\x1f\x7f]/.test(fileName)
  ) {
    throw new AtlasInvalidEntryNameError(fileName);
  }
}

function assertKnownSizeWithinLimit(resource: string, value: number | undefined, limit: number): void {
  if (typeof value === "number" && Number.isFinite(value) && value > limit) {
    throw new AtlasResourceLimitError(resource, limit, value);
  }
}

function limitStreamBytes(readStream: Readable, resource: string, maxBytes: number, signal?: AbortSignal): Readable {
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      try {
        checkAbort(signal);
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
          callback(new AtlasResourceLimitError(resource, maxBytes, total));
          readStream.destroy();
          return;
        }
        callback(null, buffer);
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });
  return readStream.pipe(limiter);
}

async function readStreamToBuffer(
  readStream: Readable,
  resource: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Buffer> {
  checkAbort(signal);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    const cleanup = () => {
      readStream.removeListener("data", onData);
      readStream.removeListener("end", onEnd);
      readStream.removeListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new AtlasAbortError());
    };

    const onData = (chunk: Buffer | string) => {
      try {
        checkAbort(signal);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        cleanup();
        readStream.destroy();
        reject(new AtlasResourceLimitError(resource, maxBytes, total));
        return;
      }
      chunks.push(buffer);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, total));
    };

    const onError = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    readStream.on("data", onData);
    readStream.on("end", onEnd);
    readStream.on("error", onError);
    signal?.addEventListener("abort", onAbort);
  });
}

function assertJsonlLineWithinLimit(line: string, maxBytes: number, resource: string): void {
  const bytes = Buffer.byteLength(line, "utf-8");
  if (bytes > maxBytes) {
    throw new AtlasResourceLimitError(`${resource} JSONL line`, maxBytes, bytes);
  }
}

async function* streamUtf8Lines(
  readStream: Readable,
  signal: AbortSignal | undefined,
  maxLineBytes: number,
  resource: string
): AsyncIterable<string> {
  let carry = "";
  for await (const chunk of readStream) {
    checkAbort(signal);
    carry += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : Buffer.from(chunk).toString("utf-8");
    assertJsonlLineWithinLimit(carry, maxLineBytes, resource);

    let newlineIndex = carry.indexOf("\n");
    while (newlineIndex >= 0) {
      checkAbort(signal);
      const line = carry.slice(0, newlineIndex);
      carry = carry.slice(newlineIndex + 1);
      if (line.trim().length > 0) {
        assertJsonlLineWithinLimit(line, maxLineBytes, resource);
        yield line;
      }
      newlineIndex = carry.indexOf("\n");
    }
  }

  if (carry.trim().length > 0) {
    checkAbort(signal);
    assertJsonlLineWithinLimit(carry, maxLineBytes, resource);
    yield carry;
  }
}

function* bufferLines(payload: Buffer, maxLineBytes: number, resource: string): Iterable<string> {
  let lineStart = 0;
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === 0x0a) {
      const line = payload.toString("utf-8", lineStart, i);
      if (line.trim().length > 0) {
        assertJsonlLineWithinLimit(line, maxLineBytes, resource);
        yield line;
      }
      lineStart = i + 1;
    }
  }

  if (lineStart < payload.length) {
    const tail = payload.toString("utf-8", lineStart);
    if (tail.trim().length > 0) {
      assertJsonlLineWithinLimit(tail, maxLineBytes, resource);
      yield tail;
    }
  }
}

export function decompressZstdBuffer(
  compressed: Buffer,
  options: {
    resource: string;
    maxBytes: number;
    signal?: AbortSignal;
  }
): Buffer {
  const { resource, maxBytes, signal } = options;
  checkAbort(signal);
  const chunks: Buffer[] = [];
  let total = 0;
  const decoder = new Decompress((chunk) => {
    checkAbort(signal);
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new AtlasResourceLimitError(resource, maxBytes, total);
    }
    chunks.push(buffer);
  });

  try {
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < compressed.length; offset += chunkSize) {
      checkAbort(signal);
      const end = Math.min(offset + chunkSize, compressed.length);
      decoder.push(compressed.subarray(offset, end), end === compressed.length);
    }
    if (compressed.length === 0) {
      decoder.push(new Uint8Array(0), true);
    }
  } catch (err) {
    if (err instanceof AtlasResourceLimitError) {
      throw err;
    }
    throw new AtlasDecompressionError(`Failed to decompress ${resource}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return Buffer.concat(chunks, total);
}

export class ZipHandle {
  private readonly entries = new Map<string, Entry>();
  private closed = false;

  private constructor(
    private readonly atlsPath: string,
    private readonly zipfile: ZipFile,
    readonly limits: AtlasReadLimits
  ) {}

  static async open(atlsPath: string, options: AtlasReadOptions = {}): Promise<ZipHandle> {
    assertAtlasPath(atlsPath);
    const zipfile = await openZipFile(atlsPath);
    const handle = new ZipHandle(atlsPath, zipfile, resolveLimits(options.limits));
    try {
      await handle.indexEntries();
    } catch (err) {
      // BUG-0073: the zipfile is opened with autoClose:false, so a failed index
      // pass (e.g. corrupt central directory) would otherwise leak its file
      // descriptor. Close it before propagating the error.
      try {
        zipfile.close();
      } catch {
        // ignore close errors
      }
      throw err;
    }
    return handle;
  }

  private async indexEntries(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const onEntry = (entry: Entry) => {
        validateEntryName(entry.fileName);
        if (this.entries.size >= this.limits.maxEntries) {
          throw new AtlasResourceLimitError("ZIP entry count", this.limits.maxEntries, this.entries.size + 1);
        }
        if (this.entries.has(entry.fileName)) {
          throw new AtlasDuplicateEntryError(entry.fileName);
        }
        this.entries.set(entry.fileName, entry);
      };
      const onEntryEvent = (entry: Entry) => {
        try {
          onEntry(entry);
        } catch (error) {
          onError(error);
        }
      };

      const onEnd = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onError = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        this.zipfile.removeListener("entry", onEntryEvent);
        this.zipfile.removeListener("end", onEnd);
        this.zipfile.removeListener("error", onError as (error: Error) => void);
      };

      this.zipfile.on("entry", onEntryEvent);
      this.zipfile.on("end", onEnd);
      this.zipfile.on("error", onError as (error: Error) => void);
    });
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error("ZIP handle is closed.");
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      this.zipfile.close();
    } catch {
      // ignore close errors
    }
  }

  listPartFiles(subdir: string): string[] {
    this.ensureOpen();
    const prefix = `${subdir}/`;
    const parts: string[] = [];
    for (const fileName of this.entries.keys()) {
      const lower = fileName.toLowerCase();
      const isJsonl = lower.endsWith(".jsonl") || lower.endsWith(".jsonl.zst");
      if (fileName.startsWith(prefix) && isJsonl) {
        parts.push(fileName);
      }
    }
    return parts.sort();
  }

  listEntries(): string[] {
    this.ensureOpen();
    return [...this.entries.keys()].sort();
  }

  async readEntryBuffer(fileName: string, signal?: AbortSignal, maxBytes = this.limits.maxZipEntryBytes): Promise<Buffer> {
    const readStream = await this.openEntryStream(fileName, signal, maxBytes);
    return readStreamToBuffer(readStream, fileName, maxBytes, signal);
  }

  async openEntryStream(fileName: string, signal?: AbortSignal, maxBytes = this.limits.maxZipEntryBytes): Promise<Readable> {
    this.ensureOpen();
    checkAbort(signal);

    const entry = this.entries.get(fileName);
    if (!entry) {
      throw new AtlasEntryNotFoundError(fileName);
    }
    assertKnownSizeWithinLimit(fileName, entry.uncompressedSize, maxBytes);

    // BUG-0110/BUG-0111: stream directly from the already-open zipfile using the
    // entry indexed at open time. Previously every read reopened the archive from
    // disk and linear-scanned its entries (O(K×E)), and openEntryStream buffered
    // the whole entry before wrapping it in Readable.from([payload]).
    const readStream = await openEntryReadStream(this.zipfile, entry);
    return limitStreamBytes(readStream, fileName, maxBytes, signal);
  }

  async readJson(fileName: string, signal?: AbortSignal): Promise<unknown> {
    const buffer = await this.readEntryBuffer(fileName, signal, this.limits.maxJsonRootBytes);
    try {
      return JSON.parse(buffer.toString("utf-8"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new MalformedRecordError(fileName, `invalid JSON: ${reason}`);
    }
  }
}

export async function openZipHandle(atlsPath: string, options: AtlasReadOptions = {}): Promise<ZipHandle> {
  return ZipHandle.open(atlsPath, options);
}

function normalizeBlobPath(blobRef: string): string {
  const trimmed = blobRef.trim();
  const hasZst = trimmed.toLowerCase().endsWith(".zst");

  if (trimmed.startsWith("blobs/")) {
    return hasZst ? trimmed : `${trimmed}.zst`;
  }

  if (trimmed.startsWith("sha256/")) {
    return hasZst ? `blobs/${trimmed}` : `blobs/${trimmed}.zst`;
  }

  return hasZst ? `blobs/${trimmed}` : `blobs/${trimmed}.zst`;
}

async function withOwnedZipHandle<T>(
  atlsPath: string,
  options: IterateDatasetOptions,
  fn: (handle: ZipHandle) => Promise<T>
): Promise<T> {
  const provided = options.zipHandle;
  if (provided) {
    return fn(provided);
  }

  const handle = await openZipHandle(atlsPath, { limits: options.limits });
  try {
    return await fn(handle);
  } finally {
    handle.close();
  }
}

async function* streamPartFile(
  handle: ZipHandle,
  fileName: string,
  options: IterateDatasetOptions = {}
): AsyncIterable<string> {
  checkAbort(options.signal);

  if (!fileName.toLowerCase().endsWith(".zst")) {
    // BUG-0111: stream uncompressed parts line-by-line with bounded memory
    // instead of buffering the entire part before yielding.
    const readStream = await handle.openEntryStream(fileName, options.signal, handle.limits.maxPartDecompressedBytes);
    yield* streamUtf8Lines(readStream, options.signal, handle.limits.maxJsonlLineBytes, fileName);
    return;
  }

  // .zst parts are decoded with a streaming zstd reader and a hard output cap.
  // The compressed ZIP entry is still buffered, but only after the compressed
  // entry limit has been enforced by readEntryBuffer().
  const compressed = await handle.readEntryBuffer(fileName, options.signal, handle.limits.maxPartCompressedBytes);
  checkAbort(options.signal);

  let payload: Buffer;
  try {
    payload = decompressZstdBuffer(compressed, {
      resource: fileName,
      maxBytes: handle.limits.maxPartDecompressedBytes,
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof AtlasResourceLimitError) {
      throw err;
    }
    throw new AtlasDecompressionError(`Failed to decompress part ${fileName}: ${String(err)}`);
  }

  for (const line of bufferLines(payload, handle.limits.maxJsonlLineBytes, fileName)) {
    checkAbort(options.signal);
    yield line;
  }
}

/**
 * Iterate over all JSONL records in a dataset subdir.
 */
export async function* iterateParts(
  atlsPath: string,
  subdir: DatasetName,
  options: IterateDatasetOptions = {}
): AsyncIterable<string> {
  assertAtlasPath(atlsPath);
  checkAbort(options.signal);
  const provided = options.zipHandle;
  if (provided) {
    const partFiles = provided.listPartFiles(subdir);
    for (const partFile of partFiles) {
      checkAbort(options.signal);
      yield* streamPartFile(provided, partFile, options);
    }
    return;
  }

  const handle = await openZipHandle(atlsPath, { limits: options.limits });
  try {
    const partFiles = handle.listPartFiles(subdir);
    for (const partFile of partFiles) {
      checkAbort(options.signal);
      yield* streamPartFile(handle, partFile, options);
    }
  } finally {
    handle.close();
  }
}

/**
 * Read manifest.json from .atls archive.
 */
export async function readManifest(atlsPath: string, options?: AtlasReadOptions): Promise<AtlasManifest>;
export async function readManifest(handle: ZipHandle): Promise<AtlasManifest>;
export async function readManifest(target: string | ZipHandle, options: AtlasReadOptions = {}): Promise<AtlasManifest> {
  const raw = typeof target === "string"
    ? await withOwnedZipHandle(target, options, (handle) => handle.readJson("manifest.json"))
    : await target.readJson("manifest.json");

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Invalid manifest: expected object`);
  }
  return raw as AtlasManifest;
}

/**
 * Read summary.json from .atls archive.
 */
export async function readSummary(atlsPath: string, options?: AtlasReadOptions): Promise<AtlasSummary>;
export async function readSummary(handle: ZipHandle): Promise<AtlasSummary>;
export async function readSummary(target: string | ZipHandle, options: AtlasReadOptions = {}): Promise<AtlasSummary> {
  const raw = typeof target === "string"
    ? await withOwnedZipHandle(target, options, (handle) => handle.readJson("summary.json"))
    : await target.readJson("summary.json");

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Invalid summary: expected object`);
  }
  return raw as AtlasSummary;
}

/**
 * Read and decompress a blob referenced by body_blob_ref or media refs.
 */
export async function readBlob(atlsPath: string, blobRef: string, options?: AtlasReadOptions): Promise<Buffer>;
export async function readBlob(handle: ZipHandle, blobRef: string): Promise<Buffer>;
export async function readBlob(target: string | ZipHandle, blobRef: string, options: AtlasReadOptions = {}): Promise<Buffer> {
  if (typeof blobRef !== "string" || blobRef.trim().length === 0) {
    throw new AtlasPathError("Blob ref must be a non-empty string.");
  }

  const blobPath = normalizeBlobPath(blobRef);
  const compressed = typeof target === "string"
    ? await withOwnedZipHandle(target, options, (handle) => handle.readEntryBuffer(blobPath, undefined, handle.limits.maxBlobCompressedBytes))
    : await target.readEntryBuffer(blobPath, undefined, target.limits.maxBlobCompressedBytes);

  try {
    const limits = typeof target === "string" ? resolveLimits(options.limits) : target.limits;
    return decompressZstdBuffer(compressed, {
      resource: blobPath,
      maxBytes: limits.maxBlobDecompressedBytes,
    });
  } catch (err) {
    if (err instanceof AtlasResourceLimitError) {
      throw err;
    }
    throw new AtlasDecompressionError(`Failed to decompress blob ${blobPath}: ${String(err)}`);
  }
}

/**
 * Iterate over all records in a dataset.
 */
export async function* iterateDataset(
  atlsPath: string,
  dataset: DatasetName,
  options: IterateDatasetOptions = {}
): AsyncIterable<string> {
  // Thin alias for iterateParts (BUG-0241): both stream a dataset's part files line by line.
  // Kept as a named export for API stability; delegates to avoid the byte-identical duplicate.
  yield* iterateParts(atlsPath, dataset, options);
}
