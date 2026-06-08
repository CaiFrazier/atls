/**
 * Copyright © 2025 Cai Frazier.
 * Runtime validation schemas for core Atlas datasets.
 */

import { z } from "zod";
import { ResponseRecordV1Schema } from "./responses.schema.js";
import { DOMSnapshotRecordV1Schema } from "./dom_snapshot.schema.js";

const RenderModeEnum = z.enum(["raw", "import", "prerender", "full"]);
const NavEndReasonEnum = z.enum(["fetch", "load", "networkidle", "timeout", "error"]);
const EdgeLocationEnum = z.enum(["nav", "header", "footer", "aside", "main", "other", "unknown"]);
const AssetTypeEnum = z.enum(["image", "video", "audio", "document"]);
const LazyStrategyEnum = z.enum(["native", "intersection-observer", "data-src", "none"]);
const LinkTypeEnum = z.enum([
  "navigation",
  "content",
  "action",
  "footer",
  "breadcrumb",
  "pagination",
  "skip",
  "social",
  "download",
  "external",
  "related",
  "tag",
  "author",
  "other",
]);
import { JsonValueSchema } from './json-value.schema.js';

const SrcsetCandidateSchema = z.object({
  url: z.string().min(1),
  descriptor: z.string().min(1),
  width: z.number().optional(),
  density: z.number().optional(),
});

const PictureSourceSchema = z.object({
  srcset: z.string().min(1),
  media: z.string().optional(),
  type: z.string().optional(),
});

const PictureContextSchema = z.object({
  has_picture_parent: z.boolean(),
  source_count: z.number().int().nonnegative(),
  sources: z.array(PictureSourceSchema).optional(),
});

const TrackSchema = z.object({
  kind: z.string().min(1),
  src: z.string().min(1),
  srclang: z.string().optional(),
  label: z.string().optional(),
});

const SourceSchema = z.object({
  src: z.string().min(1),
  type: z.string().optional(),
});

const ScreenshotTileSchema = z.object({
  src: z.string().min(1),
  height: z.number().nonnegative(),
  width: z.number().nonnegative(),
  y: z.number().nonnegative(),
  path: z.string().optional(),
});

/**
 * Runtime validation schema for the in-memory composite PageRecord.
 *
 * This validates the ~20 core required fields of the flat PageRecord type built
 * by PageRecordBuilder during crawl execution. It uses `.passthrough()` to allow
 * the ~200 additional optional fields that come from various extractors.
 *
 * WARNING: This is NOT the on-disk page_metadata dataset schema. The page_metadata
 * dataset uses a nested format (PageMetadataDatasetRecordV1Schema). For on-disk
 * validation, use PageMetadataRecordV1Schema or PageMetadataDatasetRecordV1Schema.
 *
 * For flattening on-disk records to the consumer API shape, use
 * `flattenPageMetadataRecord()` from `pageMetadataMapping.ts`.
 */
export const PageRecordSchema = z
  .object({
    page_id: z.string().uuid(),
    url: z.string().url(),
    normalizedUrl: z.string().url(),
    finalUrl: z.string().url(),
    urlKey: z.string().min(1),
    origin: z.string().url(),
    pathname: z.string().min(1),
    section: z.string().min(1),
    statusCode: z.number().int().min(100).max(599),
    headings: z.array(z.object({ level: z.number().int(), text: z.string() })),
    rawHtmlHash: z.string().min(1),
    textSample: z.string(),
    fetchedAt: z.string().min(1),
    renderMode: RenderModeEnum,
    navEndReason: NavEndReasonEnum,
    internalLinksCount: z.number().int().nonnegative(),
    externalLinksCount: z.number().int().nonnegative(),
    mediaAssetsCount: z.number().int().nonnegative(),
    mediaAssetsTruncated: z.boolean(),
    hreflangLinks: z.array(z.object({ lang: z.string(), url: z.string().url() })),
    depth: z.number().int().nonnegative(),
    discoveredInMode: RenderModeEnum,
  })
  .passthrough();

export const EdgeRecordSchema = z
  .object({
    source_page_id: z.string().uuid().optional(),
    target_page_id: z.string().uuid().optional(),
    sourceUrl: z.string().url(),
    targetUrl: z.string().url(),
    normalizedSourceUrl: z.string().url().optional(),
    normalizedTargetUrl: z.string().url().optional(),
    anchorText: z.string(),
    rel: z.string().optional(),
    nofollow: z.boolean(),
    sponsored: z.boolean().optional(),
    ugc: z.boolean().optional(),
    isExternal: z.boolean(),
    location: EdgeLocationEnum,
    selectorHint: z.string().optional(),
    discoveredInMode: RenderModeEnum,
    httpStatusAtTo: z.number().int().optional(),
    link_type: LinkTypeEnum.optional(),
    target_attr: z.string().optional(),
    title_attr: z.string().optional(),
    download_attr: z.union([z.string(), z.boolean()]).optional(),
    hreflang: z.string().optional(),
    type_attr: z.string().optional(),
    aria_label: z.string().optional(),
    role: z.string().optional(),
    is_primary_nav: z.boolean().optional(),
    is_breadcrumb: z.boolean().optional(),
    is_skip_link: z.boolean().optional(),
    is_pagination: z.boolean().optional(),
  })
  .passthrough();

export const AssetRecordSchema = z
  .object({
    page_id: z.string().uuid(),
    asset_id: z.string().min(1),
    pageUrl: z.string().url(),
    assetUrl: z.string().url(),
    type: AssetTypeEnum,
    alt: z.string().optional(),
    hasAlt: z.boolean(),
    naturalWidth: z.number().optional(),
    naturalHeight: z.number().optional(),
    displayWidth: z.number().optional(),
    displayHeight: z.number().optional(),
    estimatedBytes: z.number().optional(),
    visible: z.union([z.boolean(), z.null()]),
    inViewport: z.union([z.boolean(), z.null()]),
    loading: z.string().optional(),
    wasLazyLoaded: z.boolean(),
    srcset: z.string().optional(),
    srcset_candidates: z.array(SrcsetCandidateSchema).optional(),
    sizes: z.string().optional(),
    picture_context: PictureContextSchema.optional(),
    duration: z.number().optional(),
    mime_type: z.string().optional(),
    has_controls: z.boolean().optional(),
    autoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    preload: z.string().optional(),
    poster: z.string().optional(),
    tracks: z.array(TrackSchema).optional(),
    sources: z.array(SourceSchema).optional(),
    lazy_strategy: LazyStrategyEnum.optional(),
    lazy_data_attrs: z.record(z.string()).optional(),
    lazy_classes: z.array(z.string()).optional(),
    occurrence_count: z.number().int().min(1).optional(),
    resource_hint: z.object({
      res_id: z.string().uuid(),
      body_blob_ref: z.string().optional(),
      size_bytes: z.number().int().nonnegative().optional(),
    }).optional(),
    tiles: z.array(ScreenshotTileSchema).optional(),
  })
  .passthrough();

export const ErrorRecordSchema = z
  .object({
    url: z.string().url(),
    origin: z.string(),
    hostname: z.string(),
    occurredAt: z.string().min(1),
    phase: z.enum(["fetch", "render", "extract", "write"]),
    code: z.string().optional(),
    message: z.string(),
    stack: z.string().optional(),
    details: z.record(JsonValueSchema).optional(),
  })
  .passthrough();

export const ResponseRecordSchema = ResponseRecordV1Schema.passthrough();
export const DOMSnapshotRecordSchema = DOMSnapshotRecordV1Schema.passthrough();
