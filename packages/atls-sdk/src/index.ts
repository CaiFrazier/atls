/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { readManifest, readSummary, iterateDataset, iterateParts, readBlob, openZipHandle } from "./reader.js";
import type {
  AtlasManifest,
  AtlasSummary,
  AssetRecord,
  EventRecord, // Phase 7: Event log
  AccessibilityRecord,
  DatasetName,
  PackView,
  AtlasPack,
  AtlasPackName,
  AtlasPackState,
  ResponseRecordV1,
  ResourceRecordV1,
} from "./types.js";
import {
  parseAssetRecord,
  parseResponseRecord,
  AssetRecordSchema,
  ResponseRecordSchema,
  ResourceRecordV1Schema,
  flattenPageMetadataRecord,
} from "@atls/spec";
import type { FlatPageMetadata } from "@atls/spec";

/**
 * Error thrown when a malformed record is encountered in strict mode.
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

const LEGACY_DATASET_ALIASES = {
  pages: "page_metadata",
  edges: "navigation",
  errors: "pipeline_failures",
  failed_pages: "pipeline_failures",
} as const;

// Newer archives (schemaVersion >= 2025-10-22) use shorter folder names that
// are the inverse of the above aliases.
const NEWER_FORMAT_FOLDER_MAP: Record<string, string> = {
  page_metadata: "pages",
  navigation: "edges",
  pipeline_failures: "failed_pages",
};

function toCanonicalDatasetName(datasetName: string): string {
  return LEGACY_DATASET_ALIASES[datasetName as keyof typeof LEGACY_DATASET_ALIASES] ?? datasetName;
}

const SUPPORTED_FORMAT_MAJOR = 1;

function parseFormatVersion(raw: string): { major: number; isPrerelease: boolean } | null {
  const value = raw.trim();
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  if (!Number.isFinite(major)) {
    return null;
  }
  return {
    major,
    isPrerelease: /[-+]/.test(value)
  };
}

function enforceFormatVersionSupport(manifest: AtlasManifest): void {
  const record = manifest as Record<string, any>;
  const formatVersion = record.formatVersion;
  if (typeof formatVersion !== "string" || formatVersion.trim().length === 0) {
    throw new Error("Unsupported Atlas archive: missing required manifest.formatVersion");
  }

  const parsed = parseFormatVersion(formatVersion);
  if (!parsed) {
    throw new Error(`Unsupported Atlas archive: invalid formatVersion "${formatVersion}"`);
  }
  if (parsed.major !== SUPPORTED_FORMAT_MAJOR) {
    throw new Error(
      `Unsupported Atlas archive formatVersion "${formatVersion}". SDK supports ${SUPPORTED_FORMAT_MAJOR}.x.x archives only.`
    );
  }

  if (parsed.isPrerelease) {
    console.warn(`[Atlas SDK] Deprecated pre-release formatVersion "${formatVersion}" detected.`);
  }
}

export type {
  AccessibilityRecord,
  AnyRecord,
  AtlasManifest,
  AtlasManifestV1,
  AtlasPack,
  AtlasPackName,
  AtlasPackState,
  AtlasSummary,
  AtlasSummaryV1,
  AssetRecord,
  DatasetName,
  EventRecord,
  PackView,
  ResourceRecordV1,
  ResponseRecordV1,
} from "./types.js";
export * from "./validate.js";
export { buildCrossModeIndex } from "./crossMode.js";
export type { CrossModeEntry, CrossModeIndex } from "./crossMode.js";
export { diffManifests, formatManifestDiff } from "./diff.js";
export type { ManifestDiff, DatasetDelta, DiffManifestsOptions } from "./diff.js";

// Re-export low-level functions for engine use
export { readManifest, readSummary, iterateParts, readBlob, openZipHandle, ZipHandle } from "./reader.js";

function datasetPresent(manifest: AtlasManifest, datasetName: string): boolean {
  const datasets = manifest.datasets ?? {};
  const meta = datasets[datasetName as keyof typeof datasets] as Record<string, any> | undefined;

  if (meta) {
    if (typeof meta.recordCount === "number" && meta.recordCount > 0) {
      return true;
    }
    if (typeof meta.present === "boolean") {
      return meta.present;
    }
    if (typeof meta.partCount === "number" && meta.partCount > 0) {
      return true;
    }
    if (typeof meta.parts === "number" && meta.parts > 0) {
      return true;
    }
    if (Array.isArray(meta.files) && meta.files.length > 0) {
      return true;
    }
  }

  const partsByDataset = manifest.parts as Record<string, string[]> | undefined;
  if (partsByDataset && Array.isArray(partsByDataset[datasetName]) && partsByDataset[datasetName].length > 0) {
    return true;
  }

  const coverageEntry = manifest.coverage?.matrix?.find(entry => entry.part === datasetName);
  if (coverageEntry) {
    if (coverageEntry.present) {
      return true;
    }
    if (typeof coverageEntry.row_count === "number" && coverageEntry.row_count > 0) {
      return true;
    }
  }

  return false;
}

function collectDatasetNames(manifest: AtlasManifest): Set<string> {
  const names = new Set<string>();
  const datasets = manifest.datasets ?? {};
  for (const key of Object.keys(datasets)) {
    names.add(key);
  }

  const partsByDataset = manifest.parts as Record<string, string[]> | undefined;
  if (partsByDataset) {
    for (const key of Object.keys(partsByDataset)) {
      names.add(key);
    }
  }

  const coverage = manifest.coverage?.matrix ?? [];
  for (const entry of coverage) {
    names.add(entry.part);
  }

  return names;
}

function buildPackView(manifest: AtlasManifest): PackView {
  const packs = Array.isArray(manifest.packs) ? manifest.packs.map(pack => ({ ...pack })) : [];
  const packMap = new Map<AtlasPackName, AtlasPack>();
  for (const pack of packs) {
    packMap.set(pack.name, pack);
  }

  const embedded = packs.filter(pack => pack.state === "embedded");
  const sidecar = packs.filter(pack => pack.state === "sidecar");
  const missing = packs.filter(pack => pack.state === "missing");

  const view: PackView = {
    all: packs,
    embedded,
    sidecar,
    missing,
    get(name: AtlasPackName): AtlasPack | undefined {
      return packMap.get(name);
    },
    has(name: AtlasPackName): boolean {
      return packMap.has(name);
    },
    hasEmbedded(name: AtlasPackName): boolean {
      return packMap.get(name)?.state === "embedded";
    },
    sidecarUri(name: AtlasPackName): string | undefined {
      const pack = packMap.get(name);
      return pack?.uri ?? undefined;
    },
    state(name: AtlasPackName): AtlasPackState | undefined {
      return packMap.get(name)?.state;
    }
  };

  return view;
}

/**
 * Options for opening an Atlas archive.
 */
export interface OpenAtlasOptions {
  /**
   * When `true` (default), malformed records throw a `MalformedRecordError`.
   * When `false`, malformed records are silently skipped and counted in `stats.corruptedRecordCount`.
   */
  strict?: boolean;
}

/**
 * Cumulative read statistics tracked across all dataset iterators.
 */
export interface AtlasReaderStats {
  /** Number of malformed records skipped (only incremented when `strict: false`). */
  corruptedRecordCount: number;
}

/**
 * Atlas reader interface
 */
export interface AtlasReader {
  manifest: AtlasManifest;
  summary: AtlasSummary;
  datasets: Set<DatasetName>;
  packs: PackView;
  /** Cumulative read statistics. */
  stats: AtlasReaderStats;
  hasDataset: (dataset: DatasetName) => boolean;
  getBlob: (ref: string) => Promise<Buffer>;
  close: () => void;
  readers: {
    navigation: () => AsyncIterable<Record<string, unknown>>;
    pageMetadata: () => AsyncIterable<FlatPageMetadata>;
    /** @deprecated Use `pageMetadata()` */
    pages: () => AsyncIterable<FlatPageMetadata>;
    content: () => AsyncIterable<Record<string, unknown>>;
    structuredData: () => AsyncIterable<Record<string, unknown>>;
    technology: () => AsyncIterable<Record<string, unknown>>;
    renderState: () => AsyncIterable<Record<string, unknown>>;
    security: () => AsyncIterable<Record<string, unknown>>;
    performance: () => AsyncIterable<Record<string, unknown>>;
    pipelineFailures: () => AsyncIterable<Record<string, unknown>>;
    pipelineAlerts: () => AsyncIterable<Record<string, unknown>>;
    /** @deprecated Use `navigation()` */
    edges: () => AsyncIterable<Record<string, unknown>>;
    /** @deprecated Use `pipelineFailures()` */
    errors: () => AsyncIterable<Record<string, unknown>>;
    /** @deprecated Use `pipelineFailures()` */
    failedPages: () => AsyncIterable<Record<string, unknown>>;
    assets: () => AsyncIterable<AssetRecord>;
    events: () => AsyncIterable<EventRecord>; // Phase 7: Event log
    accessibility: () => AsyncIterable<AccessibilityRecord>;
    responses: () => AsyncIterable<ResponseRecordV1>;
    resources: () => AsyncIterable<ResourceRecordV1>;
    dataset: <T = any>(name: DatasetName) => AsyncIterable<T>;
  };
}

/**
 * Open an Atlas archive and get a reader interface
 * 
 * @param atlsPath Path to .atls file
 * @returns Reader with manifest, summary, and dataset iterators
 * 
 * @example
 * ```typescript
 * const atlas = await openAtlas('./crawl.atls');
 * 
 * console.log(`Pages: ${atlas.summary.stats.totalPages}`);
 * console.log(`Datasets: ${[...atlas.datasets].join(', ')}`);
 * 
 * for await (const page of atlas.readers.pageMetadata()) {
 *   console.log((page as any).url, (page as any).core?.title);
 * }
 * ```
 */
export async function openAtlas(atlsPath: string, options?: OpenAtlasOptions): Promise<AtlasReader> {
  const zipHandle = await openZipHandle(atlsPath);
  try {
    const strict = options?.strict !== false;
    const readerStats: AtlasReaderStats = { corruptedRecordCount: 0 };
    const manifest = await readManifest(zipHandle);
    enforceFormatVersionSupport(manifest);
    const summary = await readSummary(zipHandle);
    const packs = buildPackView(manifest);
    const datasetCandidates = collectDatasetNames(manifest);
    const datasets: Set<DatasetName> = new Set();

    for (const name of datasetCandidates) {
      if (datasetPresent(manifest, name)) {
        datasets.add(name as DatasetName);
      }
    }

    // Inject legacy V1 aliases only when their canonical dataset is present.
    for (const [alias, canonical] of Object.entries(LEGACY_DATASET_ALIASES)) {
      if (datasets.has(canonical as DatasetName)) {
        datasets.add(alias as DatasetName);
      }
    }

    // Inject canonical names as aliases when only the newer folder name is present
    // (schemaVersion >= 2025-10-22 uses "pages" instead of "page_metadata", etc.)
    for (const [canonical, newerName] of Object.entries(NEWER_FORMAT_FOLDER_MAP)) {
      if (!datasets.has(canonical as DatasetName) && datasets.has(newerName as DatasetName)) {
        datasets.add(canonical as DatasetName);
      }
    }

    const hasDataset = (dataset: DatasetName): boolean => {
      const canonical = toCanonicalDatasetName(dataset);
      return datasets.has(dataset) || datasets.has(canonical as DatasetName);
    };
    const abortController = new AbortController();
    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      abortController.abort();
      zipHandle.close();
    };

  const ensureParser = <T>(parser: ((value: unknown) => T) | undefined, fallback: (value: unknown) => T) =>
    (typeof parser === "function" ? parser : fallback);

  const fallbackParseAssetRecord = (value: unknown): AssetRecord => {
    const record = value as any;
    if (!record || typeof record !== "object") {
      throw new Error("Record is not an object");
    }
    if (
      typeof record.pageId !== "string" ||
      typeof record.assetId !== "string" ||
      typeof record.pageUrl !== "string" ||
      typeof record.assetUrl !== "string" ||
      typeof record.type !== "string" ||
      typeof record.hasAlt !== "boolean" ||
      (record.visible !== null && typeof record.visible !== "boolean") ||
      (record.inViewport !== null && typeof record.inViewport !== "boolean") ||
      typeof record.wasLazyLoaded !== "boolean"
    ) {
      throw new Error("Missing required asset fields");
    }
    return record as AssetRecord;
  };

  const fallbackParseResponseRecord = (value: unknown): ResponseRecordV1 => {
    const record = value as any;
    if (!record || typeof record !== "object") {
      throw new Error("Record is not an object");
    }
    if (
      typeof record.pageId !== "string" ||
      typeof record.url !== "string" ||
      typeof record.finalUrl !== "string" ||
      typeof record.statusCode !== "number" ||
      typeof record.encoding !== "string" ||
      typeof record.bodyBlobRef !== "string"
    ) {
      throw new Error("Missing required response fields");
    }
    return record as ResponseRecordV1;
  };

  const assetParser = ensureParser(parseAssetRecord, fallbackParseAssetRecord);
  const responseParser = ensureParser(parseResponseRecord, fallbackParseResponseRecord);

  type DatasetValidator = {
    safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: { message: string } };
  };
  const datasetValidators: Partial<Record<DatasetName, DatasetValidator>> = {
    assets: AssetRecordSchema,
    responses: ResponseRecordSchema,
    resources: ResourceRecordV1Schema,
  };

  const makeIterator = <T = any>(
    datasetName: DatasetName,
    parser?: (value: unknown) => T,
    coreValidator?: (value: unknown) => T,
    transform?: (value: unknown) => T
  ) => {
    const canonicalDatasetName = toCanonicalDatasetName(datasetName);
    // For newer archives the folder may be the shorter alias (e.g. "pages" not "page_metadata")
    const resolveFolder = (): DatasetName => {
      if (zipHandle.listPartFiles(canonicalDatasetName).length > 0) return canonicalDatasetName;
      const newerFolder = NEWER_FORMAT_FOLDER_MAP[canonicalDatasetName];
      if (newerFolder) return newerFolder as DatasetName;
      return canonicalDatasetName;
    };
    return async function* (): AsyncGenerator<T, void, unknown> {
      if (!datasets.has(datasetName) && !datasets.has(canonicalDatasetName as DatasetName)) {
        return;
      }
      const folderName = resolveFolder();
      try {
        for await (const line of iterateDataset(atlsPath, folderName, { signal: abortController.signal, zipHandle })) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            if (strict) {
              throw new MalformedRecordError(canonicalDatasetName, `invalid JSON: ${reason}`);
            }
            readerStats.corruptedRecordCount++;
            continue;
          }

          const validator = datasetValidators[canonicalDatasetName as DatasetName];
          if (validator) {
            const result = validator.safeParse(parsed);
            if (!result.success) {
              const reason = result.error?.message ?? "schema validation failed";
              if (strict) {
                throw new MalformedRecordError(canonicalDatasetName, reason);
              }
              readerStats.corruptedRecordCount++;
              continue;
            }
            parsed = result.data;
          }

          if (coreValidator) {
            try {
              coreValidator(parsed);
            } catch (error) {
              const reason = error instanceof Error ? error.message : String(error);
              if (strict) {
                throw new MalformedRecordError(canonicalDatasetName, reason);
              }
              readerStats.corruptedRecordCount++;
              continue;
            }
          }
          if (parser) {
            try {
              parser(parsed);
            } catch (error) {
              const reason = error instanceof Error ? error.message : String(error);
              if (strict) {
                throw new MalformedRecordError(canonicalDatasetName, reason);
              }
              readerStats.corruptedRecordCount++;
              continue;
            }
          }
          yield (transform ? transform(parsed) : parsed) as T;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (abortController.signal.aborted && message === "Operation aborted.") {
          return;
        }
        throw error;
      }
    };
  };

    const flattenPageMetadata = (value: unknown): FlatPageMetadata =>
      flattenPageMetadataRecord(value as Record<string, unknown>);

    const reader: AtlasReader = {
      manifest,
      summary,
      datasets,
      packs,
      stats: readerStats,
      hasDataset,
      getBlob: (ref: string) => readBlob(zipHandle, ref),
      close,
      readers: {
        navigation: makeIterator<Record<string, unknown>>("navigation"),
        pageMetadata: makeIterator<FlatPageMetadata>("page_metadata", undefined, undefined, flattenPageMetadata),
        pages: makeIterator<FlatPageMetadata>("page_metadata", undefined, undefined, flattenPageMetadata),
        content: makeIterator<Record<string, unknown>>("content"),
        structuredData: makeIterator<Record<string, unknown>>("structured_data"),
        technology: makeIterator<Record<string, unknown>>("technology"),
        renderState: makeIterator<Record<string, unknown>>("render_state"),
        security: makeIterator<Record<string, unknown>>("security"),
        performance: makeIterator<Record<string, unknown>>("performance"),
        pipelineFailures: makeIterator<Record<string, unknown>>("pipeline_failures"),
        pipelineAlerts: makeIterator<Record<string, unknown>>("pipeline_alerts"),
        edges: makeIterator<Record<string, unknown>>("navigation"),
        errors: makeIterator<Record<string, unknown>>("pipeline_failures"),
        failedPages: makeIterator<Record<string, unknown>>("pipeline_failures"),
        assets: makeIterator<AssetRecord>("assets", assetParser),
        events: makeIterator<EventRecord>("events"),
        accessibility: makeIterator<AccessibilityRecord>("accessibility"),
        responses: makeIterator<ResponseRecordV1>("responses", responseParser),
        resources: makeIterator<ResourceRecordV1>("resources"),
        dataset<T = any>(name: DatasetName) {
          return makeIterator<T>(toCanonicalDatasetName(name))();
        }
      }
    };

    const asyncDispose = (Symbol as any).asyncDispose;
    if (asyncDispose) {
      (reader as any)[asyncDispose] = async () => {
        close();
      };
    }
    const dispose = (Symbol as any).dispose;
    if (dispose) {
      (reader as any)[dispose] = () => {
        close();
      };
    }

    return reader;
  } catch (error) {
    zipHandle.close();
    throw error;
  }
}

/**
 * Select options for filtering and projection
 */
export interface SelectOptions<T = any> {
  dataset: DatasetName;
  where?: (record: T) => boolean;
  fields?: string[];
  limit?: number;
}

/**
 * Stream records from a dataset with optional filtering and projection
 * 
 * @param atlsPath Path to .atls file
 * @param options Select options (dataset, where, fields, limit)
 * @returns Async iterable of filtered/projected records
 * 
 * @example
 * ```typescript
 * // Get all non-200 page metadata records
 * for await (const page of select('./crawl.atls', {
 *   dataset: 'page_metadata',
 *   where: (p: any) => p.statusCode !== 200,
 *   fields: ['url', 'statusCode', 'core.title']
 * })) {
 *   console.log(page);
 * }
 * 
 * // Get images with missing alt text
 * for await (const record of select('./crawl.atls', {
 *   dataset: 'accessibility',
 *   where: (a) => a.missingAltCount > 0,
 *   fields: ['pageUrl', 'missingAltCount', 'missingAltSources']
 * })) {
 *   console.log(record);
 * }
 * ```
 */
export async function* select<T = any>(
  atlsPath: string,
  options: SelectOptions<T>
): AsyncIterable<Partial<T>> {
  const { dataset, where, fields, limit } = options;
  const canonicalDataset = toCanonicalDatasetName(dataset);
  let count = 0;

  const zipHandle = await openZipHandle(atlsPath);
  try {
    for await (const line of iterateDataset(atlsPath, canonicalDataset, { zipHandle })) {
      const record = JSON.parse(line) as T;

      // Apply filter
      if (where && !where(record)) {
        continue;
      }

      // Apply projection
      let result: any = record;
      if (fields && fields.length > 0) {
        result = {};
        for (const field of fields) {
          const segments = field.split('.');
          if (segments.length === 1) {
            if (field in (record as any)) {
              result[field] = (record as any)[field];
            }
          } else {
            // Walk the nested path
            let source: any = record;
            for (let i = 0; i < segments.length - 1; i++) {
              if (source == null || typeof source !== 'object') {
                source = undefined;
                break;
              }
              source = source[segments[i]];
            }
            if (source != null && typeof source === 'object') {
              const lastKey = segments[segments.length - 1];
              if (lastKey in source) {
                // Build nested structure in result
                let target: any = result;
                for (let i = 0; i < segments.length - 1; i++) {
                  if (!(segments[i] in target)) {
                    target[segments[i]] = {};
                  }
                  target = target[segments[i]];
                }
                target[lastKey] = source[lastKey];
              }
            }
          }
        }
      }

      yield result;

      // Apply limit
      count++;
      if (limit && count >= limit) {
        break;
      }
    }
  } finally {
    zipHandle.close();
  }
}
