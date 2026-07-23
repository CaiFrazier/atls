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

/**
 * Manifest-first archive description, part-aware continuation cursors, ordinal
 * record lookup, archived schema retrieval, and bounded blob metadata.
 *
 * Everything here returns PLAIN DATA with JSON-serializable cursors. Nothing
 * accepts callbacks, so these APIs can sit directly behind an IPC boundary
 * (Continuum daemon → renderer) without an in-process predicate crossing it.
 */

import {
  ZipHandle,
  openZipHandle,
  iteratePartLines,
  readManifest,
  readSummary,
  normalizeBlobPath,
  type AtlasReadOptions,
} from "./reader.js";
import type { AtlasManifest, AtlasSummary } from "./types.js";

// Folder aliasing mirrors index.ts (kept in sync by test): newer archives may
// store canonical datasets under shorter folder names.
const NEWER_FORMAT_FOLDER_MAP: Record<string, string> = {
  page_metadata: "pages",
  navigation: "edges",
  pipeline_failures: "failed_pages",
};
const NEWER_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(NEWER_FORMAT_FOLDER_MAP).map(([canonical, alias]) => [alias, canonical]),
);

/**
 * Observed state of one dataset, distinguishing the outcomes the Raw Explorer
 * must never conflate:
 * - `present`   declared by the manifest and parts exist with records
 * - `empty`     declared by the manifest as a valid zero (parts may be empty)
 * - `absent`    declared (or expected) by the manifest but nothing was captured
 * - `partial`   declared with coverage below 100% (truncated capture)
 * - `unexpected` part files exist on disk that the manifest never declared
 * - `corrupt`   the manifest declares parts that are missing from the archive
 */
export type DatasetState = "present" | "empty" | "absent" | "partial" | "unexpected" | "corrupt";

export interface DatasetPartDescription {
  path: string;
  /** ZIP central-directory compressed size. */
  compressedBytes: number;
  /** Stored payload size (still zstd-compressed for `.zst` parts). */
  storedBytes: number;
}

export interface DatasetDescription {
  /** Canonical dataset name (manifest key). */
  name: string;
  /** Physical folder inside this archive (may be a newer-format alias). */
  folder: string;
  state: DatasetState;
  /** Whether the manifest coverage matrix expected this dataset; null when unstated. */
  expected: boolean | null;
  /** Declared record count from manifest/coverage; null when unstated. */
  declaredRecordCount: number | null;
  /** Coverage percentage from the manifest coverage matrix; null when unstated. */
  coveragePct: number | null;
  partCount: number;
  parts: DatasetPartDescription[];
  compressedBytes: number;
  storedBytes: number;
  /** Archive-internal schema entry (fragment stripped); null when undeclared. */
  schemaPath: string | null;
  schemaVersion: string | null;
  schemaHash: string | null;
}

export interface ArchiveDescription {
  atlasVersion: string | null;
  formatVersion: string | null;
  specVersion: string | null;
  schemaVersion: string | null;
  crawlId: string | null;
  mode: string | null;
  generator: string | null;
  createdAt: string | null;
  crawlStartedAt: string | null;
  crawlCompletedAt: string | null;
  crawlConfigHash: string | null;
  configIncluded: boolean | null;
  incomplete: unknown;
  redactionApplied: unknown;
  privacyPolicy: unknown;
  identity: unknown;
  entryCount: number;
  datasets: DatasetDescription[];
  blobs: { count: number; compressedBytes: number; storedBytes: number };
  /** Archived JSON Schema entries under `schemas/`. */
  schemaEntries: string[];
  hasCapabilities: boolean;
  summaryStats: unknown;
}

type DatasetMeta = Record<string, unknown>;

function metaNumber(meta: DatasetMeta | undefined, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = meta?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function metaString(meta: DatasetMeta | undefined, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function stripFragment(path: string | null): string | null {
  if (!path) return null;
  const hash = path.indexOf("#");
  return hash >= 0 ? path.slice(0, hash) : path;
}

interface ManifestDatasetView {
  name: string;
  meta: DatasetMeta | undefined;
  declaredParts: string[];
  expected: boolean | null;
  declaredRecordCount: number | null;
  coveragePct: number | null;
  declaredPresent: boolean | null;
}

function manifestDatasetViews(manifest: AtlasManifest): Map<string, ManifestDatasetView> {
  const views = new Map<string, ManifestDatasetView>();
  const ensure = (name: string): ManifestDatasetView => {
    let view = views.get(name);
    if (!view) {
      view = {
        name,
        meta: undefined,
        declaredParts: [],
        expected: null,
        declaredRecordCount: null,
        coveragePct: null,
        declaredPresent: null,
      };
      views.set(name, view);
    }
    return view;
  };

  const datasets = (manifest.datasets ?? {}) as Record<string, DatasetMeta>;
  for (const [name, meta] of Object.entries(datasets)) {
    const view = ensure(name);
    view.meta = meta;
    view.declaredRecordCount = metaNumber(meta, "recordCount", "record_count");
    const present = meta?.present;
    view.declaredPresent = typeof present === "boolean" ? present : null;
  }

  const partsByDataset = manifest.parts as Record<string, string[]> | undefined;
  if (partsByDataset) {
    for (const [name, parts] of Object.entries(partsByDataset)) {
      if (Array.isArray(parts)) ensure(name).declaredParts = [...parts];
    }
  }

  for (const entry of manifest.coverage?.matrix ?? []) {
    const view = ensure(entry.part);
    if (typeof entry.expected === "boolean") view.expected = entry.expected;
    if (typeof entry.present === "boolean" && view.declaredPresent === null) {
      view.declaredPresent = entry.present;
    }
    const rowCount = entry.rowCount ?? (entry as unknown as { row_count?: number }).row_count;
    if (typeof rowCount === "number" && view.declaredRecordCount === null) {
      view.declaredRecordCount = rowCount;
    }
    const coveragePct = (entry as unknown as { coveragePct?: number }).coveragePct;
    if (typeof coveragePct === "number") view.coveragePct = coveragePct;
  }

  return views;
}

function resolveDatasetFolder(handle: ZipHandle, canonicalName: string): string {
  if (handle.listPartFiles(canonicalName).length > 0) return canonicalName;
  const alias = NEWER_FORMAT_FOLDER_MAP[canonicalName];
  if (alias && handle.listPartFiles(alias).length > 0) return alias;
  return canonicalName;
}

function describeOneDataset(handle: ZipHandle, view: ManifestDatasetView): DatasetDescription {
  const folder = resolveDatasetFolder(handle, view.name);
  const partEntries = handle.listPartEntries(folder);
  const parts: DatasetPartDescription[] = partEntries.map((entry) => ({
    path: entry.fileName,
    compressedBytes: entry.compressedBytes,
    storedBytes: entry.uncompressedBytes,
  }));

  const declaredMissingOnDisk =
    view.declaredParts.length > 0 &&
    view.declaredParts.some((declared) => handle.statEntry(declared) === null);

  let state: DatasetState;
  if (declaredMissingOnDisk) {
    state = "corrupt";
  } else if (view.coveragePct !== null && view.coveragePct < 100) {
    state = "partial";
  } else if (parts.length === 0 && view.declaredParts.length === 0 && view.declaredRecordCount === null) {
    state = view.expected === false ? "absent" : "absent";
  } else if ((view.declaredRecordCount ?? 0) > 0) {
    state = "present";
  } else if (view.declaredRecordCount === 0) {
    state = "empty";
  } else if (parts.length > 0) {
    // Parts exist but the manifest declares no count either way.
    state = "present";
  } else {
    state = "absent";
  }

  return {
    name: view.name,
    folder,
    state,
    expected: view.expected,
    declaredRecordCount: view.declaredRecordCount,
    coveragePct: view.coveragePct,
    partCount: parts.length,
    parts,
    compressedBytes: parts.reduce((sum, p) => sum + p.compressedBytes, 0),
    storedBytes: parts.reduce((sum, p) => sum + p.storedBytes, 0),
    schemaPath: stripFragment(metaString(view.meta, "schema", "schema_uri", "schemaUri")),
    schemaVersion: metaString(view.meta, "schemaVersion", "schema_version"),
    schemaHash: metaString(view.meta, "schemaHash", "schema_hash"),
  };
}

/** Dataset folders that exist on disk but are not declared anywhere in the manifest. */
function undeclaredFolders(handle: ZipHandle, declared: Set<string>): string[] {
  const folders = new Set<string>();
  for (const entry of handle.listEntries()) {
    const lower = entry.toLowerCase();
    if (!lower.endsWith(".jsonl") && !lower.endsWith(".jsonl.zst")) continue;
    const slash = entry.indexOf("/");
    if (slash <= 0) continue;
    const folder = entry.slice(0, slash);
    const canonical = NEWER_TO_CANONICAL[folder] ?? folder;
    if (declared.has(folder) || declared.has(canonical)) continue;
    folders.add(canonical);
  }
  return [...folders].sort();
}

async function withHandle<T>(
  target: string | ZipHandle,
  options: AtlasReadOptions,
  fn: (handle: ZipHandle) => Promise<T>,
): Promise<T> {
  if (typeof target !== "string") return fn(target);
  const handle = await openZipHandle(target, options);
  try {
    return await fn(handle);
  } finally {
    handle.close();
  }
}

/**
 * Describe an archive from its manifest joined with ZIP central-directory
 * facts. No dataset is scanned and no blob is inflated; this is safe to call
 * on archives of any size before deciding what to read.
 */
export async function describeArchive(
  target: string | ZipHandle,
  options: AtlasReadOptions = {},
): Promise<ArchiveDescription> {
  return withHandle(target, options, async (handle) => {
    const manifest = await readManifest(handle);
    let summary: AtlasSummary | null = null;
    try {
      summary = await readSummary(handle);
    } catch {
      summary = null;
    }

    const views = manifestDatasetViews(manifest);
    const datasets = [...views.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((view) => describeOneDataset(handle, view));

    const declaredNames = new Set<string>();
    for (const view of views.values()) {
      declaredNames.add(view.name);
      const alias = NEWER_FORMAT_FOLDER_MAP[view.name];
      if (alias) declaredNames.add(alias);
    }
    for (const folder of undeclaredFolders(handle, declaredNames)) {
      const partEntries = handle.listPartEntries(
        NEWER_FORMAT_FOLDER_MAP[folder] && handle.listPartFiles(folder).length === 0
          ? NEWER_FORMAT_FOLDER_MAP[folder]
          : folder,
      );
      datasets.push({
        name: folder,
        folder,
        state: "unexpected",
        expected: null,
        declaredRecordCount: null,
        coveragePct: null,
        partCount: partEntries.length,
        parts: partEntries.map((entry) => ({
          path: entry.fileName,
          compressedBytes: entry.compressedBytes,
          storedBytes: entry.uncompressedBytes,
        })),
        compressedBytes: partEntries.reduce((sum, p) => sum + p.compressedBytes, 0),
        storedBytes: partEntries.reduce((sum, p) => sum + p.uncompressedBytes, 0),
        schemaPath: null,
        schemaVersion: null,
        schemaHash: null,
      });
    }
    datasets.sort((a, b) => a.name.localeCompare(b.name));

    const blobStats = handle.summarizePrefix("blobs/");
    const m = manifest as unknown as Record<string, unknown>;

    return {
      atlasVersion: typeof m.atlasVersion === "string" ? m.atlasVersion : null,
      formatVersion: typeof m.formatVersion === "string" ? m.formatVersion : null,
      specVersion: typeof m.specVersion === "string" ? m.specVersion : null,
      schemaVersion: typeof m.schemaVersion === "string" ? m.schemaVersion : null,
      crawlId: typeof m.crawlId === "string" ? m.crawlId : null,
      mode: typeof m.mode === "string" ? m.mode : null,
      generator: typeof m.generator === "string" ? m.generator : null,
      createdAt: typeof m.createdAt === "string" ? m.createdAt : null,
      crawlStartedAt: typeof m.crawlStartedAt === "string" ? m.crawlStartedAt : null,
      crawlCompletedAt: typeof m.crawlCompletedAt === "string" ? m.crawlCompletedAt : null,
      crawlConfigHash: typeof m.crawlConfigHash === "string" ? m.crawlConfigHash : null,
      configIncluded: typeof m.configIncluded === "boolean" ? m.configIncluded : null,
      incomplete: m.incomplete ?? null,
      redactionApplied: m.redactionApplied ?? null,
      privacyPolicy: m.privacyPolicy ?? null,
      identity: (summary as Record<string, unknown> | null)?.identity ?? m.identity ?? null,
      entryCount: handle.listEntries().length,
      datasets,
      blobs: {
        count: blobStats.count,
        compressedBytes: blobStats.compressedBytes,
        storedBytes: blobStats.uncompressedBytes,
      },
      schemaEntries: handle.listEntries().filter((name) => name.startsWith("schemas/")).sort(),
      hasCapabilities: handle.statEntry("capabilities.v1.json") !== null,
      summaryStats: (summary as Record<string, unknown> | null)?.stats ?? null,
    };
  });
}

/** Describe one dataset (same shape as the entries in `describeArchive().datasets`). */
export async function describeDataset(
  target: string | ZipHandle,
  dataset: string,
  options: AtlasReadOptions = {},
): Promise<DatasetDescription | null> {
  const description = await describeArchive(target, options);
  return description.datasets.find((d) => d.name === dataset || d.folder === dataset) ?? null;
}

// -- Cursors -----------------------------------------------------------------------------

export interface DatasetSliceRecord {
  /** Global ordinal within the dataset (continuous across slices from ordinal 0). */
  ordinal: number;
  /** Part file the record was read from. */
  part: string;
  /** Index of that part within the dataset's sorted part list (cursor `part` field). */
  partIndex: number;
  /** Zero-based non-empty-line index within that part. */
  lineInPart: number;
  /** The raw JSON line, unparsed. */
  json: string;
}

export interface DatasetSlice {
  records: DatasetSliceRecord[];
  /** Opaque JSON cursor for the next slice; null when the dataset is exhausted. */
  nextCursor: string | null;
}

interface CursorState {
  part: number;
  line: number;
  ordinal: number;
}

function parseCursor(cursor: string | null | undefined): CursorState {
  if (!cursor) return { part: 0, line: 0, ordinal: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(cursor);
  } catch {
    throw new Error(`Invalid dataset cursor: ${cursor}`);
  }
  const c = parsed as Partial<CursorState>;
  if (
    typeof c.part !== "number" || c.part < 0 ||
    typeof c.line !== "number" || c.line < 0 ||
    typeof c.ordinal !== "number" || c.ordinal < 0
  ) {
    throw new Error(`Invalid dataset cursor: ${cursor}`);
  }
  return { part: c.part, line: c.line, ordinal: c.ordinal };
}

export interface ReadDatasetSliceOptions extends AtlasReadOptions {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Read a bounded slice of a dataset with a part-aware continuation cursor.
 * Parts before the cursor's part index are never opened; within the cursor
 * part, lines before the cursor line are skipped without JSON parsing.
 */
export async function readDatasetSlice(
  target: string | ZipHandle,
  dataset: string,
  options: ReadDatasetSliceOptions = {},
): Promise<DatasetSlice> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 10_000));
  const start = parseCursor(options.cursor);

  return withHandle(target, options, async (handle) => {
    const folder = resolveDatasetFolder(handle, dataset);
    const partFiles = handle.listPartFiles(folder);
    const records: DatasetSliceRecord[] = [];
    let ordinal = start.ordinal;

    for (let partIndex = start.part; partIndex < partFiles.length; partIndex += 1) {
      const partFile = partFiles[partIndex];
      let lineIndex = 0;
      const skipTo = partIndex === start.part ? start.line : 0;
      for await (const line of iteratePartLines(handle, partFile, {
        signal: options.signal,
        limits: options.limits,
      })) {
        if (lineIndex >= skipTo) {
          records.push({ ordinal, part: partFile, partIndex, lineInPart: lineIndex, json: line });
          ordinal += 1;
          if (records.length >= limit) {
            return {
              records,
              nextCursor: JSON.stringify({ part: partIndex, line: lineIndex + 1, ordinal }),
            };
          }
        }
        lineIndex += 1;
      }
    }

    return { records, nextCursor: null };
  });
}

// -- Ordinal record lookup ------------------------------------------------------------------

export class AtlasRecordNotFoundError extends Error {
  readonly code = "ATLAS_RECORD_NOT_FOUND";
  constructor(readonly dataset: string, readonly ordinal: number) {
    super(`Record ${ordinal} not found in dataset "${dataset}"`);
    this.name = "AtlasRecordNotFoundError";
  }
}

export interface ReadRecordOptions extends AtlasReadOptions {
  signal?: AbortSignal;
}

/**
 * Read a single record by its global dataset ordinal. Scans parts in order and
 * stops as soon as the ordinal is reached; earlier parts are streamed but never
 * JSON-parsed.
 */
export async function readRecord(
  target: string | ZipHandle,
  dataset: string,
  ordinal: number,
  options: ReadRecordOptions = {},
): Promise<DatasetSliceRecord> {
  if (!Number.isInteger(ordinal) || ordinal < 0) {
    throw new AtlasRecordNotFoundError(dataset, ordinal);
  }
  // Page through with a coarse limit until the ordinal appears. Reuse one
  // handle across pages so path-based callers do not reopen the zip per page.
  return withHandle(target, options, async (handle) => {
    let cursor: string | null = null;
    for (;;) {
      const page: DatasetSlice = await readDatasetSlice(handle, dataset, {
        ...options,
        cursor,
        limit: Math.min(Math.max(ordinal + 1, 256), 10_000),
      });
      for (const record of page.records) {
        if (record.ordinal === ordinal) return record;
      }
      if (!page.nextCursor) throw new AtlasRecordNotFoundError(dataset, ordinal);
      cursor = page.nextCursor;
    }
  });
}

// -- Schemas and blob metadata -----------------------------------------------------------

export interface DatasetSchemaResult {
  path: string;
  schema: unknown;
}

/**
 * Read a dataset's archived JSON Schema. Resolution order: the manifest's
 * dataset schema declaration, then the conventional `schemas/<name>.v1.schema.json`.
 * Returns null when the archive carries no schema for the dataset.
 */
export async function readSchema(
  target: string | ZipHandle,
  dataset: string,
  options: AtlasReadOptions = {},
): Promise<DatasetSchemaResult | null> {
  return withHandle(target, options, async (handle) => {
    const manifest = await readManifest(handle);
    const datasets = (manifest.datasets ?? {}) as Record<string, DatasetMeta>;
    const declared = stripFragment(
      metaString(datasets[dataset], "schema", "schema_uri", "schemaUri"),
    );
    const candidates = [
      ...(declared ? [declared] : []),
      `schemas/${dataset}.v1.schema.json`,
    ];
    for (const candidate of candidates) {
      if (handle.statEntry(candidate) === null) continue;
      const schema = await handle.readJson(candidate);
      return { path: candidate, schema };
    }
    return null;
  });
}

export interface BlobStat {
  /** Normalized archive path of the blob entry. */
  path: string;
  exists: boolean;
  /** ZIP central-directory compressed size (0 when absent). */
  compressedBytes: number;
  /**
   * Stored payload size — the zstd-compressed blob bytes (0 when absent).
   * The inflated size is unknown until the blob is actually read, which is
   * exactly what this API avoids.
   */
  storedBytes: number;
}

/** Size metadata for a blob without inflating it. */
export async function statBlob(
  target: string | ZipHandle,
  blobRef: string,
  options: AtlasReadOptions = {},
): Promise<BlobStat> {
  if (typeof blobRef !== "string" || blobRef.trim().length === 0) {
    throw new Error("Blob ref must be a non-empty string.");
  }
  const path = normalizeBlobPath(blobRef);
  return withHandle(target, options, async (handle) => {
    const stat = handle.statEntry(path);
    return {
      path,
      exists: stat !== null,
      compressedBytes: stat?.compressedBytes ?? 0,
      storedBytes: stat?.uncompressedBytes ?? 0,
    };
  });
}
