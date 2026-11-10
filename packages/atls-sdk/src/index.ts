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

import { readManifest, readSummary, iterateDataset, iterateParts, readBlob, openZipHandle, MalformedRecordError } from "./reader.js";
import type { AtlasReadOptions, AtlasReadLimits } from "./reader.js";
import { datasetPresent, collectDatasetNames, isKnownDatasetName, AtlasUnknownDatasetError } from "./datasetPresence.js";
import { enforceFormatVersionSupport } from "./formatVersion.js";
import { checkCompatible } from "./compatibility.js";
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
  SitemapUrlRecord,
  ExtractionRecord,
  RobotsRecord,
} from "./types.js";
import {
  parseAssetRecord,
  parseResponseRecord,
  AssetRecordSchema,
  ResponseRecordSchema,
  ResourceRecordV1Schema,
  flattenPageMetadataRecord,
} from "@caifrazier/atls-spec";
import type { FlatPageMetadata } from "@caifrazier/atls-spec";

// Re-exported for backward compatibility — MalformedRecordError now lives in
// reader.ts (see that file's doc comment for why).
export { MalformedRecordError };

const LEGACY_DATASET_ALIASES = {
  pages: "page_metadata",
  edges: "navigation",
  errors: "pipeline_failures",
  failed_pages: "pipeline_failures",
} as const;

// Short directory aliases the reader accepts in addition to the long
// ATLAS_DATASET_KEYS names. The long directory is preferred when both exist.
// Manifest keys stay the long names.
const DATASET_FOLDER_ALIASES: Record<string, string> = {
  page_metadata: "pages",
  navigation: "edges",
  pipeline_failures: "failed_pages",
};

function toCanonicalDatasetName(datasetName: string): string {
  return LEGACY_DATASET_ALIASES[datasetName as keyof typeof LEGACY_DATASET_ALIASES] ?? datasetName;
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
  ExtractionRecord,
  ResourceRecordV1,
  ResponseRecordV1,
  RobotsRecord,
  SitemapUrlRecord,
} from "./types.js";
export * from "./validate.js";
export { buildCrossModeIndex } from "./crossMode.js";
export type { CrossModeEntry, CrossModeIndex } from "./crossMode.js";
export { diffManifests, formatManifestDiff } from "./diff.js";
export type { ManifestDiff, DatasetDelta, DiffManifestsOptions } from "./diff.js";

// Re-export low-level functions for engine use
export {
  readManifest,
  readSummary,
  iterateParts,
  readBlob,
  openZipHandle,
  decompressZstdBuffer,
  ZipHandle,
  DEFAULT_ATLAS_READ_LIMITS,
  AtlasResourceLimitError,
  AtlasDuplicateEntryError,
  AtlasInvalidEntryNameError,
  AtlasPathError,
  AtlasAbortError,
  AtlasDecompressionError,
  AtlasEntryNotFoundError,
} from "./reader.js";
export type { AtlasReadOptions, AtlasReadLimits } from "./reader.js";
export {
  SUPPORTED_FORMAT_MAJOR,
  parseFormatVersion,
  AtlasMissingFormatVersionError,
  AtlasUnsupportedFormatVersionError,
} from "./formatVersion.js";
export { AtlasUnknownDatasetError } from "./datasetPresence.js";
export {
  describeArchive,
  describeDataset,
  readDatasetSlice,
  readRecord,
  readSchema,
  statBlob,
  AtlasRecordNotFoundError,
} from "./describe.js";
export type {
  ArchiveDescription,
  DatasetDescription,
  DatasetPartDescription,
  DatasetState,
  DatasetSlice,
  DatasetSliceRecord,
  ReadDatasetSliceOptions,
  ReadRecordOptions,
  DatasetSchemaResult,
  BlobStat,
} from "./describe.js";
export type { ParsedFormatVersion } from "./formatVersion.js";
export {
  ATLAS_DATASET_KEYS,
  normalizeUrl,
  urlKey,
  assetId,
  contentSha256,
  serializedOrigin,
  completionReasonForEndReason,
  sha256Hex,
  parseBlobRef,
  screenshotBlobRefs,
  MAX_URL_LENGTH,
  TRAILING_SLASH_POLICY,
  FILE_EXTENSIONS,
  URL_NAMESPACE,
  uuidV5,
  datasetId,
  crawlConfigHash,
  provenanceOutputHash,
  acceptedContentDigests,
} from "@caifrazier/atls-spec";
export type {
  AtlasDatasetKey,
  ContentPathOrder,
  FlatPageMetadata,
  IntegrityEdition,
  ParsedBlobRef,
  ScreenshotReference,
  ScreenshotTile,
} from "@caifrazier/atls-spec";
export { normalizeBlobPath } from "./reader.js";
export {
  SDK_VERSION,
  SdkCompatibilityError,
  checkCompatible,
  assertCompatible,
} from "./compatibility.js";
export type { CompatibilityCheckResult } from "./compatibility.js";

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
export interface OpenAtlasOptions extends AtlasReadOptions {
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
    /** B4: per-URL sitemap entries (loc + lastmod/changefreq/priority + enqueued). */
    sitemapUrls: () => AsyncIterable<SitemapUrlRecord>;
    /** B1: custom extraction-rule results (present only when the crawl ran with rules). */
    extraction: () => AsyncIterable<ExtractionRecord>;
    /** Spec 1.3: one robots.txt row per origin. Absent when the crawl did not record the dataset. */
    robots: () => AsyncIterable<RobotsRecord>;
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
  const zipHandle = await openZipHandle(atlsPath, { limits: options?.limits });
  try {
    const strict = options?.strict !== false;
    const readerStats: AtlasReaderStats = { corruptedRecordCount: 0 };
    const manifest = await readManifest(zipHandle);
    enforceFormatVersionSupport(manifest);
    // BUG-0134: the archive's declared SDK floor (capabilities.v1.json
    // compatibility.minSdkVersion) was never consumed anywhere. Warn-only
    // here — opening an old/foreign archive must not hard-fail on a metadata
    // hint; callers wanting enforcement use assertCompatible() explicitly.
    try {
      const capabilities = await zipHandle.readJson("capabilities.v1.json");
      const compat = checkCompatible(capabilities);
      if (!compat.compatible) {
        console.warn(`[Atlas SDK] ${compat.reason}. Datasets may not read correctly; call assertCompatible() to hard-fail instead.`);
      }
    } catch {
      // capabilities.v1.json absent or unreadable — nothing to enforce.
    }
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

    // If parts were stored only under a short alias, still advertise the long name.
    for (const [canonical, aliasName] of Object.entries(DATASET_FOLDER_ALIASES)) {
      if (!datasets.has(canonical as DatasetName) && datasets.has(aliasName as DatasetName)) {
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

  const assetParser = parseAssetRecord;
  const responseParser = parseResponseRecord;

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
    // Prefer the long directory. Fall back to the short alias when that directory has no parts.
    const resolveFolder = (): DatasetName => {
      if (zipHandle.listPartFiles(canonicalDatasetName).length > 0) return canonicalDatasetName;
      const aliasFolder = DATASET_FOLDER_ALIASES[canonicalDatasetName];
      if (aliasFolder) return aliasFolder as DatasetName;
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
        if (abortController.signal.aborted) {
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
        sitemapUrls: makeIterator<SitemapUrlRecord>("sitemap_urls"),
        extraction: makeIterator<ExtractionRecord>("extraction"),
        robots: makeIterator<RobotsRecord>("robots"),
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
  limits?: Partial<AtlasReadLimits>;
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

  const zipHandle = await openZipHandle(atlsPath, { limits: options.limits });
  try {
    const manifest = await readManifest(zipHandle);
    enforceFormatVersionSupport(manifest);
    if (!isKnownDatasetName(manifest, canonicalDataset)) {
      throw new AtlasUnknownDatasetError(String(dataset));
    }

    // Prefer the long directory. Fall back to the short alias when it is the only folder present.
    const aliasFolder = DATASET_FOLDER_ALIASES[canonicalDataset];
    const folderName =
      aliasFolder && zipHandle.listPartFiles(canonicalDataset).length === 0 ? aliasFolder : canonicalDataset;

    for await (const line of iterateDataset(atlsPath, folderName, { zipHandle })) {
      let record: T;
      try {
        record = JSON.parse(line) as T;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new MalformedRecordError(canonicalDataset, `invalid JSON: ${reason}`);
      }

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
