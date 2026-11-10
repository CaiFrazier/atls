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
 * Atlas type definitions
 * 
 * Core types for Atlas archive specification.
 * Used by both the Cartographer engine and Atlas SDK.
 */
import type { DOMSnapshotRecordV1, ResponseRecordV1, SitemapDatasetRecordV1, SitemapUrlDatasetRecordV1, ExtractionDatasetRecordV1, PipelineFailureRecordV1, AccessibilityDatasetRecordV1, EventRecordV1, AssetRecordV1, SecurityFormV1 } from "./schemas/index.js";

/** B2 (W7 2a) — per-form submission-security facts. See SecurityFormV1Schema. */
export type SecurityFormRecord = SecurityFormV1;
import {
  AssetRecordSchema,
  DOMSnapshotRecordSchema,
  EdgeRecordSchema,
  ErrorRecordSchema,
  PageRecordSchema,
  ResponseRecordSchema,
} from "./schemas/runtime-core.schema.js";

// ============================================================================
// Enum Codification
// ============================================================================

/**
 * Render modes define the level of JavaScript execution during crawling.
 * 
 * - raw: No JavaScript execution, HTML only
 * - prerender: Wait for page load event
 * - full: Wait for network idle + run accessibility audits
 */
export const RenderMode = {
  /** No JavaScript execution, HTML only */
  RAW: 'raw' as const,
  /** Imported from external source (e.g. WARC) */
  IMPORT: 'import' as const,
  /** Wait for page load event */
  PRERENDER: 'prerender' as const,
  /** Wait for network idle + run accessibility audits */
  FULL: 'full' as const,
  /** All valid render mode values */
  values: ['raw', 'import', 'prerender', 'full'] as const,
  /** Human-readable descriptions */
  descriptions: {
    raw: 'No JavaScript execution, HTML only',
    import: 'Imported from external source',
    prerender: 'Wait for page load event',
    full: 'Wait for network idle + run accessibility audits'
  }
} as const;

export type RenderMode = typeof RenderMode.values[number];

export type DeviceProfile = "native" | "desktop" | "mobile";

/**
 * Type guard for RenderMode validation
 */
export function isRenderMode(value: unknown): value is RenderMode {
  return typeof value === 'string' && (RenderMode.values as readonly string[]).includes(value);
}

/**
 * Navigation end reasons document why page navigation completed.
 * 
 * - fetch: Response received but not processed
 * - load: DOMContentLoaded event fired
 * - networkidle: Network idle (2 connections for 500ms)
 * - timeout: Navigation timeout exceeded
 * - error: Navigation error occurred
 */
export const NavEndReason = {
  /** Response received but not processed */
  FETCH: 'fetch' as const,
  /** DOMContentLoaded event fired */
  LOAD: 'load' as const,
  /** Network idle (2 connections for 500ms) */
  NETWORKIDLE: 'networkidle' as const,
  /** Navigation timeout exceeded */
  TIMEOUT: 'timeout' as const,
  /** Navigation error occurred */
  ERROR: 'error' as const,
  /** All valid navigation end reasons */
  values: ['fetch', 'load', 'networkidle', 'timeout', 'error'] as const,
  /** Human-readable descriptions */
  descriptions: {
    fetch: 'Response received but not processed',
    load: 'DOMContentLoaded event fired',
    networkidle: 'Network idle (2 connections for 500ms)',
    timeout: 'Navigation timeout exceeded',
    error: 'Navigation error occurred'
  }
} as const;

export type NavEndReason = typeof NavEndReason.values[number];

/**
 * Type guard for NavEndReason validation
 */
export function isNavEndReason(value: unknown): value is NavEndReason {
  return typeof value === 'string' && (NavEndReason.values as readonly string[]).includes(value);
}

/**
 * Edge locations indicate where in the DOM a link was discovered.
 * Used for link context and navigation pattern analysis.
 * 
 * - nav: Navigation menu (<nav> element)
 * - header: Page header
 * - footer: Page footer
 * - aside: Sidebar or aside content
 * - main: Main content area
 * - other: Other semantic location
 * - unknown: Location could not be determined
 */
export const EdgeLocation = {
  /** Navigation menu (<nav> element) */
  NAV: 'nav' as const,
  /** Page header */
  HEADER: 'header' as const,
  /** Page footer */
  FOOTER: 'footer' as const,
  /** Sidebar or aside content */
  ASIDE: 'aside' as const,
  /** Main content area */
  MAIN: 'main' as const,
  /** Other semantic location */
  OTHER: 'other' as const,
  /** Location could not be determined */
  UNKNOWN: 'unknown' as const,
  /** All valid edge locations */
  values: ['nav', 'header', 'footer', 'aside', 'main', 'other', 'unknown'] as const,
  /** Human-readable descriptions */
  descriptions: {
    nav: 'Navigation menu (<nav> element)',
    header: 'Page header',
    footer: 'Page footer',
    aside: 'Sidebar or aside content',
    main: 'Main content area',
    other: 'Other semantic location',
    unknown: 'Location could not be determined'
  }
} as const;

export type EdgeLocation = typeof EdgeLocation.values[number];

/**
 * Type guard for EdgeLocation validation
 */
export function isEdgeLocation(value: unknown): value is EdgeLocation {
  return typeof value === 'string' && (EdgeLocation.values as readonly string[]).includes(value);
}

/**
 * Link type classification for semantic link analysis
 */
export const LinkType = {
  values: [
    'navigation',   // Primary/secondary navigation links
    'content',      // In-content editorial links
    'action',       // CTAs, buttons styled as links
    'footer',       // Footer utility links
    'breadcrumb',   // Breadcrumb navigation
    'pagination',   // Next/prev/page number links
    'skip',         // Skip-to-content accessibility links
    'social',       // Social media links
    'download',     // File download links
    'external',     // Explicitly marked external links
    'related',      // Related content/suggestions
    'tag',          // Tag/category links
    'author',       // Author profile links
    'other'         // Other/unclassified
  ] as const,
  descriptions: {
    navigation: 'Primary or secondary navigation link',
    content: 'In-content editorial link',
    action: 'Call-to-action or button-styled link',
    footer: 'Footer utility link',
    breadcrumb: 'Breadcrumb navigation link',
    pagination: 'Pagination control link',
    skip: 'Skip-to-content accessibility link',
    social: 'Social media link',
    download: 'File download link',
    external: 'Explicitly marked external link',
    related: 'Related content or suggestion',
    tag: 'Tag or category link',
    author: 'Author profile link',
    other: 'Other or unclassified link'
  }
} as const;

export type LinkType = typeof LinkType.values[number];

/**
 * Type guard for LinkType validation
 */
export function isLinkType(value: unknown): value is LinkType {
  return typeof value === 'string' && (LinkType.values as readonly string[]).includes(value);
}

/**
 * Parameter policies control URL query parameter handling.
 * 
 * - sample: Keep only first occurrence of each parameter
 * - strip: Remove all query parameters
 * - keep: Preserve all parameters
 */
export const ParamPolicy = {
  /** Keep only first occurrence of each parameter */
  SAMPLE: 'sample' as const,
  /** Remove all query parameters */
  STRIP: 'strip' as const,
  /** Preserve all parameters */
  KEEP: 'keep' as const,
  /** All valid parameter policies */
  values: ['sample', 'strip', 'keep'] as const,
  /** Human-readable descriptions */
  descriptions: {
    sample: 'Keep only first occurrence of each parameter',
    strip: 'Remove all query parameters',
    keep: 'Preserve all parameters'
  }
} as const;

export type ParamPolicy = typeof ParamPolicy.values[number];

/**
 * Type guard for ParamPolicy validation
 */
export function isParamPolicy(value: unknown): value is ParamPolicy {
  return typeof value === 'string' && (ParamPolicy.values as readonly string[]).includes(value);
}

/**
 * Detected technology/tool on a page
 */
export interface Technology {
  name: string;
  version?: string;
  categories?: string[];
}

export interface AtlasStructuredDataSourceMeta {
  tag: string;
  position: number;
  location?: "head" | "body" | "unknown";
  selector?: string;
  attributes?: Record<string, string>;
}

export interface AtlasStructuredDataValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  path?: string;
  type?: string;
  itemId?: string;
}

export interface AtlasStructuredDataDiagnostic {
  id: string;
  itemId: string;
  entityId?: string;
  plane: "capture" | "syntax" | "schema_org" | "consumer_profile";
  code: string;
  level: "error" | "warning" | "info";
  certainty: "definite" | "heuristic";
  path: string;
  property?: string;
  expectedTypes?: string[];
  actualKind?: string;
  actualTypes?: string[];
  message: string;
}

export interface AtlasSchemaOrgAudit {
  engineVersion: number;
  vocabularyVersion: string;
  vocabularySourceUrl: string;
  vocabularyReleasedAt: string;
  vocabularySha256: string;
  outcome: "no_findings" | "findings" | "not_applicable";
  coverage: "complete" | "partial" | "unavailable";
  diagnosticCounts: {
    error: number;
    warning: number;
    info: number;
  };
  diagnostics: AtlasStructuredDataDiagnostic[];
}

export interface AtlasSchemaTypeTreeNode {
  type: string;
  count: number;
  children?: AtlasSchemaTypeTreeNode[];
}

export interface AtlasStructuredDataLimits {
  maxItems: number;
  maxItemBytes: number;
  maxTotalBytes: number;
  totalBytesCaptured: number;
  truncatedItems: number;
  limitHit: boolean;
}

export type AtlasRelevanceReason = "schema_type_match";

export interface AtlasRelevanceAssessment {
  relevant: boolean;
  reasons: AtlasRelevanceReason[];
  matched_types: string[];
}

export interface AtlasEvictedItemRecord {
  item_id: string;
  schema_types: string[];
  format: "json-ld" | "microdata" | "opengraph" | "twittercard" | "rdfa";
  bytes: number;
  reason: "evicted_for_relevant" | "budget_exceeded_no_room";
}

export interface AtlasStructuredDataEviction {
  evicted_items: AtlasEvictedItemRecord[];
  eviction_reason: "budget_exceeded";
  budget_limit: number;
  candidate_count: number;
}

export interface AtlasStructuredDataItem {
  id: string;
  type: "json-ld" | "microdata" | "opengraph" | "twittercard" | "rdfa";
  schemaType?: string;
  schemaTypes?: string[];
  data: Record<string, unknown>;
  bytes: number;
  truncated?: boolean;
  graphPointer?: string;
  diagnosticIds?: string[];
  validation?: AtlasStructuredDataValidationIssue[];
  source?: AtlasStructuredDataSourceMeta;
  provenance?: {
    url: string;
  };
  relevance?: AtlasRelevanceAssessment;
  rawText?: string;
}

export interface AtlasPageStructuredData {
  raw: AtlasStructuredDataItem[];
  relevant: AtlasStructuredDataItem[];
  schemaTypes?: string[];
  schemaTypeTree?: AtlasSchemaTypeTreeNode[];
  validationIssues?: AtlasStructuredDataValidationIssue[];
  captureIssues?: AtlasStructuredDataDiagnostic[];
  schemaOrgAudit?: AtlasSchemaOrgAudit;
  hasJsonLd?: boolean;
  hasMicrodata?: boolean;
  hasRdfa?: boolean;
  hasOpenGraph?: boolean;
  hasTwitterCard?: boolean;
  limits?: AtlasStructuredDataLimits;
  eviction?: AtlasStructuredDataEviction;
}

export interface ScreenshotTile {
  src: string;   // Relative path within the archive
  height: number;
  width: number;
  y: number;     // Vertical offset in pixels
  path?: string; // Legacy key (path) accepted for backward compatibility
}

export type ScreenshotReference =
  | string
  | {
      src?: string;
      tiles?: ScreenshotTile[];
      totalHeight?: number;
      totalWidth?: number;
    };

export interface PageResponseHeaders {
  // Content headers
  content_type?: string;           // Full Content-Type header value
  content_length?: number;         // Response size in bytes
  content_encoding?: string;       // gzip, br, deflate, etc.
  // Caching headers
  cache_control?: string;          // Cache-Control directives
  expires?: string;                // Expires header (ISO timestamp)
  etag?: string;                   // Entity tag for caching
  last_modified?: string;          // Last-Modified header (ISO timestamp)
  age?: number;                    // Age header (seconds)
  // CDN & Server identification
  server?: string;                 // Server header (nginx, Apache, etc.)
  x_powered_by?: string;           // X-Powered-By header (PHP, ASP.NET, etc.)
  via?: string;                    // Via header (proxy/CDN chain)
  x_cache?: string;                // X-Cache header (HIT, MISS, etc.)
  cf_cache_status?: string;        // Cloudflare cache status
  x_amz_cf_id?: string;            // AWS CloudFront request ID
  x_cdn_provider?: string;         // Detected CDN provider
  // Security headers (already in securityHeaders, but kept here for completeness)
  strict_transport_security?: string;
  content_security_policy?: string;
  x_frame_options?: string;
  x_content_type_options?: string;
  referrer_policy?: string;
  permissions_policy?: string;
  // Additional useful headers
  vary?: string;                   // Vary header (affects caching)
  pragma?: string;                 // Legacy cache control
  date?: string;                   // Server date (ISO timestamp)
  connection?: string;             // Connection header
  transfer_encoding?: string;      // chunked, compress, etc.
}

export interface PageCDNIndicators {
  detected: boolean;               // True if CDN was detected
  provider?: string | null;        // cloudflare, fastly, cloudfront, akamai, etc.
  confidence: "high" | "medium" | "low";  // Detection confidence
  signals: string[];               // Array of detection signals (header names, IP ranges, etc.)
}

export interface PageCompressionDetails {
  algorithm?: "gzip" | "br" | "deflate" | "none";  // Compression algorithm used
  original_size?: number;          // Uncompressed size (if available)
  compressed_size?: number;        // Compressed size from Content-Length
  compression_ratio?: number;      // original_size / compressed_size (if calculable)
  supports_brotli?: boolean;       // Server advertises Brotli support
}

/**
 * PageRecord - Complete page crawl data
 */
export interface PageRecord {
  // === STABLE IDENTIFIER ===
  page_id?: string; // UUID v7 (time-ordered, globally unique) - Optional for backward compat
  pageId?: string; // Camel-case alias for consumer ergonomics
  
  url: string;
  requestedUrl?: string;
  finalUrl: string;
  normalizedUrl: string;
  urlKey: string; // SHA-1 hash of normalizedUrl
  origin: string;
  pathname: string;
  section: string; // Leading "/" + first path segment with trailing slash (e.g., "/products/")
  statusCode: number;
  contentType?: string;
  fetchedAt: string; // ISO timestamp
  redirectChain?: string[];
  redirectChainLength?: number;
  redirectLoopDetected?: boolean;
  redirectHops?: Array<{
    from: string;
    to: string;
    statusCode: number;
    redirectType?: string;
  }>;
  
  // Title and meta
  title?: string;
  metaDescription?: string;
  h1?: string;
  headings: { level: number; text: string }[];
  
  // Social metadata (top-level fields for easy access)
  openGraph?: Record<string, string | undefined>; // OpenGraph metadata (og:title, og:description, etc.)
  twitterCard?: Record<string, string | undefined>; // Twitter Card metadata (twitter:card, twitter:title, etc.)
  technologies?: Technology[]; // Detected technologies (alternative field name to techStack)
  
  // Canonical and robots
  canonicalHref?: string; // Verbatim from href attribute
  canonicalResolved?: string; // Absolute URL
  canonical?: string; // For backwards compatibility (same as canonicalResolved)
  robotsMeta?: string;
  robotsHeader?: string;
  noindexSurface?: string; // "meta" | "header" | "both" if noindex detected
  indexabilityIssues?: string[]; // Codes describing why indexing may be blocked (noindex, robots, HTTP status)
  
  // Hashing and content
  rawHtmlHash: string; // SHA-256 of raw HTTP body
  domHash?: string; // SHA-256 of document.documentElement.outerHTML (only if rendered)
  contentHash?: string; // SHA-256 of normalized text content (for change detection)
  contentSimHash?: string; // 64-bit simhash of normalized text
  similarityScore?: number; // 0-1 similarity to nearest page in crawl
  nearDuplicateOf?: string; // URL of nearest near-duplicate page (if similarity high)
  duplicateTitleOf?: string; // URL of page sharing same title
  duplicateMetaDescriptionOf?: string; // URL of page sharing same meta description
  boilerplateRatio?: number; // 0-1 ratio of repeated content (1-uniqueRatio)
  page_simhash?: string; // The simhash used in comparison (hex), same as contentSimHash
  comparison_candidate_count?: number; // How many candidates were compared against (0 if none)
  similarity_threshold?: number; // Threshold used for nearDuplicateOf decision
  title_comparison_threshold?: number; // Threshold used for duplicateTitleOf (1.0 = exact match)
  meta_description_comparison_threshold?: number; // Threshold used for duplicateMetaDescriptionOf (1.0 = exact match)
  textSample: string; // First 1500 bytes of body.innerText, whitespace collapsed
  
  // Temporal tracking
  previous_page_id?: string; // page_id from previous crawl (for re-crawl diffing)
  previousPageId?: string;
  content_changed?: boolean; // Did content change since last crawl?
  contentChanged?: boolean;
  dom_changed?: boolean; // Did DOM change since last crawl?
  domChanged?: boolean;
  
  // Response metadata
  response_headers?: PageResponseHeaders;
  responseHeaders?: PageResponseHeaders;
  
  cdn_indicators?: PageCDNIndicators;
  cdnIndicators?: PageCDNIndicators;
  
  compression_details?: PageCompressionDetails;
  compressionDetails?: PageCompressionDetails;

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
  
  // Detailed timing breakdown
  timing?: {
    fetch_started_at?: string;    // ISO timestamp when fetch began
    fetch_completed_at?: string;  // ISO timestamp when fetch completed
    render_started_at?: string;   // ISO timestamp when render began (if mode != raw)
    render_completed_at?: string; // ISO timestamp when render completed (if mode != raw)
  };
  
  // Render timing
  wait_condition?: "domcontentloaded" | "networkidle0" | "networkidle2" | "load" | "smart_idle";
  timings?: {
    nav_start: number;              // Performance.timeOrigin
    dom_content_loaded?: number;    // DOMContentLoaded timestamp
    load_event_end?: number;        // Load event timestamp
    network_idle_reached?: number;  // Network idle timestamp (if applicable)
    first_paint?: number;           // First Paint (if available)
    first_contentful_paint?: number; // FCP (if available)
  };
  
  // Render info
  renderMode: RenderMode;
  render_status?: "ok" | "ok_with_timeout" | "failed"; // Indicates whether soft idle heuristics completed
  renderMs?: number;
  fetchMs?: number;
  navEndReason: NavEndReason;
  throttling?: {
    cpuSlowdownMultiplier?: number | null;
    networkConditions?: "none" | "mobile-4g" | "mobile-3g" | "mobile-2g" | "slow-2g";
    cdpUnavailableReason?: string;
  };
  challengePageCaptured?: boolean; // True if this is a challenge page (content not reliable)
  capture_degraded?: boolean;
  degraded_reason?: string;
  
  // Pipeline result — factual record of what the pipeline observed for this page
  pipeline_result?: {
    /** Pipeline outcome status: what happened at processing time */
    status: "success" | "partial_success" | "quarantined";
    /** Last pipeline phase completed before the page was written */
    stage_reached: "fetch" | "render" | "extract" | "write";
    /** Factual observations about pipeline execution (e.g., "render_timeout", "capture_degraded", "assets_truncated", "schema_nonconformant") */
    observations?: string[];
    /** Datasets that failed schema validation and were written to the quarantine dataset */
    quarantined_datasets?: string[];
  };

  // Links and assets (counts only in PageRecord, full data in EdgeRecord/AssetRecord)
  internalLinksCount: number;
  externalLinksCount: number;
  mediaAssetsCount: number;
  mediaAssetsTruncated: boolean; // True if > 1000 assets
  
  // Hreflang
  hreflangLinks: Array<{ lang: string; url: string }>;
  
  // Depth and discovery
  depth: number;
  discoveredFrom?: string; // URL that linked to this page
  discoveredInMode: RenderMode;
  
  // Basic flags
  basicFlags?: {
    hasTitle: boolean;
    hasMetaDescription: boolean;
    hasH1: boolean;
    hasCanonical: boolean;
  };
  
  // Technical (all modes)
  securityHeaders?: {
    "content-security-policy"?: string;
    "strict-transport-security"?: string;
    "x-frame-options"?: string;
    "x-content-type-options"?: string;
    "referrer-policy"?: string;
    "permissions-policy"?: string;
  };
  faviconUrl?: string;
  
  // Content & Encoding
  encoding?: {
    encoding: string;
    source: "meta" | "header" | "detected";
  };
  compression?: {
    compression?: "gzip" | "brotli" | "deflate" | "none" | string;
    contentEncoding?: string;
  };
  
  // Resource Counts
  resourceCounts?: {
    cssCount: number;
    jsCount: number;
    fontCount: number;
    inlineStyles: number;
    inlineScripts: number;
  };
  
  // Mobile & Viewport
  viewportMeta?: {
    content: string;
    width?: string;
    initialScale?: number;
    hasViewport: boolean;
  };
  
  // Security & Best Practices
  mixedContentIssues?: Array<{
    assetUrl: string;
    type: "script" | "stylesheet" | "image" | "video" | "audio" | "iframe" | "other";
  }>;
  subresourceIntegrity?: {
    totalScripts: number;
    totalStyles: number;
    scriptsWithSRI: number;
    stylesWithSRI: number;
    missingResources?: Array<{url: string; type: "script" | "stylesheet"}>;
  };
  // B2 (W7 2a): per-form submission-security facts (raw → writer carrier).
  forms?: SecurityFormRecord[];

  // SEO & Tech (prerender/full modes only)
  structuredData?: AtlasPageStructuredData;
  techStack?: string[]; // Detected technologies: ["React", "WordPress", etc.]
  
  // SEO Quick Wins (data collection)
  seo?: {
    sitemap?: {
      hasSitemap: boolean;
      sitemapUrls: string[]; // Found via robots.txt or common locations
      isInSitemap?: boolean; // True if this page URL was found in a sitemap
    };
    brokenLinksCount?: number; // Count of outbound links with HTTP >= 400
    outboundDomains?: string[]; // Unique external domains linked from this page
  };
  
  // Performance (full mode only)
  performance?: {
    // Core Web Vitals
    lcp?: number; // Largest Contentful Paint (ms)
    cls?: number; // Cumulative Layout Shift
    tbt?: number; // Total Blocking Time (ms)
    fcp?: number; // First Contentful Paint (ms)
    ttfb?: number; // Time to First Byte (ms)
    fid?: number; // First Input Delay (ms) - Legacy Core Web Vital
    inp?: number; // Interaction to Next Paint (ms) - Core Web Vital (replaces FID)
    speedIndex?: number; // Speed Index
    tti?: number; // Time to Interactive (ms)
    jsExecutionTime?: number; // JavaScript execution time (ms)
    
    // Lighthouse-style scores (0-100)
    scores?: {
      performance?: number;
      accessibility?: number;
      bestPractices?: number;
      seo?: number;
    };
    
    // Resource metrics
    renderBlockingResources?: Array<{
      url: string;
      type: "script" | "stylesheet";
      size?: number;
    }>;
    thirdPartyRequestCount?: number;
  };
  
  // Network Performance (collected with --performance flag)
  network?: {
    totalRequests: number;
    totalBytes: number;
    totalDuration?: number; // Total time from first to last request (ms)
    
    // Breakdown by resource type
    breakdown: {
      document: { count: number; bytes: number };
      stylesheet: { count: number; bytes: number };
      script: { count: number; bytes: number };
      image: { count: number; bytes: number };
      font: { count: number; bytes: number };
      media: { count: number; bytes: number };
      xhr: { count: number; bytes: number };
      fetch: { count: number; bytes: number };
      other: { count: number; bytes: number };
    };
    
    // Compression analysis
    compression: {
      gzip: number;
      brotli: number;
      deflate: number;
      none: number;
      uncompressibleTypes: number;
    };
    
    // Status code summary
    statusCodes: {
      [code: number]: number;
    };
    
    // Cache performance
    cachedRequests: number;
    uncachedRequests: number;
  };
  
  // Media
  media?: {
    screenshots?: {
      desktop?: ScreenshotReference; // "media/screenshots/desktop/{urlHash}.jpg" or tiled manifest
      mobile?: ScreenshotReference;  // "media/screenshots/mobile/{urlHash}.jpg" or tiled manifest
      desktopFullPage?: ScreenshotReference; // "media/screenshots/desktop-full/{urlHash}.jpg" or tiled manifest
      mobileFullPage?: ScreenshotReference;  // "media/screenshots/mobile-full/{urlHash}.jpg" or tiled manifest
    };
    favicon?: string;   // "media/favicons/{originHash}.{ext}"
  };
  
  // Deprecated fields (kept for backward compatibility)
  screenshotFile?: string; // Legacy: "media/screenshots/{urlKey}.png"
  viewportFile?: string; // Legacy: "media/viewports/{urlKey}.png"
  
  // Errors
  error?: string;
}

/**
 * EdgeRecord - Link from source to target
 */
export interface EdgeRecord {
  // === STABLE REFERENCES ===
  source_page_id?: string; // UUID of source page - Optional for backward compat
  target_page_id?: string; // UUID of target page (if crawled) - Optional for backward compat
  
  sourceUrl: string;
  targetUrl: string;
  normalizedSourceUrl?: string;
  normalizedTargetUrl?: string;
  anchorText: string;
  rel?: string;
  nofollow: boolean;
  sponsored?: boolean; // Link has rel="sponsored"
  ugc?: boolean; // Link has rel="ugc" (user-generated content)
  isExternal: boolean;
  location: EdgeLocation; // nav, head, footer, aside, main, other
  selectorHint?: string; // CSS selector hint for debugging
  discoveredInMode: RenderMode;
  httpStatusAtTo?: number; // HTTP status code of target if visited during crawl
  
  // === LINK CONTEXT ===
  link_type?: LinkType; // Semantic classification: navigation, content, action, etc.
  target_attr?: string; // Link target attribute (_blank, _self, _parent, _top)
  title_attr?: string; // Link title attribute (tooltip text)
  download_attr?: string | boolean; // Download attribute (filename or true)
  hreflang?: string; // Language code for linked resource
  type_attr?: string; // MIME type hint for linked resource
  aria_label?: string; // Accessible label (overrides anchor text)
  role?: string; // ARIA role attribute
  is_primary_nav?: boolean; // Link is in primary navigation
  is_breadcrumb?: boolean; // Link is part of breadcrumb trail
  is_skip_link?: boolean; // Link is a skip-to-content link
  is_pagination?: boolean; // Link is part of pagination controls
}

/**
 * AssetRecord - Media asset on a page
 */
// Single source of truth: alias to the Zod-inferred type.
// RC2 camelCase cutover (2026-06-25): canonical keys are now `pageId`/`assetId`; the
// guard flips to forbid the OLD snake `page_id`/`asset_id` so a regression is a compile error.
export type AssetRecord = AssetRecordV1 & { page_id?: never; asset_id?: never };

// ============================================================================
// Field-Level Provenance Tagging
// ============================================================================

/**
 * Classification tier for a record field's data provenance.
 *
 * - `capture`        — Direct DOM/network observation, no inference.
 * - `measurement`    — Objective runtime reading via browser API.
 * - `classification` — Deterministic pattern match producing a label.
 * - `audit`          — Third-party engine verdict with rules/scores.
 * - `aggregation`    — Derived counts/summaries from other fields.
 * - `not_computed`   — Field is schema-required but wasn't computed in this
 *                       run (e.g. a Cartographer-native accessibility field on
 *                       an axe-only stub record); the value is a default, not
 *                       an observation, and must not be tagged `capture`.
 */
export type FieldOriginTier = "capture" | "measurement" | "classification" | "audit" | "aggregation" | "not_computed";

/**
 * Per-record metadata envelope for field-level provenance.
 *
 * `fieldOrigins` maps top-level field names (or depth-1 dot-paths) to a
 * {@link FieldOriginTier}.  Rules:
 *
 * 1. Keys contain **at most one `.`** separator (max two segments).
 * 2. Keys never contain `[]` — array members inherit their parent's tier.
 * 3. A top-level key covers its entire subtree unless a depth-1 override exists.
 */
export interface RecordMeta {
  fieldOrigins: Record<string, FieldOriginTier>;
}

/**
 * AccessibilityRecord - Native Cartographer accessibility extract
 *
 * Single source of truth: alias to the Zod-inferred type.
 * The `axe`/`formControls`/`focusOrder` shapes were ported into
 * AccessibilityDatasetRecordV1Schema (previously loose `z.record(JsonValue)`), so
 * this alias preserves full type detail instead of degrading consumers.
 */
export type AccessibilityRecord = AccessibilityDatasetRecordV1;

export type AxeImpact = "minor" | "moderate" | "serious" | "critical";

export interface AxeRelatedNode {
  target: string[];
  html?: string;
}

export interface AxeCheckResult {
  id: string;
  impact?: AxeImpact | null;
  message: string;
  data?: Record<string, unknown> | null;
  relatedNodes?: AxeRelatedNode[];
}

export interface AxeNodeResult {
  target: string[];
  html?: string;
  impact?: AxeImpact | null;
  failureSummary?: string;
  any?: AxeCheckResult[];
  all?: AxeCheckResult[];
  none?: AxeCheckResult[];
}

export interface AxeRuleResult {
  id: string;
  impact?: AxeImpact | null;
  description: string;
  help: string;
  helpUrl: string;
  tags?: string[];
  nodes: AxeNodeResult[];
}

export interface AxeAuditSummary {
  violations: number;
  passes: number;
  incomplete: number;
  inapplicable: number;
  impact: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface AxeAccessibilityRecord {
  pageUrl: string;
  pageId: string;
  normalizedUrl?: string;
  auditEngine: AccessibilityEngineMode;
  axeVersion: string;
  renderMode: RenderMode;
  auditedAt: string;
  summary: AxeAuditSummary;
  testEngine: { name: string; version: string };
  testRunner?: { name: string; version: string };
  testEnvironment?: Record<string, string | number | boolean | null>;
  toolOptions?: Record<string, unknown>;
  violations: AxeRuleResult[];
  passes?: AxeRuleResult[];
  incomplete?: AxeRuleResult[];
  inapplicable?: AxeRuleResult[];
}

/**
 * ErrorRecord - Crawl error
 */
// Single source of truth: pipeline_failures and pipeline_alerts share this
// shape (PipelineAlertRecordV1Schema === PipelineFailureRecordV1Schema). Alias to the
// Zod-inferred type so it can never drift from the schema. `details` is
// Record<string,JsonValue> (no undefined). Build it via jsonSafe() at call sites.
export type ErrorRecord = PipelineFailureRecordV1;

// ============================================================================
// Frontier Ledger Dataset
// ============================================================================

/**
 * FrontierLedgerRecord — Per-URL discovery accounting written at crawl finalization.
 *
 * Every URL the crawler discovered during the crawl is recorded with its final
 * status, enabling consumers to answer "what did the crawler know about but
 * never visit?" and perform coverage/scope auditing.
 */
export interface FrontierLedgerRecord {
  url: string;
  normalizedUrl: string;
  status: "discovered" | "queued" | "visited" | "skipped";
  skipReason?: string;
  depth?: number;
  discoveredFrom?: string;
  discoveredAt?: string;    // ISO timestamp
  hostGroup: string;        // normalized hostname
}

/**
 * SitemapRecord - Per-sitemap fetch/parse outcome for forensic sitemap discovery auditing.
 */
// Single source of truth: alias to the Zod-inferred type so the schema
// and this type can never drift, and Zod renames propagate to all consumers.
export type SitemapRecord = SitemapDatasetRecordV1;

/**
 * SitemapUrlRecord (B4) - Per-URL entry declared in a non-index sitemap, with the
 * per-entry metadata the crawl parses. See SitemapUrlDatasetRecordV1Schema.
 */
export type SitemapUrlRecord = SitemapUrlDatasetRecordV1;

/**
 * ExtractionRecord (B1) - One custom extraction-rule outcome for one page, with
 * ruleId@ruleVersion provenance and a crawl-time rule snapshot. See
 * ExtractionDatasetRecordV1Schema for the honesty semantics of `status`.
 */
export type ExtractionRecord = ExtractionDatasetRecordV1;

/**
 * SitemapCoverage (B4) - Crawl-level honesty classification of sitemap discovery,
 * stamped on `manifest.sitemapCoverage`. Follows the degradation ladder: a reader
 * MUST treat a missing field (pre-B4 archive) as `absent`, never as `complete`.
 * - `absent`   discovery was skipped, or only a guessed `/sitemap.xml` was tried
 *              and it did not resolve — no sitemap to trust.
 * - `failed`   declared sitemap(s) were attempted but none fetched/parsed.
 * - `partial`  sitemaps were read but a cap tripped, a fetch/parse failed, or a
 *              fetched sitemap yielded no parseable entries — coverage incomplete.
 * - `complete` every attempted sitemap fetched and parsed with no truncation.
 */
export type SitemapCoverage = 'absent' | 'failed' | 'partial' | 'complete';

// ============================================================================
// Event Log Dataset
// ============================================================================

/**
 * EventRecord - Operational event log for debugging and monitoring
 * 
 * Captures render failures, rate limiting, challenge detection, resource
 * consumption peaks, and performance metrics for operational insights.
 * 
 * @since Atlas 1.0
 */
// Single source of truth: alias to the Zod-inferred type.
// rate_limit/challenge/resource_usage shapes were ported into EventRecordV1Schema.
export type EventRecord = EventRecordV1;

/**
 * Event type categories for operational event classification
 */
export const EventType = {
  // Crawl lifecycle
  CRAWL_STARTED: 'crawl.started' as const,
  CRAWL_PAUSED: 'crawl.paused' as const,
  CRAWL_RESUMED: 'crawl.resumed' as const,
  CRAWL_COMPLETED: 'crawl.completed' as const,
  CRAWL_ABORTED: 'crawl.aborted' as const,
  PAGE_FETCH_STARTED: 'page.fetch_started' as const,
  PAGE_FETCH_COMPLETED: 'page.fetch_completed' as const,
  PAGE_RENDER_STARTED: 'page.render_started' as const,
  PAGE_RENDER_COMPLETED: 'page.render_completed' as const,
  PAGE_EXTRACT_COMPLETED: 'page.extract_completed' as const,
  PAGE_WRITE_COMPLETED: 'page.write_completed' as const,
  PAGE_WRITE_SKIPPED: 'page.write_skipped' as const,
  ASSET_WRITE_COMPLETED: 'asset.write_completed' as const,
  
  // Render operations
  RENDER_SUCCESS: 'render.success' as const,
  RENDER_FAILURE: 'render.failure' as const,
  RENDER_TIMEOUT: 'render.timeout' as const,
  RENDER_CHALLENGE_DETECTED: 'render.challenge_detected' as const,
  RENDER_CHALLENGE_RESOLVED: 'render.challenge_resolved' as const,
  RENDER_DEGRADED_CAPTURE: 'render.degraded_capture' as const,
  
  // Rate limiting & throttling
  RATE_LIMIT_HIT: 'rate_limit.hit' as const,
  RATE_LIMIT_BACKOFF: 'rate_limit.backoff' as const,
  RATE_LIMIT_RESUMED: 'rate_limit.resumed' as const,
  BACKPRESSURE_ENGAGED: 'backpressure.engaged' as const,
  BACKPRESSURE_LIFTED: 'backpressure.lifted' as const,
  BACKPRESSURE_APPLIED: 'backpressure.applied' as const,
  BACKPRESSURE_RELEASED: 'backpressure.released' as const,
  
  // Resource management
  RESOURCE_LIMIT_EXCEEDED: 'resource.limit_exceeded' as const,
  MEMORY_PRESSURE_HIGH: 'resource.memory_pressure_high' as const,
  MEMORY_PRESSURE_NORMAL: 'resource.memory_pressure_normal' as const,
  BROWSER_CONTEXT_RECYCLED: 'resource.browser_context_recycled' as const,
  
  // Network & connectivity
  NETWORK_ERROR: 'network.error' as const,
  DNS_RESOLUTION_FAILED: 'network.dns_failed' as const,
  SSL_ERROR: 'network.ssl_error' as const,
  CONNECTION_TIMEOUT: 'network.connection_timeout' as const,
  
  // Data quality
  VALIDATION_WARNING: 'validation.warning' as const,
  VALIDATION_ERROR: 'validation.error' as const,
  EXTRACTION_FAILED: 'extraction.failed' as const,
  
  // Checkpoint & recovery
  CHECKPOINT_SAVED: 'checkpoint.saved' as const,
  CHECKPOINT_LOADED: 'checkpoint.loaded' as const,
  CHECKPOINT_FAILED: 'checkpoint.failed' as const,
  
  // Heartbeat & observability
  HEARTBEAT: 'observability.heartbeat' as const,
  METRICS_SNAPSHOT: 'observability.metrics_snapshot' as const,
  
  /** All valid event type values */
  values: [
    'crawl.started', 'crawl.paused', 'crawl.resumed', 'crawl.completed', 'crawl.aborted',
    'page.fetch_started', 'page.fetch_completed', 'page.render_started', 'page.render_completed', 'page.extract_completed', 'page.write_completed', 'page.write_skipped', 'asset.write_completed',
    'render.success', 'render.failure', 'render.timeout', 'render.challenge_detected', 'render.challenge_resolved', 'render.degraded_capture',
    'rate_limit.hit', 'rate_limit.backoff', 'rate_limit.resumed', 'backpressure.engaged', 'backpressure.lifted', 'backpressure.applied', 'backpressure.released',
    'resource.limit_exceeded', 'resource.memory_pressure_high', 'resource.memory_pressure_normal', 'resource.browser_context_recycled',
    'network.error', 'network.dns_failed', 'network.ssl_error', 'network.connection_timeout',
    'validation.warning', 'validation.error', 'extraction.failed',
    'checkpoint.saved', 'checkpoint.loaded', 'checkpoint.failed',
    'observability.heartbeat', 'observability.metrics_snapshot'
  ] as const
} as const;

export type EventType = typeof EventType.values[number];

/**
 * Event severity levels for filtering and alerting
 */
export const EventSeverity = {
  INFO: 'info' as const,
  WARN: 'warn' as const,
  ERROR: 'error' as const,
  CRITICAL: 'critical' as const,
  
  values: ['info', 'warn', 'error', 'critical'] as const
} as const;

export type EventSeverity = typeof EventSeverity.values[number];

export type ConsoleSeverity = "debug" | "info" | "warn" | "error";

/**
 * ConsoleRecord - Browser console message (full mode only)
 */
export interface ConsoleRecord {
  page_id: string; // Stable join key for pages dataset
  /** @deprecated Use page_id */
  pageId?: never;
  pageUrl: string;
  type: "log" | "warn" | "error" | "info";
  severity: ConsoleSeverity;
  message: string;
  stackTrace?: string;
  source: "page" | "browser"; // Filter to only include "page" in dataset
  timestamp: string; // ISO timestamp
}

/**
 * Computed style dictionary entry for reuse across text nodes.
 */
export interface ComputedStyleDefinition {
  id: string;
  fontSize: string; // e.g., "16px"
  fontWeight: string; // e.g., "400", "700"
  color: string; // e.g., "rgb(51, 51, 51)"
  backgroundColor: string; // e.g., "rgb(255, 255, 255)"
  lineHeight?: string;
}

/**
 * ComputedTextNodeRecord - Computed styles for text nodes (full mode only)
 * References a style definition to minimize duplication.
 */
export interface ComputedTextNodeRecord {
  page_id: string; // Stable join key for pages dataset
  /** @deprecated Use page_id */
  pageId?: never;
  pageUrl: string;
  selector: string;
  textSample: string; // First 50 chars
  style_id: string; // References ComputedStyleDefinition.id (snake_case)
  /** @deprecated Use style_id */
  styleId?: never;
  nodeType: "TEXT_NODE";
}

/**
 * Engine Configuration
 */
export type AccessibilityEngineMode = "cartographer" | "axe" | "hybrid";

// EngineConfig (the crawl engine's internal tuning surface: render,
// discovery, proxy/retry, CLI knobs) was moved out of this public package into
// the cartographer engine repo, since it's not part of the Atlas archive
// format and had no internal usage here. CrawlEvent's "crawl.started" variant
// below now carries a generic Record<string, unknown> instead of a typed
// config, for the same reason.

/**
 * Crawl state machine states represent the lifecycle of a crawl job.
 * 
 * - idle: No crawl running, ready to start
 * - running: Active crawl in progress
 * - paused: Crawl paused, can be resumed
 * - canceling: User requested cancel, cleaning up
 * - finalizing: Crawl complete, writing final data
 * - done: Crawl successfully completed
 * - failed: Crawl failed with error
 */
export const CrawlState = {
  /** No crawl running, ready to start */
  IDLE: 'idle' as const,
  /** Active crawl in progress */
  RUNNING: 'running' as const,
  /** Crawl paused, can be resumed */
  PAUSED: 'paused' as const,
  /** User requested cancel, cleaning up */
  CANCELING: 'canceling' as const,
  /** Crawl complete, writing final data */
  FINALIZING: 'finalizing' as const,
  /** Crawl successfully completed */
  DONE: 'done' as const,
  /** Crawl failed with error */
  FAILED: 'failed' as const,
  /** All valid crawl states */
  values: ['idle', 'running', 'paused', 'canceling', 'finalizing', 'done', 'failed'] as const,
  /** Human-readable descriptions */
  descriptions: {
    idle: 'No crawl running, ready to start',
    running: 'Active crawl in progress',
    paused: 'Crawl paused, can be resumed',
    canceling: 'User requested cancel, cleaning up',
    finalizing: 'Crawl complete, writing final data',
    done: 'Crawl successfully completed',
    failed: 'Crawl failed with error'
  }
} as const;

export type CrawlState = typeof CrawlState.values[number];

/**
 * Type guard for CrawlState validation
 */
export function isCrawlState(value: unknown): value is CrawlState {
  return typeof value === 'string' && (CrawlState.values as readonly string[]).includes(value);
}

/**
 * Progress snapshot for UI and events
 */
export interface CrawlProgress {
  queued: number;
  inFlight: number;
  completed: number;
  errors: number;
  pagesPerSecond: number;
  etaSeconds?: number;
  startedAt: string;
  updatedAt: string;
}

export type PageWriteSkippedReason = "enqueue_skip" | "canonical_skip" | "duplicate_page" | "required_dataset_write_failed";

export interface PageFetchStartedEvent {
  type: "page.fetch_started";
  crawlId: string;
  url: string;
  pageId: string;
  depth: number;
  discoveredFrom?: string;
  seq: number;
  timestamp: string;
}

export interface PageFetchCompletedEvent {
  type: "page.fetch_completed";
  crawlId: string;
  url: string;
  pageId: string;
  statusCode: number;
  finalUrl: string;
  redirectChain: string[];
  redirectChainLength: number;
  durationMs: number;
  seq: number;
  timestamp: string;
}

export interface PageRenderStartedEvent {
  type: "page.render_started";
  crawlId: string;
  url: string;
  pageId: string;
  finalUrl: string;
  attempt: number;
  stage: "primary" | "degraded" | "static";
  renderMode: RenderMode;
  seq: number;
  timestamp: string;
}

export interface PageRenderCompletedEvent {
  type: "page.render_completed";
  crawlId: string;
  url: string;
  pageId: string;
  finalUrl: string;
  statusCode: number;
  attempt: number;
  stage: "primary" | "degraded" | "static";
  renderMode: RenderMode;
  navEndReason: NavEndReason;
  durationMs: number;
  error?: string;
  seq: number;
  timestamp: string;
}

export interface PageExtractCompletedEvent {
  type: "page.extract_completed";
  crawlId: string;
  url: string;
  pageId: string;
  internalEdges: number;
  externalEdges: number;
  assets: number;
  accessibility: boolean;
  axe: boolean;
  durationMs: number;
  partialSuccess: boolean;
  seq: number;
  timestamp: string;
}

export interface PageWriteCompletedEvent {
  type: "page.write_completed";
  crawlId: string;
  url: string;
  pageId: string;
  statusCode: number;
  edges: number;
  assets: number;
  accessibility: boolean;
  axe: boolean;
  durationMs: number;
  seq: number;
  timestamp: string;
}

export interface PageWriteSkippedEvent {
  type: "page.write_skipped";
  crawlId: string;
  url: string;
  pageId: string;
  reason: PageWriteSkippedReason;
  details?: Record<string, unknown>;
  seq: number;
  timestamp: string;
}

export interface BackpressureEngagedEvent {
  type: "backpressure.engaged";
  crawlId: string;
  occurredAt: string;
  rssBytes: number;
  rssMB: number;
  rssPercent: number;
  thresholdMB: number;
  thresholdPercent: number;
  seq: number;
  timestamp: string;
}

export interface BackpressureLiftedEvent {
  type: "backpressure.lifted";
  crawlId: string;
  occurredAt: string;
  rssBytes: number;
  rssMB: number;
  rssPercent: number;
  thresholdMB: number;
  thresholdPercent: number;
  durationMs: number;
  seq: number;
  timestamp: string;
}

export interface CrawlDiscoveredUrl {
  url: string;
  sourceUrl: string;
  anchorText: string;
  depth: number;
  linkType: LinkType;
  isExternal: boolean;
}

/**
 * Typed event stream for Cartographer
 */
export type CrawlEvent =
  | { type: "crawl.started"; crawlId: string; config: Record<string, unknown>; origin?: "cartographer" | "scheduler"; seq: number; timestamp: string }
  | BackpressureEngagedEvent
  | BackpressureLiftedEvent
  | PageFetchStartedEvent
  | PageFetchCompletedEvent
  | PageRenderStartedEvent
  | PageRenderCompletedEvent
  | PageExtractCompletedEvent
  | PageWriteCompletedEvent
  | PageWriteSkippedEvent
  | { type: "page.fetched"; crawlId: string; url: string; statusCode: number; seq: number; timestamp: string }
  | { type: "page.parsed"; crawlId: string; url: string; record: PageRecord; seq: number; timestamp: string }
  | { type: "error.occurred"; crawlId: string; error: ErrorRecord; seq: number; timestamp: string }
  | { type: "checkpoint.saved"; crawlId: string; path: string; seq: number; timestamp: string }
  | {
      type: "checkpoint.failed";
      crawlId: string;
      reason: string;
      consecutiveFailures: number;
      totalFailures: number;
      timeSinceLastSuccessfulCheckpointMs: number;
      cooldownUntilNextAttempt: string;
      seq: number;
      timestamp: string;
    }
  | {
      type: "crawl.pageProcessed";
      crawlId: string;
      url: string;
      depth: number;
      statusCode: number;
      edges: number;
      assets: number;
      durationMs: number;
      discoveredUrls: CrawlDiscoveredUrl[];
      seq: number;
      timestamp: string;
    }
  | { type: "crawl.heartbeat"; crawlId: string; progress: CrawlProgress; seq: number; timestamp: string }
  | {
      type: "crawl.observability";
      crawlId: string;
      queueDepth: number;
      inFlightCount: number;
      completedCount: number;
      errorCount: number;
      perHostQueues: Record<string, number>;
      schedulerThrottledHosts: string[];
      remoteRateLimitedRetries: number;
      remoteRateLimitedRetryExhausted: number;
      currentRps: number;
      memoryRssMB: number;
      seq: number;
      timestamp: string;
    }
  | {
      type: "crawl.extraction_observability";
      crawlId: string;
      component: "extraction";
      url: string;
      pageId: string;
      wallTimeMs: number;
      cpuTimeMs: number;
      concurrencyFactor: number;
      extractorTaskCount: number;
      failedTaskCount: number;
      slowestTaskId?: string;
      slowestTaskMs?: number;
      seq: number;
      timestamp: string;
    }
  | { type: "crawl.backpressure"; crawlId: string; host: string; reason: string; hostsWithTokens: string[]; hostsDeferred: string[]; tokens?: number; queued?: number; seq?: number; timestamp?: string }
  | { type: "crawl.shutdown"; crawlId: string; reason: "cancel"|"error"; seq: number; timestamp: string }
  | {
      type: "crawl.finished";
      crawlId: string;
      manifestPath: string;
      incomplete: boolean;
      summary?: { pages: number; edges: number; assets: number; errors: number; durationMs: number };
      perf?: { avgPagesPerSec: number; peakRssMB: number };
      notes?: string[];
      /**
       * Effective error budget used for this crawl (resolved from CLI/env/defaults).
       * Optional for backward compatibility.
       */
      errorBudget?: number;
      seq: number;
      timestamp: string;
    };

export type AtlasPackName = "Core" | "A11y-Light" | "A11y-Full" | "Perf" | "Visual";
export type AtlasPackState = "embedded" | "sidecar" | "missing";

export interface AtlasPack {
  name: AtlasPackName;
  version: string;
  state: AtlasPackState;
  uri?: string;
  sha256?: string | null;
  notes?: string[];
}

/**
 * Manifest for .atls file
 */
export interface AtlasManifest {
  datasetId?: string;
  crawlId?: string;
  /** Render mode. Same enum as `crawlContext.mode`. */
  mode?: RenderMode;
  atlasVersion: string; // Current edition value: "1.1". Schema: /^v?\d+(\.\d+)?$/
  formatVersion: string; // Current edition value: "1.1.0". Readers gate on major 1.
  specVersion?: string;
  schemaVersion?: string; // Current edition tag: ATLAS_SCHEMA_VERSION ("2026-09-04")
  incomplete?: boolean;

  owner: {
    name: string; // Required string. The schema does not fix the value.
  };

  consumers: string[]; // Required string array. The schema has no default.

  /**
   * Provenance source information
   * Used for imported archives (e.g. WARC) to track origin.
   */
  source?: {
    sourceType: 'warc' | 'native';
    originalFilename?: string;
    importDate?: string;
    warcStats?: {
      size: number;
      sha256: string;
      totalResponses: number;
    };
  };

  identity?: {
    primary_origin?: string;
    primaryOrigin?: string;
    domain?: string;
    publicSuffix?: string;
    seed_urls?: string[];
    seedUrls?: string[];
  };

  siteRoot?: string;
  scope?: {
    seeds?: string[];
    allow?: string[];
    deny?: string[];
    block_params?: string[];
    follow_external?: boolean;
    max_pages?: number;
    max_depth?: number;
  };

  crawlerSettings?: {
    render_mode?: string;
    robots_policy?: string;
    robots_override?: boolean;
    user_agent?: string;
    concurrency?: number;
    rps?: number;
    replay_tier?: string;
    cpu_slowdown_multiplier?: number;
    network_conditions?: "none" | "mobile-4g" | "mobile-3g" | "mobile-2g" | "slow-2g";
  };

  urlNormalization?: {
    lowercase_host?: boolean;
    remove_default_port?: boolean;
    strip_fragment?: boolean;
    /** Informational. Identity uses `trailing_slash`, not this boolean. */
    remove_trailing_slash?: boolean;
    /**
     * Spec 1.2 trailing-slash declaration. Writers set `append-unless-file`.
     * Readers do not derive URL identity from this string. The algorithm is
     * normative on its own. Older slash fields are informational.
     */
    trailing_slash?: string;
    sort_query_params?: boolean;
    querystring_policy?: string;
    blocked_query_params?: string[];
  };

  crawlContext?: {
    mode?: RenderMode;
    robots?: boolean;
    maxPages?: number;
    maxDepth?: number;
    followExternal?: boolean;
    concurrency?: number;
    rps?: number;
    userAgent?: string;
    urlNormalization?: string;
    urlNormalizationRules?: string[];
    paramPolicy?: ParamPolicy;
    parameterBlockList?: string[];
    allowUrls?: string[];
    denyUrls?: string[];
  };

  packs?: AtlasPack[];
  
  // Crawl timing
  crawlStartedAt?: string;    // ISO timestamp when crawl began
  crawlCompletedAt?: string;  // ISO timestamp when crawl finished
  
  // Producer metadata
  producer?: {
    name: string;                 // "cartographer-engine"
    version: string;              // "1.0.0-rc.1"
    build: string;                // "202510281348" (YYYYMMDDHHmm)
    git_hash?: string;            // "a1b2c3d4" (8-char short hash)
    command_line?: string;        // Full CLI invocation (PII-redacted)
  };
  
  // Environment snapshot
  environment?: {
    device: "desktop" | "mobile"; // Emulation mode
    viewport: {
      width: number;              // 1920 or 375
      height: number;             // 1080 or 667
    };
    user_agent: string;           // Full UA string
    locale: string;               // "en-US"
    timezone: string;             // "America/Los_Angeles"
    accept_language: string;      // "en-US,en;q=0.9"
    cpu_throttling?: number | null;      // 4 = 4x slowdown
    network_conditions?: "none" | "mobile-4g" | "mobile-3g" | "mobile-2g" | "slow-2g";
    network_profile?: {
      name: string;               // "Fast 3G"
      download_kbps: number;
      upload_kbps: number;
      latency_ms: number;
    };
    consent_state?: {
      cookies_enabled: boolean;
      do_not_track: boolean;
      gdpr_mode?: boolean;
    };
    browser: {
      name: string;               // "chromium"
      version: string;            // "120.0.6099.109"
      headless: boolean;
    };
    platform: {
      os: string;                 // "darwin", "linux", "win32"
      arch: string;               // "x64", "arm64"
      node_version: string;       // "v20.11.0"
    };
  };
  
  // Privacy policy
  privacyPolicy?: {
    stripCookies: boolean;         // Strip cookies from requests (default true)
    stripAuthHeaders: boolean;     // Strip Authorization headers (default true)
    redactInputs: boolean;         // Redact input field values (default true)
    redactForms: boolean;          // Redact form data (default true)
    redactPii: boolean;            // Redact obvious PII fields (default false)
  };

  // Robots.txt policy
  robotsPolicy?: {
    respect: boolean;              // Respect robots.txt (default true)
    overridesUsed: boolean;        // If true, robots.txt was overridden
    overrideReason?: string;       // Reason for override (if overridesUsed)
  };

  // compareCompatibility is z.record(unknown) (free-form) in the schema — the field name is
  // camelCase but inner keys (comparable_to/diff_*) are data and stay snake.
  compareCompatibility?: {
    comparable_to?: string[];
    diff_safe?: boolean;
    diff_warnings?: string[];
  };

  // Crawl config hash
  crawlConfigHash?: string;      // SHA-256 of normalized config for reproducibility
  
  hashing: {
    algorithm: string; // "sha256"
    urlKeyAlgo: string; // "sha1"
    rawHtmlHash: string; // "sha256 of raw HTTP body"
    domHash: string; // "sha256 of document.documentElement.outerHTML"
  };
  
  /**
   * Dataset directory name → part paths. Keys are the long names in
   * `ATLAS_DATASET_KEYS`. The schema is an open record, not a closed list.
   */
  parts: Record<string, string[]>;

  /**
   * Dataset directory name → schema reference. Same key space as `parts`.
   */
  schemas: Record<string, string>;
  
  datasets?: {
    // Optional: Maps dataset name to metadata
    [key: string]: {
      name?: string;
      partCount?: number;
      recordCount?: number;
      bytes?: number;
      schema?: string;
      schemaVersion?: string;
      schemaHash?: string;
      present?: boolean;
      parts?: number;
      sidecarUri?: string;
      sidecarSha256?: string | null;
      // Per-part integrity checksums
      integrity?: {
        algorithm: string;  // "sha256"
        checksums: Record<string, string>; // filename -> sha256
      };
    };
  };
  
  capabilities?: {
    renderModes: RenderMode[];
    modesUsed: RenderMode[]; // All modes used in crawl
    specLevel: 1 | 2 | 3; // 1=Raw, 2=Prerender, 3=Full
    dataSets: string[]; // Canonical dataset keys present in this archive
    robots: {
      respectsRobotsTxt: boolean;
      overrideUsed: boolean;
    };
  };
  
  // Coverage matrix
  // Recased to camelCase on 2026-07-04, the last snake_case seam
  // post-RC2. Archives written before this date carry the snake spellings
  // (total_pages, row_count, and similar); readers should dual-read both.
  // totalEdges and totalAssets were added because the SDK's strict validate
  // always required them, but the producer never emitted them.
  coverage?: {
    matrix: Array<{
      part: string;               // Dataset key (e.g. "navigation", "page_metadata", "security")
      expected: boolean;          // Should this part exist?
      present: boolean;           // Is this part present?
      rowCount: number;           // Actual record count
      coveragePct?: number;       // Optional: estimated completeness
      reasonIfAbsent?: string;    // "not_in_render_mode" | "no_records" | "disabled"
    }>;
    totalPages: number;
    totalEdges: number;
    totalAssets: number;
    successfulPages: number;
    failedStatusPages: number;
    pagesWithErrors: number;
    incomplete: boolean;          // Crawl terminated early?
    truncatedParts?: string[];    // Parts that hit limits
  };

  /**
   * Sitemap-discovery honesty flag (schema tag 2026-07-16 and later).
   * A missing value means `absent`, never `complete`.
   */
  sitemapCoverage?: SitemapCoverage;

  configIncluded: boolean;
  redactionApplied: boolean;
  
  // Storage and compression configuration
  storage?: {
    compression: {
      algorithm: string;            // "zstd" for JSONL parts
      level?: number;               // Compression level (1-22 for zstd)
    };
    // Manifest additions
    blobFormat?: "zst" | "tar.zst";  // Individual files or packed
    replayTier?: "html" | "html+css" | "full";  // Replay capture mode
    contentAddressing?: "on" | "off";  // Content-addressed blob storage
    imagePolicy?: "none" | "dimensions" | "full";  // Image capture policy
    maxImageBytes?: number;  // Maximum image size in bytes
    
    media?: {
      location: string;             // "media/" - directory in archive
      formats: string[];            // ["avif", "jpeg", "png"] - supported formats
      screenshots?: {
        enabled: boolean;
        quality?: number;           // JPEG quality (1-100)
        viewports: string[];        // ["desktop", "mobile"]
        mode?: "viewport" | "full_page"; // Capture mode
        format?: string;            // Primary format (e.g., webp, jpeg)
      };
      favicons?: {
        enabled: boolean;
        max_size_bytes?: number;
      };
    };
    blobs?: {
      enabled: boolean;             // Content-addressed storage
      format?: string;              // Future: "sha256-dir" for blobs/ab/cd/abcd...
    };
  };
  
  notes: string[];
  
  integrity: {
    algorithm?: string;
    /**
     * SHA-256, lowercase hex, of the concatenated lowercase-hex part checksums.
     * Spec 1.2 orders paths by UTF-8 byte order. See storage-and-encoding.md.
     * Does not cover blobs, schemas, the manifest, the summary, or provenance.
     */
    contentSha256?: string;
    /**
     * @deprecated Spec 1.2 writers omit this. It was a copy of `contentSha256`
     * in the only writer helper that set it. Readers ignore it.
     */
    archiveSha256?: string;
    /**
     * @deprecated Spec 1.2 writers omit this. It was a copy of `contentSha256`
     * in the only writer helper that set it. Readers ignore it.
     */
    auditHash?: string;
    /** Relative part path to the SHA-256 of that part's stored ZIP payload. */
    files: Record<string, string>;
  };

  createdAt: string; // ISO timestamp
  generator: string; // Required producer id. The schema does not constrain the spelling.
}

/**
 * Summary statistics
 */
export interface AtlasSummary {
  // Identity - "what" was crawled
  identity: {
    seedUrls: string[];
    primaryOrigin: string; // e.g., "https://example.com"
    domain: string; // e.g., "example.com"
    publicSuffix: string; // e.g., "com"
  };
  
  // Context - "how" and "why" it was crawled
  crawlContext: {
    specLevel: number; // 1 = Raw, 2 = Prerender, 3 = Full
    completionReason: "finished" | "capped" | "error_budget" | "schema_budget_exhausted" | "manual";
    frontierEmptyAtStop?: boolean;
    stopConditionsTriggered?: string[];
    completionInputs?: {
      errorBudgetExceeded: boolean;
      budgetStopReason?: string;
      gracefulShutdown: boolean;
      maxPages: number;
      pageCount: number;
      queueHasPending: boolean;
      enqueuedCount: number;
      visitedCount: number;
    };
    config: {
      maxPages?: number;
      maxDepth?: number;
      robotsRespect: boolean;
      followExternal: boolean;
      concurrency?: number;
      rps?: number;
      userAgent?: string;
      paramPolicy?: ParamPolicy;
      blockList?: string[];
      allowUrls?: string[];
      denyUrls?: string[];
    };
    /** Per-page capture limits that were in effect during the crawl.
     *  These are the thresholds that determine when the pipeline
     *  reports bytes_capped, requests_capped, etc. Surfaced here
     *  so downstream consumers can interpret per-page limit flags
     *  without accessing the original config. */
    captureLimits?: {
      maxBytesPerPage?: number;
      maxRequestsPerPage?: number;
      maxAssetsPerPage?: number;
      maxStructuredDataItems?: number;
      renderTimeoutMs?: number;
      networkIdleMs?: number;
    };
  };
  
  // Statistics - counts
  stats: {
    totalPages: number;
    totalEdges: number;
    totalAssets: number; // Asset metadata records (not downloaded files)
  totalResponses?: number; // HTML response bodies stored in blob storage
    totalErrors: number; // Crawl errors: failed fetches, render crashes, timeouts (not data quality issues)
    totalAlerts?: number; // Recoverable incidents observed during crawl that did not prevent eventual capture
    totalEvents?: number; // Operational events (Phase 7: Event log)
    totalAccessibilityRecords?: number; // Optional for backward compatibility
  totalAxeAuditRecords?: number; // axe-core dataset records (full mode only)
    totalConsoleRecords?: number; // Browser console logs (full mode only)
    totalStyleRecords?: number; // CSS records (full mode only)
    totalStyleDefinitionRecords?: number; // Deduplicated style definitions (full mode only)
    totalPerfRecords?: number; // Per-page performance metrics (full mode only)
    totalVectorPerformanceRecords?: number; // Vector dataset metrics (full mode only)
    totalPerformanceDatasetRecords?: number; // Unified performance dataset records
    totalNavigationRecords?: number; // Unified navigation dataset records
    totalSecurityRecords?: number; // Unified security dataset records
    totalDOMSnapshots?: number; // DOM snapshots for offline accessibility audits (full mode only)
    totalResourceRecords?: number; // Subresource records (full mode only)
    totalContentRecords?: number; // Content dataset records
    totalStructuredDataRecords?: number; // Structured data dataset records
    totalTechnologyRecords?: number; // Technology dataset records
    totalRenderRecords?: number; // Render metadata records (full mode only)
    totalAccTreeRecords?: number; // Accessibility tree snapshot records (full mode only)
    totalSitemapRecords?: number; // Sitemap discovery records
    totalSitemapUrlRecords?: number; // B4: per-URL sitemap entries (sitemap_urls dataset)
    totalExtractionRecords?: number; // B1: custom extraction-rule results (extraction dataset)
    totalQuarantineRecords?: number; // Records quarantined due to schema non-conformance
    totalRobotsRecords?: number; // Robots.txt records
    statusCodes: Record<string, number>;
    renderModes: Record<RenderMode, number>; // Count by mode: raw/prerender/full
    paramPolicy?: ParamPolicy;
  };
  
  // Performance metrics
  performance: {
    avgRenderMs?: number;
    maxDepthReached: number; // Renamed from maxDepth
  };
  configSnapshot?: {
    requested?: Record<string, unknown>;
    effective?: Record<string, unknown>;
  };
  
  // Timestamps
  timestamps: {
    crawlStartedAt: string;
    crawlCompletedAt: string;
    crawlDurationMs: number;
  };
}

/**
 * Robots.txt cache entry
 */
export interface RobotsCacheEntry {
  origin: string;
  rules: string;
  etag?: string;
  fetchedAt: string;
  expiresAt: string;
}

// ============================================================================
// Runtime validation helpers (core datasets)
// ============================================================================

/**
 * Parse & validate a flat in-memory PageRecord (the composite runtime shape).
 *
 * NOTE: This validates against PageRecordSchema (~20 required flat fields with
 * passthrough). It does NOT validate page_metadata dataset records, which use
 * the nested PageMetadataDatasetRecordV1Schema. For on-disk records, use
 * PageMetadataRecordV1Schema directly.
 */
export function parsePageRecord(value: unknown): PageRecord {
  return PageRecordSchema.parse(value) as unknown as PageRecord;
}

export function isPageRecord(value: unknown): value is PageRecord {
  return PageRecordSchema.safeParse(value).success;
}

export function parseEdgeRecord(value: unknown): EdgeRecord {
  return EdgeRecordSchema.parse(value) as unknown as EdgeRecord;
}

export function isEdgeRecord(value: unknown): value is EdgeRecord {
  return EdgeRecordSchema.safeParse(value).success;
}

export function parseAssetRecord(value: unknown): AssetRecord {
  return AssetRecordSchema.parse(value) as unknown as AssetRecord;
}

export function isAssetRecord(value: unknown): value is AssetRecord {
  return AssetRecordSchema.safeParse(value).success;
}

export function parseErrorRecord(value: unknown): ErrorRecord {
  return ErrorRecordSchema.parse(value) as unknown as ErrorRecord;
}

export function isErrorRecord(value: unknown): value is ErrorRecord {
  return ErrorRecordSchema.safeParse(value).success;
}

export function parseResponseRecord(value: unknown): ResponseRecordV1 {
  return ResponseRecordSchema.parse(value) as unknown as ResponseRecordV1;
}

export function isResponseRecord(value: unknown): value is ResponseRecordV1 {
  return ResponseRecordSchema.safeParse(value).success;
}

export function parseDOMSnapshotRecord(value: unknown): DOMSnapshotRecordV1 {
  return DOMSnapshotRecordSchema.parse(value) as unknown as DOMSnapshotRecordV1;
}

export function isDOMSnapshotRecord(value: unknown): value is DOMSnapshotRecordV1 {
  return DOMSnapshotRecordSchema.safeParse(value).success;
}
