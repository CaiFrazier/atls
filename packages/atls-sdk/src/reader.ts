/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { open, type Entry, type ZipFile } from "yauzl";
import { Readable } from "stream";
import { decompress } from "@mongodb-js/zstd";
import type { AtlasManifest, AtlasSummary, DatasetName } from "./types.js";

/**
 * Iterate over all JSONL records in a dataset directory
 * (for example: page_metadata, navigation, assets).
 */
export interface IterateDatasetOptions {
  signal?: AbortSignal;
  zipHandle?: ZipHandle;
}

function assertAtlasPath(atlsPath: string): void {
  if (typeof atlsPath !== "string" || atlsPath.trim().length === 0) {
    throw new Error("Atlas path must be a non-empty string.");
  }
  if (!atlsPath.toLowerCase().endsWith(".atls")) {
    throw new Error(`Atlas path must end with ".atls": ${atlsPath}`);
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Operation aborted.");
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

async function readStreamToBuffer(readStream: Readable, signal?: AbortSignal): Promise<Buffer> {
  checkAbort(signal);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    const cleanup = () => {
      readStream.removeListener("data", onData);
      readStream.removeListener("end", onEnd);
      readStream.removeListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new Error("Operation aborted."));
    };

    const onData = (chunk: Buffer | string) => {
      try {
        checkAbort(signal);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
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

async function* streamUtf8Lines(readStream: Readable, signal?: AbortSignal): AsyncIterable<string> {
  let carry = "";
  for await (const chunk of readStream) {
    checkAbort(signal);
    carry += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : Buffer.from(chunk).toString("utf-8");

    let newlineIndex = carry.indexOf("\n");
    while (newlineIndex >= 0) {
      checkAbort(signal);
      const line = carry.slice(0, newlineIndex);
      carry = carry.slice(newlineIndex + 1);
      if (line.trim().length > 0) {
        yield line;
      }
      newlineIndex = carry.indexOf("\n");
    }
  }

  if (carry.trim().length > 0) {
    checkAbort(signal);
    yield carry;
  }
}

function* bufferLines(payload: Buffer): Iterable<string> {
  let lineStart = 0;
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === 0x0a) {
      const line = payload.toString("utf-8", lineStart, i);
      if (line.trim().length > 0) {
        yield line;
      }
      lineStart = i + 1;
    }
  }

  if (lineStart < payload.length) {
    const tail = payload.toString("utf-8", lineStart);
    if (tail.trim().length > 0) {
      yield tail;
    }
  }
}

export class ZipHandle {
  private readonly entries = new Map<string, Entry>();
  private closed = false;

  private constructor(
    private readonly atlsPath: string,
    private readonly zipfile: ZipFile
  ) {}

  static async open(atlsPath: string): Promise<ZipHandle> {
    assertAtlasPath(atlsPath);
    const zipfile = await openZipFile(atlsPath);
    const handle = new ZipHandle(atlsPath, zipfile);
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
        this.entries.set(entry.fileName, entry);
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
        this.zipfile.removeListener("entry", onEntry);
        this.zipfile.removeListener("end", onEnd);
        this.zipfile.removeListener("error", onError as (error: Error) => void);
      };

      this.zipfile.on("entry", onEntry);
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

  async readEntryBuffer(fileName: string, signal?: AbortSignal): Promise<Buffer> {
    const readStream = await this.openEntryStream(fileName, signal);
    return readStreamToBuffer(readStream, signal);
  }

  async openEntryStream(fileName: string, signal?: AbortSignal): Promise<Readable> {
    this.ensureOpen();
    checkAbort(signal);

    const entry = this.entries.get(fileName);
    if (!entry) {
      throw new Error(`${fileName} not found in archive`);
    }

    // BUG-0110/BUG-0111: stream directly from the already-open zipfile using the
    // entry indexed at open time. Previously every read reopened the archive from
    // disk and linear-scanned its entries (O(K×E)), and openEntryStream buffered
    // the whole entry before wrapping it in Readable.from([payload]).
    return openEntryReadStream(this.zipfile, entry);
  }

  async readJson(fileName: string, signal?: AbortSignal): Promise<unknown> {
    const buffer = await this.readEntryBuffer(fileName, signal);
    return JSON.parse(buffer.toString("utf-8"));
  }
}

export async function openZipHandle(atlsPath: string): Promise<ZipHandle> {
  return ZipHandle.open(atlsPath);
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

  const handle = await openZipHandle(atlsPath);
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
    const readStream = await handle.openEntryStream(fileName, options.signal);
    yield* streamUtf8Lines(readStream, options.signal);
    return;
  }

  // .zst parts: @mongodb-js/zstd exposes only a buffer-based decompress, so the
  // compressed part is read in full and decompressed in memory. Peak memory is
  // one part's compressed+decompressed size; a streaming zstd codec would be
  // needed to bound it further (tracked separately — would raise the Node floor).
  const compressed = await handle.readEntryBuffer(fileName, options.signal);
  checkAbort(options.signal);

  let payload: Buffer;
  try {
    payload = Buffer.from(await decompress(compressed));
  } catch (err) {
    throw new Error(`Failed to decompress part ${fileName}: ${String(err)}`);
  }

  for (const line of bufferLines(payload)) {
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

  const handle = await openZipHandle(atlsPath);
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
export async function readManifest(atlsPath: string): Promise<AtlasManifest>;
export async function readManifest(handle: ZipHandle): Promise<AtlasManifest>;
export async function readManifest(target: string | ZipHandle): Promise<AtlasManifest> {
  const raw = typeof target === "string"
    ? await withOwnedZipHandle(target, {}, (handle) => handle.readJson("manifest.json"))
    : await target.readJson("manifest.json");

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Invalid manifest: expected object`);
  }
  return raw as AtlasManifest;
}

/**
 * Read summary.json from .atls archive.
 */
export async function readSummary(atlsPath: string): Promise<AtlasSummary>;
export async function readSummary(handle: ZipHandle): Promise<AtlasSummary>;
export async function readSummary(target: string | ZipHandle): Promise<AtlasSummary> {
  const raw = typeof target === "string"
    ? await withOwnedZipHandle(target, {}, (handle) => handle.readJson("summary.json"))
    : await target.readJson("summary.json");

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Invalid summary: expected object`);
  }
  return raw as AtlasSummary;
}

/**
 * Read and decompress a blob referenced by body_blob_ref or media refs.
 */
export async function readBlob(atlsPath: string, blobRef: string): Promise<Buffer>;
export async function readBlob(handle: ZipHandle, blobRef: string): Promise<Buffer>;
export async function readBlob(target: string | ZipHandle, blobRef: string): Promise<Buffer> {
  if (typeof blobRef !== "string" || blobRef.trim().length === 0) {
    throw new Error("Blob ref must be a non-empty string.");
  }

  const blobPath = normalizeBlobPath(blobRef);
  const compressed = typeof target === "string"
    ? await withOwnedZipHandle(target, {}, (handle) => handle.readEntryBuffer(blobPath))
    : await target.readEntryBuffer(blobPath);

  try {
    return Buffer.from(await decompress(compressed));
  } catch (err) {
    throw new Error(`Failed to decompress blob ${blobPath}: ${String(err)}`);
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
  assertAtlasPath(atlsPath);
  checkAbort(options.signal);

  const provided = options.zipHandle;
  if (provided) {
    const partFiles = provided.listPartFiles(dataset);
    for (const partFile of partFiles) {
      checkAbort(options.signal);
      yield* streamPartFile(provided, partFile, options);
    }
    return;
  }

  const handle = await openZipHandle(atlsPath);
  try {
    const partFiles = handle.listPartFiles(dataset);
    for (const partFile of partFiles) {
      checkAbort(options.signal);
      yield* streamPartFile(handle, partFile, options);
    }
  } finally {
    handle.close();
  }
}
