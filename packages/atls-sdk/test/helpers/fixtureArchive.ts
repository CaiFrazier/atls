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

import archiver from "archiver";
import { compress } from "@mongodb-js/zstd";
import { createHash, randomUUID } from "crypto";
import { createWriteStream, promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export type FixtureArchive = {
  path: string;
  cleanup: () => Promise<void>;
  pageUrl: string;
  blobRef: string;
  blobBody: Buffer;
};

export type FixtureOptions = {
  edgeSourceUrl?: string;
  omitFormatVersion?: boolean;
  nonCanonicalBlobRef?: boolean;
  /** Inject a non-canonical blob ref into the asset record's nested resourceHint.bodyBlobRef. */
  nonCanonicalAssetBlobRef?: boolean;
  /** Put a string that is neither spelling into resourceHint.bodyBlobRef. */
  invalidAssetBlobRef?: boolean;
  pageNullTitle?: boolean;
  formatVersionValue?: string;
  /** Override the specLevel written into the summary (1=raw, 2=prerender, 3=full). */
  specLevel?: number;
  /** Override the renderMode written into page_metadata and summary.renderModes. */
  renderMode?: "raw" | "prerender" | "full";
  /** Override the page URL used across all records. */
  pageUrl?: string;
  /** Inject raw strings as extra lines into a dataset part (e.g. invalid JSON). */
  corruptLines?: { dataset: string; lines: string[] };
  /** Override the response record's statusCode (default 200) — e.g. 404 to exercise checkBrokenLinks. */
  responseStatusCode?: number;
  /** Omit the required `social` field from page_metadata, to exercise schema-violation handling. */
  pageMissingSocial?: boolean;
  /**
   * BUG-0123(c): write the listed datasets as ZERO-record parts — still listed
   * in manifest.parts (so presence holds and reads route through the streaming
   * path and its blank-line skip, not the presence early-return) but with an
   * empty part file and recordCount 0. Summary totals are derived from actual
   * record counts so validate() sees no totalPages/totalEdges mismatch.
   */
  emptyDatasets?: string[];
  /**
   * BUG-0114: place part FILES under the short alias folders
   * (`pages/`, `edges/` — see DATASET_FOLDER_ALIASES in src/index.ts) while
   * manifest `datasets`/`parts` KEYS stay the long names. This layout forces
   * the readers' alias-folder fallback.
   */
  aliasFolders?: boolean;
  /**
   * Practitioner Update Phase 1 (describe.ts): write part files for a dataset
   * folder that the manifest never declares — exercises the `unexpected` state.
   */
  unlistedDatasetParts?: { dataset: string; records: unknown[] };
  /**
   * Practitioner Update Phase 1 (describe.ts): keep these datasets declared in
   * the manifest but omit their part FILES from the zip — exercises `corrupt`.
   */
  omitPartFiles?: string[];
  /**
   * Practitioner Update Phase 1 (describe.ts): embed stub JSON Schemas under
   * `schemas/` and declare them via each dataset's schema_uri — exercises
   * readSchema().
   */
  includeSchemas?: boolean;
};

/** Mirror of DATASET_FOLDER_ALIASES in src/index.ts (canonical → alias). */
const DATASET_FOLDER_ALIASES: Record<string, string> = {
  page_metadata: "pages",
  navigation: "edges",
  pipeline_failures: "failed_pages",
};

type DatasetPart = {
  path: string;
  recordCount: number;
  bytesCompressed: number;
  hash: string;
  buffer: Buffer;
};

const DEFAULT_PAGE_URL = "https://example.com/";

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function buildJsonlPart(records: unknown[], path: string): Promise<DatasetPart> {
  const jsonl = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  const compressed = Buffer.from(await compress(Buffer.from(jsonl, "utf-8")));
  return {
    path,
    recordCount: records.length,
    bytesCompressed: compressed.length,
    hash: sha256Hex(compressed),
    buffer: compressed,
  };
}

async function buildRawJsonlPart(lines: string[], path: string): Promise<DatasetPart> {
  const jsonl = lines.join("\n") + "\n";
  const compressed = Buffer.from(await compress(Buffer.from(jsonl, "utf-8")));
  return {
    path,
    recordCount: lines.length,
    bytesCompressed: compressed.length,
    hash: sha256Hex(compressed),
    buffer: compressed,
  };
}

export async function createFixtureArchive(options: FixtureOptions = {}): Promise<FixtureArchive> {
  const now = new Date().toISOString();
  const pageId = randomUUID();
  const pageUrl = options.pageUrl ?? DEFAULT_PAGE_URL;
  const renderMode = options.renderMode ?? "raw";
  const specLevel = options.specLevel ?? 1;
  const blobBody = Buffer.from("<html><body>Fixture</body></html>", "utf-8");
  const blobHash = sha256Hex(blobBody);
  const blobRef = `sha256/${blobHash.slice(0, 2)}/${blobHash.slice(2, 4)}/${blobHash}`;
  const blobCompressed = Buffer.from(await compress(blobBody));

  const pageOrigin = new URL(pageUrl).origin;
  const pageDomain = new URL(pageUrl).hostname;

  // Canonical page_metadata shape (PageMetadataDatasetRecordV1Schema): pageId,
  // url, core/indexing/social (nested), capturedAt. `core.meta` is a
  // fixture-only passthrough extra (harmless — `core` is a passthrough
  // schema) kept so the SELECT dot-notation projection tests have a
  // two-level-nested field to exercise.
  const pageMetadataRecord = {
    pageId: pageId,
    url: pageUrl,
    // Non-canonical top-level field, only ever set by pageNullTitle: exercises
    // validateStrictTopLevelNulls' "field must be omitted instead of null"
    // check, which only inspects top-level keys. Harmless for schema
    // validation — the outer schema isn't `.strict()`, so an unrecognized key
    // is silently stripped from parsed output rather than rejected.
    ...(options.pageNullTitle ? { title: null } : {}),
    core: {
      title: options.pageNullTitle ? null : "Fixture Page",
      meta: { description: "A fixture description" },
    },
    indexing: {},
    // `social` is a required field on PageMetadataDatasetRecordV1Schema —
    // omitted when pageMissingSocial is set, to exercise the Zod
    // DATASET_SCHEMA_VIOLATION path for a missing required field.
    ...(options.pageMissingSocial ? {} : { social: { openGraph: {}, twitterCard: {} } }),
    capturedAt: now,
  };

  const navigationRecord = {
    pageId: pageId,
    sourceUrl: options.edgeSourceUrl ?? pageUrl,
    edges: [
      {
        sourceUrl: options.edgeSourceUrl ?? pageUrl,
        targetUrl: pageUrl,
        anchorText: "Home",
        nofollow: false,
        isExternal: false,
        location: "nav",
      },
    ],
    capturedAt: now,
  };

  const assetRecord = {
    pageId: pageId,
    assetId: "asset-1",
    pageUrl: pageUrl,
    assetUrl: `${pageUrl}asset.png`,
    type: "image",
    hasAlt: false,
    visible: true,
    inViewport: true,
    wasLazyLoaded: false,
    ...(options.nonCanonicalAssetBlobRef || options.invalidAssetBlobRef
      ? {
          resourceHint: {
            resId: "00000000-0000-4000-8000-000000000001",
            bodyBlobRef: options.invalidAssetBlobRef ? "not-a-blob-ref" : `blobs/${blobRef}.zst`,
          },
        }
      : {}),
  };

  const responseRecord = {
    pageId: pageId,
    url: pageUrl,
    finalUrl: pageUrl,
    statusCode: options.responseStatusCode ?? 200,
    encoding: "utf-8",
    bodyBlobRef: options.nonCanonicalBlobRef ? `blobs/${blobRef}.zst` : blobRef,
  };

  // BUG-0114: with aliasFolders, the part FILES live under the short alias
  // folders while all manifest keys stay the long names — see FixtureOptions.
  const folderFor = (dataset: string): string =>
    options.aliasFolders ? (DATASET_FOLDER_ALIASES[dataset] ?? dataset) : dataset;

  // BUG-0123(c): emptied datasets keep their part file and manifest listing
  // but carry zero records.
  const emptied = new Set(options.emptyDatasets ?? []);
  const recordsFor = (dataset: string, records: unknown[]): unknown[] =>
    emptied.has(dataset) ? [] : records;

  const pageMetadataPart = await buildJsonlPart(
    recordsFor("page_metadata", [pageMetadataRecord]),
    `${folderFor("page_metadata")}/${folderFor("page_metadata")}_part_00.jsonl.zst`
  );
  const navigationPart = await buildJsonlPart(
    recordsFor("navigation", [navigationRecord]),
    `${folderFor("navigation")}/${folderFor("navigation")}_part_00.jsonl.zst`
  );
  const assetsPart = await buildJsonlPart(recordsFor("assets", [assetRecord]), "assets/assets_part_00.jsonl.zst");
  const responsesPart = await buildJsonlPart(recordsFor("responses", [responseRecord]), "responses/responses_part_00.jsonl.zst");

  // Maps dataset name → list of parts for that dataset
  const partBuffers: Record<string, DatasetPart[]> = {
    page_metadata: [pageMetadataPart],
    navigation: [navigationPart],
    assets: [assetsPart],
    responses: [responsesPart],
  };

  // Inject an additional corrupt part if requested
  if (options.corruptLines) {
    const { dataset, lines } = options.corruptLines;
    const corruptPart = await buildRawJsonlPart(
      lines,
      `${dataset}/${dataset}_part_corrupt.jsonl.zst`
    );
    if (!partBuffers[dataset]) {
      partBuffers[dataset] = [];
    }
    partBuffers[dataset].push(corruptPart);
  }

  // Built AFTER partBuffers is finalized so it never leaks into the manifest.
  let unlistedPart: DatasetPart | null = null;
  if (options.unlistedDatasetParts) {
    const { dataset, records } = options.unlistedDatasetParts;
    unlistedPart = await buildJsonlPart(records, `${dataset}/${dataset}_part_00.jsonl.zst`);
  }

  const datasets = {
    page_metadata: {
      name: "page_metadata",
      version: "v1",
      recordCount: pageMetadataPart.recordCount,
      bytes_compressed: pageMetadataPart.bytesCompressed,
      hash_sha256: pageMetadataPart.hash,
      schema_uri: "schemas/page_metadata.v1.schema.json",
    },
    navigation: {
      name: "navigation",
      version: "v1",
      recordCount: navigationPart.recordCount,
      bytes_compressed: navigationPart.bytesCompressed,
      hash_sha256: navigationPart.hash,
      schema_uri: "schemas/navigation.v1.schema.json",
    },
    assets: {
      name: "assets",
      version: "v1",
      recordCount: assetsPart.recordCount,
      bytes_compressed: assetsPart.bytesCompressed,
      hash_sha256: assetsPart.hash,
      schema_uri: "schemas/assets.v1.schema.json",
    },
    responses: {
      name: "responses",
      version: "v1",
      recordCount: responsesPart.recordCount,
      bytes_compressed: responsesPart.bytesCompressed,
      hash_sha256: responsesPart.hash,
      schema_uri: "schemas/responses.v1.schema.json",
    },
  };

  const formatVersionEntry = options.omitFormatVersion
    ? {}
    : { formatVersion: options.formatVersionValue ?? "1.0.0" };

  const manifest = {
    atlasVersion: "1.0",
    ...formatVersionEntry,
    generator: "atlas-sdk-test/1.0.0",
    atlas_semver: "1.0.0",
    createdAt: now,
    created_by: {
      app: "atlas-sdk-test",
      version: "1.0.0",
    },
    mode: renderMode,
    seeds: [pageUrl],
    datasets,
    parts: Object.fromEntries(
      Object.entries(partBuffers).map(([ds, parts]) => [ds, parts.map(p => p.path)])
    ),
    owner: {
      name: "Cai Frazier",
    },
    storage: {
      blobFormat: "individual",
      blob_stats: {
        total_blobs: 1,
        total_bytes_compressed: blobCompressed.length,
        deduplication_rate: 0,
      },
    },
    privacyPolicy: {
      stripCookies: true,
      stripAuthHeaders: true,
      redactInputs: true,
      redactPii: true,
    },
    summary: {
      total_pages: pageMetadataPart.recordCount,
      total_links: navigationPart.recordCount,
      total_assets: assetsPart.recordCount,
      total_errors: 0,
    },
  };

  const summary = {
    identity: {
      seedUrls: [pageUrl],
      primaryOrigin: pageOrigin,
      domain: pageDomain,
      publicSuffix: "com",
    },
    crawlContext: {
      specLevel: specLevel,
      completionReason: "finished",
      config: {
        robotsRespect: true,
        followExternal: false,
      },
    },
    stats: {
      totalPages: pageMetadataPart.recordCount,
      totalEdges: navigationPart.recordCount,
      totalAssets: assetsPart.recordCount,
      totalErrors: 0,
      totalResponses: responsesPart.recordCount,
      statusCodes: responsesPart.recordCount > 0 ? { "200": responsesPart.recordCount } : {},
      renderModes: {
        [renderMode]: 1,
      },
    },
    performance: {
      maxDepthReached: 0,
    },
    timestamps: {
      crawlStartedAt: now,
      crawlCompletedAt: now,
      crawlDurationMs: 1,
    },
  };

  const fileName = `atlas-sdk-fixture-${Date.now()}-${Math.random().toString(16).slice(2)}.atls`;
  const archivePath = join(tmpdir(), fileName);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", (error) => reject(error));
    archive.on("error", (error) => reject(error));

    archive.pipe(output);
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(JSON.stringify(summary, null, 2), { name: "summary.json" });

    const omitted = new Set(options.omitPartFiles ?? []);
    for (const [dataset, parts] of Object.entries(partBuffers)) {
      if (omitted.has(dataset)) continue;
      for (const part of parts) {
        archive.append(part.buffer, { name: part.path });
      }
    }

    if (unlistedPart) {
      archive.append(unlistedPart.buffer, { name: unlistedPart.path });
    }

    if (options.includeSchemas) {
      for (const dataset of Object.keys(partBuffers)) {
        archive.append(
          JSON.stringify({ $id: `https://atls.dev/schemas/${dataset}.v1.schema.json`, type: "object" }),
          { name: `schemas/${dataset}.v1.schema.json` }
        );
      }
    }

    archive.append(blobCompressed, { name: `blobs/${blobRef}.zst` });

    archive.finalize().catch((error) => reject(error));
  });

  return {
    path: archivePath,
    pageUrl,
    blobRef,
    blobBody,
    cleanup: async () => {
      await fs.rm(archivePath, { force: true });
    },
  };
}
