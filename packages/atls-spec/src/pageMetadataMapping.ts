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
 *
 * Page Metadata Record Mapping
 * ============================
 *
 * This module is the single source of truth for the mapping between the
 * on-disk page_metadata dataset format and the flat consumer API surface.
 *
 * ## Three shapes and their roles
 *
 * 1. **PageMetadataDatasetRecordV1** (producer / on-disk)
 *    Schema: `PageMetadataDatasetRecordV1Schema` in `cartographer-datasets.schema.ts`
 *    Shape: Nested — fields grouped under `core`, `indexing`, `social`, `resourceHints`.
 *    Written by: `ArtifactWriter.buildPageMetadataRecord()` in cartographer.
 *    Validated by: `SchemaValidator.validatePageMetadata()` on the write path.
 *    This is what lives in `page_metadata/*.jsonl.zst` inside `.atls` archives.
 *
 * 2. **FlatPageMetadata** (consumer / SDK output)
 *    Defined below in this file.
 *    Shape: Flat — all fields at the top level, matching what downstream apps expect.
 *    Produced by: `flattenPageMetadataRecord()` adapter in this module.
 *    Consumers: app-foundation, Horizon, any SDK user calling `readers.pageMetadata()`.
 *
 * 3. **PageRecord** interface (in-memory composite)
 *    Defined in `types.ts`.
 *    Shape: Flat, ~200 fields drawn from *multiple* datasets (page_metadata, navigation,
 *    content, assets, performance, etc.). This is the in-memory working type used by the
 *    crawl engine during processing. It is NOT what any single dataset contains on disk.
 *
 * ## Architectural decision: flatten in the SDK
 *
 * The nested storage format is the correct on-disk representation:
 *   - It groups related metadata semantically (core SEO fields, indexing directives, social tags).
 *   - It is already in production archives and changing it would be a breaking format change.
 *   - Extractors emit structured objects naturally; forcing flat output couples extractor
 *     internals to the consumer API surface.
 *
 * The SDK is responsible for flattening on read:
 *   - Consumers get a predictable flat shape without needing to know the storage layout.
 *   - The adapter is centralized here — one place to update when fields are added.
 *   - The tradeoff is that the SDK carries adapter complexity, but this is a thin transform.
 *
 * ## Field mapping (nested → flat)
 *
 * | Nested path                          | Flat field             | Notes                              |
 * |--------------------------------------|------------------------|------------------------------------|
 * | `.pageId`                            | `pageId`               | Pass-through                       |
 * | `.url`                               | `url`                  | Pass-through                       |
 * | `.capturedAt`                        | `capturedAt`           | Pass-through                       |
 * | `.core.title`                        | `title`                |                                    |
 * | `.core.titleLength`                  | `titleLength`          |                                    |
 * | `.core.metaDescription`              | `metaDescription`      |                                    |
 * | `.core.descriptionLength`            | `descriptionLength`    |                                    |
 * | `.core.h1`                           | `h1`                   |                                    |
 * | `.core.canonicalTag`                 | `canonicalTag`         |                                    |
 * | `.core.language`                     | `language`             |                                    |
 * | `.core.charset`                      | `charset`              |                                    |
 * | `.core.favicon`                      | `favicon`              |                                    |
 * | `.core.viewport`                     | `viewport`             |                                    |
 * | `.core.themeColor`                   | `themeColor`           |                                    |
 * | `.core.generator`                    | `generator`            |                                    |
 * | `.indexing.robotsMeta`               | `robotsMeta`           |                                    |
 * | `.indexing.xRobotsTag`               | `xRobotsTag`           |                                    |
 * | `.indexing.robotsDirectives`         | `robotsDirectives`     | Entire sub-object preserved        |
 * | `.social.openGraph`                  | `openGraph`            | Record<string, string | null>      |
 * | `.social.twitterCard`               | `twitterCard`          | Record<string, string | null>      |
 * | `.resourceHints`                     | `resourceHints`        | Entire sub-object preserved        |
 *
 * Any extra fields added via `.passthrough()` on `core` or `indexing` are spread
 * into the flat output at the top level.
 */

import type { PageMetadataDatasetRecordV1 } from "./schemas/cartographer-datasets.schema.js";
import type { ScreenshotReference } from "./types.js";

/**
 * Flat representation of a page_metadata record, as returned to SDK consumers.
 *
 * This is the consumer-facing shape produced by `flattenPageMetadataRecord()`.
 * It corresponds 1:1 to the nested `PageMetadataDatasetRecordV1` storage format
 * via the mapping documented above.
 */
export interface FlatPageMetadata {
  // ── Identity ──
  pageId: string;
  url: string;
  capturedAt: string;

  // ── Core (from .core) ──
  title?: string;
  titleLength?: number;
  metaDescription?: string;
  descriptionLength?: number;
  h1?: string;
  canonicalTag?: string;
  canonicalResolved?: string;
  language?: string;
  charset?: string;
  favicon?: string;
  viewport?: string;
  themeColor?: string;
  generator?: string;

  // ── Indexing (from .indexing) ──
  robotsMeta?: string;
  xRobotsTag?: string;
  robotsDirectives?: {
    noindex?: boolean;
    nofollow?: boolean;
    noarchive?: boolean;
    nosnippet?: boolean;
    noimageindex?: boolean;
    unavailableAfter?: string;
  };

  // ── Social (from .social) ──
  openGraph?: Record<string, string | null>;
  twitterCard?: Record<string, string | null>;

  // ── Resource hints (from .resourceHints) ──
  resourceHints?: {
    preload?: string[];
    prefetch?: string[];
    preconnect?: string[];
    dnsPrefetch?: string[];
  };

  // ── Media (top-level pass-through). Screenshot refs stay a string or a tiled manifest.
  media?: {
    screenshots?: {
      desktop?: ScreenshotReference;
      mobile?: ScreenshotReference;
      desktopFullPage?: ScreenshotReference;
      mobileFullPage?: ScreenshotReference;
    };
    favicon?: string;
  };

  // ── Capture quality (top-level pass-through from storage) ──
  capture_degraded?: boolean;
  degraded_reason?: string;
  limits?: {
    requestsCapped?: boolean;
    maxRequestsPerPage?: number;
    bytesCapped?: boolean;
    maxBytesPerPage?: number;
    assetsTruncated?: boolean;
    maxAssetsPerPage?: number;
    structuredDataTruncated?: boolean;
    maxStructuredDataItems?: number;
    totalRequests?: number;
    totalBytes?: number;
  };

  // BUG-0133: the former `[key: string]: unknown` index signature is GONE —
  // it erased compile-time safety (any typo'd property access compiled).
  // Passthrough extras from core/indexing are still present at runtime; read
  // them via an explicit cast, e.g. `(flat as FlatPageMetadataWithExtras).x`.
}

/**
 * FlatPageMetadata plus the runtime passthrough extras. Use this (explicitly)
 * when reading non-schema fields; the base type stays typo-safe.
 */
export type FlatPageMetadataWithExtras = FlatPageMetadata & Record<string, unknown>;

/**
 * BUG-0133: thrown when a record handed to `flattenPageMetadataRecord()` is
 * neither nested-shaped nor a plausible flat page_metadata record — previously
 * such garbage was cast straight through as `FlatPageMetadata`.
 */
export class PageMetadataShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageMetadataShapeError";
  }
}

/**
 * Flatten a nested page_metadata dataset record into the flat consumer shape.
 *
 * This is the single adapter between the on-disk storage format and the SDK
 * consumer API. All SDK read paths for page_metadata should use this function.
 *
 * The adapter is defensive: if the record is already flat (no `core`/`indexing`/
 * `social` nested objects), it is returned as-is. This ensures backward
 * compatibility with archives produced before the nested format was adopted.
 *
 * @param record - A page_metadata record (nested or flat) as stored on disk.
 * @returns A `FlatPageMetadata` with all fields promoted to the top level.
 */
export function flattenPageMetadataRecord(
  record: PageMetadataDatasetRecordV1 | Record<string, unknown>,
): FlatPageMetadata {
  const raw = record as Record<string, unknown>;

  // Detect nested format by checking for the `core` nested object
  const hasNestedShape = raw.core != null && typeof raw.core === "object" && !Array.isArray(raw.core);

  if (!hasNestedShape) {
    // BUG-0133: the flat-passthrough branch used to cast ANY object straight
    // through — `{foo: 1}` became a "FlatPageMetadata". Require the identity
    // core (pageId/page_id + url) before passing a legacy flat record along.
    const pageId = raw.pageId ?? raw.page_id;
    if (typeof pageId !== "string" || typeof raw.url !== "string") {
      throw new PageMetadataShapeError(
        "flattenPageMetadataRecord: record is neither nested-shaped (no core object) nor a flat page_metadata record (missing string pageId/url)"
      );
    }
    // Legacy flat record (pre-nested-format archive) — pass through as-is.
    return raw as unknown as FlatPageMetadata;
  }

  const { core, indexing, social, resourceHints, ...topLevel } =
    record as PageMetadataDatasetRecordV1;

  // Destructure known core fields; rest captures passthrough extras
  const {
    title,
    titleLength,
    metaDescription,
    descriptionLength,
    h1,
    canonicalTag,
    canonicalResolved,
    language,
    charset,
    favicon,
    viewport,
    themeColor,
    generator,
    ...coreExtra
  } = core;

  // Destructure known indexing fields; rest captures passthrough extras
  const indexingFields = indexing ?? {};
  const {
    robotsMeta,
    xRobotsTag,
    robotsDirectives,
    ...indexingExtra
  } = indexingFields as typeof indexing;

  return {
    ...topLevel,
    // Core metadata
    title,
    titleLength,
    metaDescription,
    descriptionLength,
    h1,
    canonicalTag,
    canonicalResolved,
    language,
    charset,
    favicon,
    viewport,
    themeColor,
    generator,
    // Core passthrough extras
    ...coreExtra,
    // Indexing metadata
    robotsMeta,
    xRobotsTag,
    robotsDirectives,
    // Indexing passthrough extras
    ...indexingExtra,
    // Social metadata
    openGraph: social?.openGraph,
    twitterCard: social?.twitterCard,
    // Resource hints (preserved as sub-object)
    resourceHints,
  };
}
