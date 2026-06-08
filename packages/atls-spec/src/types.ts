/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

/**
 * Atlas v1.0 Type Definitions
 * 
 * Core types for Atlas archive specification.
 * Used by both the Cartographer engine and Atlas SDK.
 */
import type { DOMSnapshotRecordV1, ResponseRecordV1 } from "./schemas/index.js";
import {
  AssetRecordSchema,
  DOMSnapshotRecordSchema,
  EdgeRecordSchema,
  ErrorRecordSchema,
  PageRecordSchema,
  ResponseRecordSchema,
} from "./schemas/runtime-core.schema.js";

// ============================================================================
// Enum Codification (Atlas v1.0 Enhancement #7)
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
 * Link type classification for semantic link analysis (Atlas v1.0 Enhancement - Phase 4)
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
  validation?: AtlasStructuredDataValidationIssue[];
  source?: AtlasStructuredDataSourceMeta;
  provenance?: {
    url: string;
  };
  relevance?: AtlasRelevanceAssessment;
}

export interface AtlasPageStructuredData {
  raw: AtlasStructuredDataItem[];
  relevant: AtlasStructuredDataItem[];
  schemaTypes?: string[];
  schemaTypeTree?: AtlasSchemaTypeTreeNode[];
  validationIssues?: AtlasStructuredDataValidationIssue[];
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
  // === STABLE IDENTIFIER (Atlas v1.0 Enhancement) ===
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
  
  // Hashing and content (Atlas v1.0 Enhancement)
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
  
  // Temporal tracking (Atlas v1.0 Enhancement)
  previous_page_id?: string; // page_id from previous crawl (for re-crawl diffing)
  previousPageId?: string;
  content_changed?: boolean; // Did content change since last crawl?
  contentChanged?: boolean;
  dom_changed?: boolean; // Did DOM change since last crawl?
  domChanged?: boolean;
  
  // Response metadata (Atlas v1.0 Enhancement - Phase 5)
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
  
  // Detailed timing breakdown (Atlas v1.0 Enhancement - Phase 3)
  timing?: {
    fetch_started_at?: string;    // ISO timestamp when fetch began
    fetch_completed_at?: string;  // ISO timestamp when fetch completed
    render_started_at?: string;   // ISO timestamp when render began (if mode != raw)
    render_completed_at?: string; // ISO timestamp when render completed (if mode != raw)
  };
  
  // Render timing (Atlas v1.0 Enhancement - Phase 3B)
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
  // === STABLE REFERENCES (Atlas v1.0 Enhancement) ===
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
  
  // === LINK CONTEXT (Atlas v1.0 Enhancement - Phase 4) ===
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
export interface AssetRecord {
  // === STABLE REFERENCES (Atlas v1.0 Enhancement) ===
  page_id: string; // UUID of page containing asset
  asset_id: string; // UUID v5(namespace, assetUrl) - deterministic
  /** @deprecated Use page_id */
  pageId?: never;
  /** @deprecated Use asset_id */
  assetId?: never;
  
  pageUrl: string;
  assetUrl: string;
  type: "image" | "video" | "audio" | "document";
  alt?: string;
  hasAlt: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  estimatedBytes?: number;
  visible: boolean | null;
  inViewport: boolean | null;
  loading?: string; // "lazy" attribute
  wasLazyLoaded: boolean;
  
  // === RESPONSIVE IMAGES (Atlas v1.0 Enhancement - Phase 6) ===
  
  /**
   * Srcset attribute value (comma-separated image candidates with descriptors)
   * Example: "small.jpg 480w, medium.jpg 800w, large.jpg 1200w"
   */
  srcset?: string;
  
  /**
   * Parsed srcset candidates for programmatic analysis
   */
  srcset_candidates?: Array<{
    url: string;          // Resolved URL
    descriptor: string;   // "480w", "1.5x", etc.
    width?: number;       // Pixel width (from "w" descriptor)
    density?: number;     // Pixel density (from "x" descriptor)
  }>;
  
  /**
   * Sizes attribute (media queries for responsive selection)
   * Example: "(max-width: 600px) 480px, (max-width: 900px) 800px, 1200px"
   */
  sizes?: string;
  
  /**
   * Parent picture element info (if image is inside <picture>)
   */
  picture_context?: {
    has_picture_parent: boolean;
    source_count: number;      // Number of <source> elements
    sources?: Array<{
      srcset: string;
      media?: string;          // Media query
      type?: string;           // MIME type (e.g., "image/webp")
    }>;
  };
  
  // === VIDEO/AUDIO METADATA (Atlas v1.0 Enhancement - Phase 6) ===
  
  /**
   * Video/audio duration in seconds (from runtime inspection)
   */
  duration?: number;
  
  /**
   * MIME type from type attribute or Content-Type header
   * Examples: "video/mp4", "video/webm", "audio/mpeg", "audio/wav"
   */
  mime_type?: string;
  
  /**
   * Video/audio controls
   */
  has_controls?: boolean;
  
  /**
   * Autoplay flag
   */
  autoplay?: boolean;
  
  /**
   * Loop flag
   */
  loop?: boolean;
  
  /**
   * Muted flag
   */
  muted?: boolean;
  
  /**
   * Preload strategy: "none", "metadata", "auto"
   */
  preload?: string;
  
  /**
   * Poster image URL (for video)
   */
  poster?: string;
  
  /**
   * Track elements (captions, subtitles, etc.)
   */
  tracks?: Array<{
    kind: string;        // "captions", "subtitles", "descriptions", "chapters", "metadata"
    src: string;
    srclang?: string;
    label?: string;
  }>;
  
  /**
   * Source elements (for video/audio with multiple formats)
   */
  sources?: Array<{
    src: string;
    type?: string;       // MIME type
  }>;
  
  // === LAZY LOADING DETECTION (Atlas v1.0 Enhancement - Phase 6) ===
  
  /**
   * Lazy loading strategy detected
   */
  lazy_strategy?: "native" | "intersection-observer" | "data-src" | "none";
  
  /**
   * Data attributes used for lazy loading
   */
  lazy_data_attrs?: {
    data_src?: string;
    data_srcset?: string;
    data_sizes?: string;
    data_bg?: string;
    [key: string]: string | undefined;
  };
  
  /**
   * Class names that indicate lazy loading (e.g., "lazyload", "lazy")
   */
  lazy_classes?: string[];

  /**
   * Number of identical asset observations collapsed into this record.
   * This preserves multiplicity while reducing exact duplicate rows.
   */
  occurrence_count?: number;

  /**
   * Relational hint linking this DOM-observed asset to its network-captured
   * resource record, when a match was found during the write phase.
   * Avoids the need for URL-based joins between the assets and resources datasets.
   */
  resource_hint?: {
    /** Foreign key to resources.res_id */
    res_id: string;
    /** Direct blob reference for the captured resource body (avoids join for common queries) */
    body_blob_ref?: string;
    /** Size of the network response body in bytes */
    size_bytes?: number;
  };

  /**
   * Optional tiled screenshot representation for oversized captures.
   */
  tiles?: ScreenshotTile[];
}

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
 */
export type FieldOriginTier = "capture" | "measurement" | "classification" | "audit" | "aggregation";

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
 */
export interface AccessibilityRecord {
  pageUrl: string;
  page_id: string; // UUID v7 for stable joins
  audit_engine?: {
    name: string;
    version: string;
  };
  wcag_version?: string;
  audit_profile?: "basic" | "essential" | "full" | "custom";
  audited_at?: string;
  missingAltCount: number;
  missingAltSources?: string[];
  headingOrder: Array<"H1" | "H2" | "H3" | "H4" | "H5" | "H6">;
  landmarks: {
    header: boolean;
    nav: boolean;
    main: boolean;
    aside: boolean;
    footer: boolean;
  };
  roles: Record<string, number>;
  contrastViolations?: Array<{
    selector: string;
    fg?: string;
    bg?: string;
    ratio: number;
    level: "AA" | "AAA";
  }>;
  ariaIssues?: string[];
  lang?: string | null;
  formControls?: {
    totalInputs: number;
    missingLabel: number;
    inputsMissingLabel: string[];
    missingAutocomplete?: number;
    inputsMissingAutocomplete?: string[];
    requiredInputs?: number;
    requiredWithoutConstraint?: number;
    inputsWithPattern?: number;
    elements?: Array<{
      selector: string;
      tag: "input" | "textarea" | "select";
      type?: string;
      required: boolean;
      hasLabel: boolean;
      autocomplete?: string;
      hasConstraint: boolean;
    }>;
  } | null;
  focusOrder?: Array<{ selector: string; tabindex: number }> | null;
  wcagData?: object | null;
  axe?: AxeAccessibilityRecord;
  _meta?: RecordMeta;
}

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
  page_id: string;
  normalizedUrl?: string;
  audit_engine: AccessibilityEngineMode;
  axe_version: string;
  render_mode: RenderMode;
  audited_at: string;
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
export interface ErrorRecord {
  url: string;
  origin: string; // For DNS/SSL triage
  hostname: string; // For host-level error grouping
  occurredAt: string; // ISO timestamp
  phase: "fetch" | "render" | "extract" | "write";
  code?: string;
  message: string;
  stack?: string;
  details?: Record<string, any>;
}

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
export interface SitemapRecord {
  sitemap_id: string; // UUIDv7
  crawl_id: string;
  url: string;
  fetched_at: string; // ISO timestamp
  http_status: number;
  content_type: string;
  is_index: boolean;
  entries_found: number;
  entries_enqueued: number;
  parse_warning: boolean;
  parse_error: string | null;
  depth: number;
  referenced_by: string | null;
}

// ============================================================================
// Event Log Dataset (Atlas v1.0 Phase 7)
// ============================================================================

/**
 * EventRecord - Operational event log for debugging and monitoring
 * 
 * Captures render failures, rate limiting, challenge detection, resource
 * consumption peaks, and performance metrics for operational insights.
 * 
 * @since Atlas v1.0 Phase 7
 */
export interface EventRecord {
  // Core identification
  event_id: string;                  // UUID v7 for event tracking
  crawl_id: string;                  // Crawl identifier
  occurred_at: string;               // ISO 8601 timestamp
  
  // Event classification
  event_type: EventType;             // Event category (see EventType enum)
  severity: EventSeverity;           // info | warn | error | critical
  
  // Context
  url?: string;                      // Associated URL (if applicable)
  hostname?: string;                 // Hostname for grouping
  page_id?: string;                  // Page UUID v7 (if applicable)
  
  // Event details
  message: string;                   // Human-readable description
  details?: Record<string, any>;     // Structured event data
  
  // Performance metrics (when applicable)
  metrics?: {
    duration_ms?: number;            // Operation duration
    memory_rss_mb?: number;          // RSS memory at event time
    queue_depth?: number;            // Queue size at event time
    concurrent_requests?: number;    // Active requests
  };
  
  // Rate limiting context (for throttle events)
  rate_limit?: {
    host: string;                    // Affected host
    status_code?: number;            // HTTP status (429, 503)
    retry_after?: number;            // Retry-After header (seconds)
    backoff_ms?: number;             // Applied backoff duration
    attempts?: number;               // Retry attempt number
  };
  
  // Challenge detection (for bot/captcha challenges)
  challenge?: {
    provider?: string | null;        // Cloudflare, Akamai, etc.
    detection_confidence: "high" | "medium" | "low";
    resolution_attempted: boolean;   // Whether we tried to resolve
    resolution_success?: boolean;    // Resolution outcome
    wait_duration_ms?: number;       // How long we waited
  };
  
  // Resource consumption (for memory/cpu alerts)
  resource_usage?: {
    cpu_percent?: number;            // CPU usage percentage
    memory_heap_mb?: number;         // Heap memory (MB)
    memory_external_mb?: number;     // External memory (MB)
    gc_duration_ms?: number;         // Garbage collection time
  };
}

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

export interface EngineConfig {
  seeds: string[];
  outAtls: string;
  maxPages: number; // 0 = unlimited
  maxDepth: number; // -1 = unlimited, 0 = seeds only, N = up to depth N
  storage?: {
    compression?: "zstd" | "none";
    compressionConcurrency?: number;
  };

  /**
   * Additional config for public API
   */
  perHostRps?: number; // Requests per second per host (default 2)
  /**
   * @deprecated Use render.mode.
   * Legacy top-level alias retained for backward compatibility.
   */
  renderMode?: RenderMode; // "raw" | "prerender" | "full" (default "prerender")

  render: {
    mode: RenderMode;
    concurrency: number;
    timeoutMs: number;
    maxRequestsPerPage: number;
    maxBytesPerPage: number;
    vectorPerformance?: boolean;
    homepageIdleMaxMs?: number;
    standardIdleMaxMs?: number;
    visualStabilityQuietWindowMs?: number;
    axeTimeoutMs?: number;
    contextRecycleThreshold?: number;
    leaseTtlMs?: number;
    disableChallengeDetection?: boolean;
    debugCaptureChallengePages?: boolean;
    waitUntil?: "domcontentloaded" | "load" | "networkidle";
    waitForSelector?: string;
    waitForSelectorTimeoutMs?: number;
    viewport?: {
      width: number;
      height: number;
    };
    cpuSlowdownMultiplier?: number;
    networkConditions?: "none" | "mobile-4g" | "mobile-3g" | "mobile-2g" | "slow-2g";
    networkProfile?: {
      name?: string;
      downloadKbps: number;
      uploadKbps: number;
      latencyMs: number;
      offline?: boolean;
    };
    deviceProfile?: DeviceProfile;
    /** @internal Derived/internal label set after canonical device profile resolution. */
    emulationProfile?: string;
    scrollShim?: boolean;
    scrollSettleMs?: number;
    traceOnError?: boolean;
    homepage?: {
      waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
      timeoutMs?: number;
      settleMs?: number;
    };
  };
  
  media?: {
    screenshots?: {
      enabled: boolean;           // Enable screenshot capture
      desktop: boolean;           // Desktop viewport (1280×720)
      mobile: boolean;            // Mobile viewport (375×667)
      desktopFullPage?: boolean;  // Full-page desktop viewport (entire scroll height)
      mobileFullPage?: boolean;   // Full-page mobile viewport
      quality: number;            // Compression quality 1-100 (default: 80)
      format: 'png' | 'jpeg' | 'avif' | 'webp';     // Image format (default: webp)
      concurrency?: number;       // Optional compression concurrency override
    };
    favicons?: {
      enabled: boolean;           // Enable favicon collection
    };
  };
  
  replay?: {
    tier: 'html' | 'html+css' | 'full';  // Replay capture tier
  };

  http: {
    rps: number; // requests per second
    userAgent: string;
    warmupOrigins?: boolean; // Prefetch homepages before robots.txt checks (default false)
    jitterPct?: number; // Optional jitter applied to request spacing (0-1, default 0.3)
  };

  discovery: {
    followExternal: boolean;
    paramPolicy: ParamPolicy;
    blockList: string[]; // Tracking params to strip (supports wildcards like "utm_*")
    allowUrls?: string[]; // URL patterns to allow (glob or regex)
    denyUrls?: string[]; // URL patterns to deny (glob or regex)
    preferredHost?: string; // Prefer host strategy for sitemap/seed discovery (default "seed")
    discoveryConcurrencyPerHost?: number; // Discovery scheduler concurrency per host
    perHostConcurrency?: number; // Legacy alias for discoveryConcurrencyPerHost
    scoutRatio?: number; // Fraction of queue budget reserved for scout scheduling
    preserveTrailingSlash?: boolean; // Preserve URL trailing slash distinctions
    allowParamSampling?: boolean; // Allow sample param policy behavior
    sitemapDiscoveryLimit?: number; // Cap sitemap-enqueued URLs (default 5000)
    sitemapDiscoveryDepth?: number; // Sitemap index recursion depth (-1 = unlimited, default 3)
    sitemapFetchMaxRetries?: number; // Maximum retries per sitemap fetch (default 3)
    sitemapCircuitBreakerThreshold?: number; // Host failure count before opening circuit (default 3)
    sitemapFetchTimeoutMs?: number; // Per-sitemap fetch timeout in ms (default 10000)
    pathBlockList?: string[]; // Paths to exclude entirely (e.g., /cart, /checkout)
  };

  robots: {
    respect: boolean;
    overrideUsed: boolean;
  };

  privacy?: {
    stripCookies: boolean; // Strip cookies from requests (default true for privacy)
    stripAuthHeaders: boolean; // Strip Authorization headers (default true)
    redactInputValues: boolean; // Redact input field values in DOM snapshots (default true)
    redactForms: boolean; // Redact form data (default true)
  };

  memory?: {
    maxRssMB: number; // Maximum RSS memory in MB before pausing queue
    cacheMaxEntries?: number; // Max entries for in-memory LRU caches (default 50_000)
  };

  accessibility?: {
    enabled: boolean; // Enable accessibility auditing (default true)
    engine?: AccessibilityEngineMode; // cartographer (default) | axe | hybrid
    contrastChecks?: boolean; // Enable contrast detection (default true in full mode)
    contrastMaxViolations?: number; // Cap on reported contrast violations per page (default 1000); the scan always covers the full page
  };

  checkpoint?: {
    interval: number; // Write state.json every N pages (default 500)
    enabled: boolean; // Enable checkpointing (default true)
    everySeconds?: number; // Optional: time-based checkpointing
  };

  network?: {
    proxy?: {
      enabled?: boolean;
      allowPrivateIps?: boolean;
      port?: number;
    };
    blockAnalytics?: boolean; // Block analytics/telemetry domains during rendering
    blockedDomains?: string[]; // Custom analytics domains to block when enabled
    retries?: {
      attempts?: number;
      backoffMs?: number;
      backoffMultiplier?: number;
      maxBackoffMs?: number;
      jitterPct?: number;
      pageAttempts?: number;
      pageBackoffMs?: number;
      pageBackoffMultiplier?: number;
      pageBackoffMaxMs?: number;
      pageJitterPct?: number;
      retryOn?: Array<number | "timeout">;
    };
    rateLimit?: {
      maxRetries?: number;
      retryFirstDelayMs?: number;
      retrySecondDelayMs?: number;
      firstHostPauseMs?: number;
      escalatedHostPauseMs?: number;
      strikeResetMs?: number;
    };
    blockContentTypes?: string[]; // Block responses with these MIME types (e.g., application/pdf)
    headers?: Record<string, string>; // Custom headers to send with requests
    /**
     * Route Phase A metadata fetching through the Playwright browser context
     * instead of Undici. Forces a single unified TLS fingerprint at the cost
     * of slight overhead. Useful when targeting sites with aggressive bot
     * mitigation that detect the Undici/Chromium identity split.
     */
    unifiedTransport?: boolean;
    /**
     * Upstream proxy servers for exit-node rotation.
     * When configured, the engine cycles through proxy URLs to avoid IP bans.
     */
    upstreamProxy?: {
      /** Proxy server URLs (e.g., "http://proxy1:8080", "socks5://proxy2:1080"). */
      urls: string[];
      /**
       * Rotation policy:
       * - round-robin: cycle proxies sequentially on each context creation
       * - on-block: rotate only when a hard block is detected
       * - random: select a random proxy for each context creation
       */
      rotationPolicy?: 'round-robin' | 'on-block' | 'random';
      /** HTTP status codes that indicate an IP ban and should trigger rotation (default: [403]). */
      blockStatusCodes?: number[];
      /** Consecutive block-status failures on a host before rotating (default: 2). */
      consecutiveBlockThreshold?: number;
    };
  };

  extraction?: {
    maxStructuredDataItems?: number; // Limit structured data payloads per page
    maxAssetsPerPage?: number; // Limit assets captured per page
    captureHealthWarnThreshold?: number; // Fallback-rate % to log a warning (0–1, default 0.10)
    captureHealthMetadataThreshold?: number; // Fallback-rate % to emit metadata (0–1, default 0.20)
  };

  shutdown?: {
    gracefulTimeoutMs: number; // Max time to wait for graceful shutdown (default 15000)
  };

  resume?: {
    crawlId?: string; // Resume from this crawl ID
    stagingDir?: string; // Path to staging directory to resume from
  };

  staging?: {
    /**
     * Where to place staging files during the crawl.
     * - temp (default): use OS temp; cleaned up after archive/validation.
     * - sidecar: alongside the .atls for inspection.
     */
    mode?: "temp" | "sidecar";
    /**
     * Keep staging after success. Default: false (auto-clean).
     */
    keep?: boolean;
    /**
     * Optional base directory for staging when debugging.
     */
    baseDir?: string;
    /**
     * Cleanup staging after success (and failures) when true.
     * Defaults to the inverse of keep.
     */
    cleanup?: boolean;
  };

  manifestNotes?: string[]; // Optional notes to add to manifest
  manifest?: {
    consumers?: string[];
    consumers_requirements?: Record<string, unknown>;
  };

  cli?: {
    quiet?: boolean; // Suppress periodic metrics output
    json?: boolean; // Emit JSON summary to stdout
    maxErrors?: number; // Max errors before aborting (-1 = unlimited, 0 = abort immediately, N = abort after N errors)
    logFile?: string; // Path to NDJSON log file
    logLevel?: "info" | "warn" | "error" | "debug"; // Minimum log level
    persistSession?: boolean; // Persist browser sessions per origin to bypass bot detection
    stealth?: boolean; // Enable stealth mode to hide automation signals
    validateArchive?: boolean; // Validate .atls archive after creation (QA check, default true)
    saveTraceOnError?: boolean; // Capture Playwright trace when a page fails
    /**
     * @deprecated Stored for legacy compatibility but never read downstream.
     * Fail-fast behavior is controlled entirely by cli.maxErrors === 0.
     */
    failFast?: boolean; // Abort the crawl on first unrecoverable error
  };
}

/**
 * Public API config type (alias for EngineConfig)
 */
export type CrawlConfig = EngineConfig;

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
  | { type: "crawl.started"; crawlId: string; config: CrawlConfig; origin?: "cartographer" | "scheduler"; seq: number; timestamp: string }
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
  dataset_id?: string;
  crawl_id?: string;
  atlasVersion: string; // "1.0"
  formatVersion: string; // "1.0.0" - Explicit format version for compatibility checks
  specVersion?: string;
  schemaVersion?: string;
  incomplete?: boolean;
  configSnapshot?: {
    requested?: Record<string, unknown>;
    effective?: Record<string, unknown>;
  };
  
  owner: {
    name: string; // "Cai Frazier"
  };
  
  consumers: string[]; // ["Continuum SEO", "Horizon Accessibility"]

  /**
   * Provenance source information (Atlas v1.0 Enhancement)
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

  site_root?: string;
  scope?: {
    seeds?: string[];
    allow?: string[];
    deny?: string[];
    block_params?: string[];
    follow_external?: boolean;
    max_pages?: number;
    max_depth?: number;
  };

  crawler_settings?: {
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

  url_normalization?: {
    lowercase_host?: boolean;
    remove_default_port?: boolean;
    strip_fragment?: boolean;
    remove_trailing_slash?: boolean;
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
  
  // Crawl timing (Atlas v1.0 Enhancement - Phase 3)
  crawl_started_at?: string;    // ISO timestamp when crawl began
  crawl_completed_at?: string;  // ISO timestamp when crawl finished
  
  // Producer metadata (Atlas v1.0 Enhancement - Phase 2)
  producer?: {
    name: string;                 // "cartographer-engine"
    version: string;              // "1.0.0-rc.1"
    build: string;                // "202510281348" (YYYYMMDDHHmm)
    git_hash?: string;            // "a1b2c3d4" (8-char short hash)
    command_line?: string;        // Full CLI invocation (PII-redacted)
  };
  
  // Environment snapshot (Atlas v1.0 Enhancement - Phase 2)
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
  
  // Privacy policy (Atlas v1.0 Spec - Phase 3B)
  privacy_policy?: {
    strip_cookies: boolean;        // Strip cookies from requests (default true)
    strip_auth_headers: boolean;   // Strip Authorization headers (default true)
    redact_inputs: boolean;        // Redact input field values (default true)
    redact_forms: boolean;         // Redact form data (default true)
    redact_pii: boolean;           // Redact obvious PII fields (default false)
  };
  
  // Robots.txt policy (Atlas v1.0 Spec - Phase 3B)
  robots_policy?: {
    respect: boolean;              // Respect robots.txt (default true)
    overrides_used: boolean;       // If true, robots.txt was overridden
    override_reason?: string;      // Reason for override (if overrides_used)
  };

  compare_compatibility?: {
    comparable_to?: string[];
    diff_safe?: boolean;
    diff_warnings?: string[];
  };
  
  // Crawl config hash (Atlas v1.0 Spec - Phase 3B)
  crawl_config_hash?: string;      // SHA-256 of normalized config for reproducibility
  
  hashing: {
    algorithm: string; // "sha256"
    urlKeyAlgo: string; // "sha1"
    rawHtmlHash: string; // "sha256 of raw HTTP body"
    domHash: string; // "sha256 of document.documentElement.outerHTML"
  };
  
  parts: {
    navigation: string[]; // ["navigation/part-001.jsonl.zst", ...]
    page_metadata: string[];
    content: string[];
    assets: string[];
    structured_data: string[];
    technology: string[];
    security: string[];
    accessibility: string[];
    responses?: string[];
    resources?: string[];
    events?: string[];
    pipeline_failures?: string[];
    pipeline_alerts?: string[];
    performance?: string[]; // prerender/full
    render_state?: string[]; // full only
    failed_pages?: string[]; // optional operational dataset
  };
  
  schemas: {
    navigation: string; // "schemas/navigation.v1.schema.json"
    page_metadata: string;
    content: string;
    assets: string;
    structured_data: string;
    technology: string;
    security: string;
    accessibility: string;
    responses?: string;
    resources?: string;
    events?: string;
    pipeline_failures?: string;
    pipeline_alerts?: string;
    performance?: string; // prerender/full
    render_state?: string; // full only
    failed_pages?: string; // optional operational dataset
  };
  
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
      // Per-part integrity checksums (Atlas v1.0 Enhancement - Phase 2)
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
  
  // Coverage matrix (Atlas v1.0 Enhancement - Phase 2)
  coverage?: {
    matrix: Array<{
      part: string;               // Dataset key (e.g. "navigation", "page_metadata", "security")
      expected: boolean;          // Should this part exist?
      present: boolean;           // Is this part present?
      row_count: number;          // Actual record count
      coverage_pct?: number;      // Optional: estimated completeness
      reason_if_absent?: string;  // "not_in_render_mode" | "no_records" | "disabled"
    }>;
    total_pages: number;
    successful_pages: number;
    failed_status_pages: number;
    pages_with_errors: number;
    incomplete: boolean;          // Crawl terminated early?
    truncated_parts?: string[];   // Parts that hit limits
  };
  
  configIncluded: boolean;
  redactionApplied: boolean;
  
  // Storage and compression configuration (Atlas v1.0 Enhancement - Phase 2)
  storage?: {
    compression: {
      algorithm: string;            // "zstd" for JSONL parts
      level?: number;               // Compression level (1-22 for zstd)
    };
    // Atlas v1.0 Spec additions - Phase 3B
    blob_format?: "zst" | "tar.zst";  // Individual files or packed
    replay_tier?: "html" | "html+css" | "full";  // Replay capture mode
    content_addressing?: "on" | "off";  // Content-addressed blob storage
    image_policy?: "none" | "dimensions" | "full";  // Image capture policy
    max_image_bytes?: number;  // Maximum image size in bytes
    
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
    algorithm?: string; // "sha256"
    content_sha256?: string; // Deterministic hash over sorted part hashes (not ZIP bytes)
    archiveSha256?: string; // Legacy alias for content hash
    files: Record<string, string>; // filename -> sha256
    audit_hash?: string;           // SHA-256 of sorted concatenated part hashes (Merkle root)
  };
  
  createdAt: string; // ISO timestamp
  generator: string; // "cartographer-engine/1.0.0"
}

/**
 * Summary statistics
 */
export interface AtlasSummary {
  // Identity - "what" was crawled
  identity: {
    seedUrls: string[];
    primaryOrigin: string; // e.g., "https://drancich.com"
    domain: string; // e.g., "drancich.com"
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
