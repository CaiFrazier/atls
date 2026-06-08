/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
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
  const pagePathname = new URL(pageUrl).pathname;

  const pageMetadataRecord = {
    page_id: pageId,
    url: pageUrl,
    normalizedUrl: pageUrl,
    finalUrl: pageUrl,
    urlKey: sha256Hex(Buffer.from(pageUrl, "utf-8")),
    origin: pageOrigin,
    pathname: pagePathname,
    section: "/",
    statusCode: 200,
    headings: [{ level: 1, text: "Fixture" }],
    rawHtmlHash: blobHash,
    textSample: "Fixture",
    fetchedAt: now,
    renderMode: renderMode,
    navEndReason: "fetch",
    internalLinksCount: 1,
    externalLinksCount: 0,
    mediaAssetsCount: 1,
    mediaAssetsTruncated: false,
    hreflangLinks: [],
    depth: 0,
    discoveredInMode: renderMode,
    ...(options.pageNullTitle ? { title: null } : {}),
    core: { title: options.pageNullTitle ? null : "Fixture Page", meta: { description: "A fixture description" } },
    core: { title: options.pageNullTitle ? null : "Fixture Page", meta: { description: "A fixture description" } },
  };

  const navigationRecord = {
    page_id: pageId,
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
    page_id: pageId,
    asset_id: "asset-1",
    pageUrl: pageUrl,
    assetUrl: `${pageUrl}asset.png`,
    type: "image",
    hasAlt: false,
    visible: true,
    inViewport: true,
    wasLazyLoaded: false,
  };

  const responseRecord = {
    page_id: pageId,
    url: pageUrl,
    final_url: pageUrl,
    status_code: 200,
    encoding: "utf-8",
    body_blob_ref: options.nonCanonicalBlobRef ? `blobs/${blobRef}.zst` : blobRef,
  };

  const pageMetadataPart = await buildJsonlPart([pageMetadataRecord], "page_metadata/page_metadata_part_00.jsonl.zst");
  const navigationPart = await buildJsonlPart([navigationRecord], "navigation/navigation_part_00.jsonl.zst");
  const assetsPart = await buildJsonlPart([assetRecord], "assets/assets_part_00.jsonl.zst");
  const responsesPart = await buildJsonlPart([responseRecord], "responses/responses_part_00.jsonl.zst");

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
    created_at: now,
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
      blob_format: "individual",
      blob_stats: {
        total_blobs: 1,
        total_bytes_compressed: blobCompressed.length,
        deduplication_rate: 0,
      },
    },
    privacy_policy: {
      strip_cookies: true,
      strip_auth_headers: true,
      redact_inputs: true,
      redact_pii: true,
    },
    summary: {
      total_pages: 1,
      total_links: 1,
      total_assets: 1,
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
      totalPages: 1,
      totalEdges: 1,
      totalAssets: 1,
      totalErrors: 0,
      totalResponses: 1,
      statusCodes: {
        "200": 1,
      },
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

    for (const parts of Object.values(partBuffers)) {
      for (const part of parts) {
        archive.append(part.buffer, { name: part.path });
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
