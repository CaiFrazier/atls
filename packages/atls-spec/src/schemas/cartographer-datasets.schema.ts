/**
 * Copyright © 2025 Cai Frazier.
 * Cartographer dataset schemas (writer-facing Atlas JSONL records)
 */

import { z } from "zod";
import { EventType } from "../types.js";
import { JsonValueSchema } from "./json-value.schema.js";

const StringMapSchema = z.record(z.string(), z.union([z.string(), z.null()]));

/**
 * Field-level provenance tier.  See {@link FieldOriginTier} in types.ts.
 */
const FieldOriginTierSchema = z.enum([
  "capture",
  "measurement",
  "classification",
  "audit",
  "aggregation",
]);

/**
 * Optional per-record metadata envelope for field-level provenance tagging.
 * Keys in `fieldOrigins` use at most one `.` separator (max depth-1 override).
 */
export const RecordMetaSchema = z.object({
  fieldOrigins: z.record(z.string(), FieldOriginTierSchema),
}).strict();

export const PageMetadataDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  core: z.object({
    title: z.string().optional(),
    titleLength: z.number().int().nonnegative().optional(),
    metaDescription: z.string().optional(),
    descriptionLength: z.number().int().nonnegative().optional(),
    h1: z.string().optional(),
    canonicalTag: z.string().optional(),
    language: z.string().optional(),
    charset: z.string().optional(),
    favicon: z.string().optional(),
    viewport: z.string().optional(),
    themeColor: z.string().optional(),
    generator: z.string().optional(),
  }).passthrough(),
  indexing: z.object({
    robotsMeta: z.string().optional(),
    xRobotsTag: z.string().optional(),
    robotsDirectives: z.object({
      noindex: z.boolean().optional(),
      nofollow: z.boolean().optional(),
      noarchive: z.boolean().optional(),
      nosnippet: z.boolean().optional(),
      noimageindex: z.boolean().optional(),
      unavailable_after: z.string().optional(),
    }).optional(),
  }).passthrough(),
  social: z.object({
    openGraph: StringMapSchema,
    twitterCard: StringMapSchema,
  }),
  resourceHints: z.object({
    preload: z.array(z.string()).optional(),
    prefetch: z.array(z.string()).optional(),
    preconnect: z.array(z.string()).optional(),
    dnsPrefetch: z.array(z.string()).optional(),
  }).optional(),
  capturedAt: z.string().datetime(),
});

const NavigationEdgeSchema = z.object({
  sourceUrl: z.string().optional(),
  targetUrl: z.string(),
  anchorText: z.string().optional(),
  rel: z.string().optional(),
  relTokens: z.array(z.string()).optional(),
  nofollow: z.boolean().optional(),
  isExternal: z.boolean().optional(),
  location: z.string().optional(),
  link_type: z.string().optional(),
  is_primary_nav: z.boolean().optional(),
  is_breadcrumb: z.boolean().optional(),
  is_skip_link: z.boolean().optional(),
  is_pagination: z.boolean().optional(),
  protocol_class: z.enum(["http", "https", "mailto", "tel", "javascript", "hash"]).optional(),
  anchorTextLength: z.number().int().nonnegative().optional(),
  emptyAnchorReason: z.string().optional(),
}).passthrough();

export const NavigationDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  sourceUrl: z.string().url(),
  edges: z.array(NavigationEdgeSchema),
  redirectChain: z.array(z.object({
    fromUrl: z.string(),
    toUrl: z.string(),
    statusCode: z.number().int(),
    redirectType: z.enum(["permanent", "temporary", "meta-refresh", "js-redirect"]),
  })).optional(),
  hreflang: z.array(z.object({
    lang: z.string(),
    url: z.string(),
    rel: z.string().optional(),
  })).optional(),
  pagination: z.object({
    hasPrevNext: z.boolean().optional(),
    relPrev: z.string().optional(),
    relNext: z.string().optional(),
    detectedPageNumber: z.number().int().positive().optional(),
  }).optional(),
  capturedAt: z.string().datetime(),
});

export const ContentDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  mainText: z.string(),
  contentHash: z.string(),
  previewSample: z.string().optional(),
  sampleWordCount: z.number().int().nonnegative().optional(),
  wordCount: z.number().int().nonnegative().optional(),
  textContentLength: z.number().int().nonnegative().optional(),
  headings: z.array(z.object({
    level: z.number().int().min(1).max(6),
    text: z.string(),
    position: z.number().int().positive(),
  })).optional(),
  headingOutline: z.object({
    h1Count: z.number().int().nonnegative().optional(),
    h2Count: z.number().int().nonnegative().optional(),
    h3Count: z.number().int().nonnegative().optional(),
    h4Count: z.number().int().nonnegative().optional(),
    h5Count: z.number().int().nonnegative().optional(),
    h6Count: z.number().int().nonnegative().optional(),
    multipleH1: z.boolean().optional(),
  }).passthrough().optional(),
  capturedAt: z.string().datetime(),
});

const StructuredDataItemSchema = z.object({
  type: z.string(),
  payload: z.record(z.string(), JsonValueSchema),
  source: z.string(),
  validationIssues: z.array(z.string()).optional(),
});

export const StructuredDataDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  jsonLd: z.array(StructuredDataItemSchema),
  microdata: z.array(z.object({
    itemType: z.string(),
    properties: z.record(z.string(), JsonValueSchema),
    source: z.string(),
  })),
  rdfa: z.array(z.object({
    itemType: z.string(),
    properties: z.record(z.string(), JsonValueSchema),
    source: z.string(),
  })).optional(),
  openGraph: z.array(StructuredDataItemSchema),
  twitterCard: z.array(StructuredDataItemSchema),
  schemaTypes: z.array(z.string()),
  schemaTypeTree: z.union([z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
  summary: z.object({
    hasJsonLd: z.boolean(),
    hasMicrodata: z.boolean(),
    hasRdfa: z.boolean(),
    hasOpenGraph: z.boolean(),
    hasTwitterCard: z.boolean(),
    itemCount: z.number().int().nonnegative(),
    bytesTotal: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  validationIssues: z.array(z.object({
    type: z.enum(["malformed_json", "unknown_type", "missing_required"]),
    message: z.string(),
    source: z.string(),
  })),
  capturedAt: z.string().datetime(),
});

export const TechnologyDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  detectedTechnologies: z.array(z.record(z.string(), JsonValueSchema)),
  serverSignatures: z.object({
    server: z.string().optional(),
    xPoweredBy: z.string().optional(),
    generator: z.string().optional(),
  }).passthrough().optional(),
  detectionTimestamp: z.number().int().optional(),
  _meta: RecordMetaSchema.optional(),
}).passthrough();

export const RenderStateDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
    devicePixelRatio: z.number().optional(),
  }).passthrough(),
  domSnapshot: z.record(z.string(), JsonValueSchema).optional(),
  computedText: z.record(z.string(), JsonValueSchema).optional(),
  accessibilityTree: z.record(z.string(), JsonValueSchema).optional(),
  captureTimestamp: z.number().int(),
});

export const SecurityDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  mixedContent: z.object({
    hasIssues: z.boolean(),
    resources: z.array(z.object({
      url: z.string(),
      type: z.string(),
      severity: z.enum(["active", "passive"]),
    })),
  }),
  subresourceIntegrity: z.object({
    checkedResources: z.number().int().nonnegative(),
    integrityMissing: z.array(z.object({
      url: z.string(),
      type: z.string(),
    })),
    integrityPresent: z.number().int().nonnegative(),
  }),
  contentSecurityPolicy: z.record(z.string(), JsonValueSchema).optional(),
  cookies: z.array(z.record(z.string(), JsonValueSchema)).optional(),
  storage: z.record(z.string(), JsonValueSchema).optional(),
  thirdPartyDomains: z.array(z.object({
    domain: z.string(),
    resourceCount: z.number().int().nonnegative(),
    resourceTypes: z.array(z.string()),
    category: z.enum(["analytics", "advertising", "cdn", "unknown"]),
    category_matcher: z.array(z.string()).nullable(),
  })),
  transport: z.object({
    protocol: z.enum(["http", "https"]),
  }).passthrough(),
  securityHeaders: z.record(z.string(), z.string().optional()),
  capturedAt: z.string().datetime(),
});

export const PerformanceDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  url: z.string().url(),
  labMetrics: z.record(z.string(), JsonValueSchema).optional(),
  resources: z.array(z.object({
    url: z.string(),
    type: z.string().optional(),
    status: z.number().int().optional(),
    contentType: z.string().optional(),
    timing: z.record(z.string(), JsonValueSchema).optional(),
    size: z.record(z.string(), JsonValueSchema).optional(),
    cached: z.boolean().optional(),
  }).passthrough()).optional(),
  summary: z.object({
    totalRequests: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    totalDuration: z.number().nonnegative(),
    breakdown: z.record(z.string(), JsonValueSchema),
    cachedRequests: z.number().int().nonnegative().optional(),
    uncachedRequests: z.number().int().nonnegative().optional(),
    failedRequests: z.number().int().nonnegative().optional(),
  }).passthrough(),
  renderHealth: z.record(z.string(), JsonValueSchema),
  capturedAt: z.string().datetime(),
  _meta: RecordMetaSchema.optional(),
});

export const PipelineFailureRecordV1Schema = z.object({
  url: z.string(),
  origin: z.string(),
  hostname: z.string(),
  occurredAt: z.string().datetime(),
  phase: z.enum(["fetch", "render", "extract", "write"]),
  code: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
  details: z.record(z.string(), JsonValueSchema).nullable().optional(),
});

export const PipelineAlertRecordV1Schema = PipelineFailureRecordV1Schema;

export const EventRecordV1Schema = z.object({
  event_id: z.string(),
  crawl_id: z.string(),
  occurred_at: z.string().datetime(),
  event_type: z.enum(EventType.values),
  severity: z.enum(["info", "warn", "error", "critical"]),
  url: z.string().optional(),
  hostname: z.string().optional(),
  page_id: z.string().uuid().optional(),
  message: z.string(),
  details: z.record(z.string(), JsonValueSchema).optional(),
  metrics: z.object({
    duration_ms: z.number().nonnegative().optional(),
    memory_rss_mb: z.number().nonnegative().optional(),
    queue_depth: z.number().int().nonnegative().optional(),
    concurrent_requests: z.number().int().nonnegative().optional(),
  }).strict().optional(),
  rate_limit: z.record(z.string(), JsonValueSchema).optional(),
  challenge: z.record(z.string(), JsonValueSchema).optional(),
  resource_usage: z.record(z.string(), JsonValueSchema).optional(),
});

export const AccessibilityDatasetRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  pageUrl: z.string().url(),
  missingAltCount: z.number().int().nonnegative(),
  headingOrder: z.array(z.enum(["H1", "H2", "H3", "H4", "H5", "H6"])),
  landmarks: z.object({
    header: z.boolean().optional(),
    nav: z.boolean().optional(),
    main: z.boolean().optional(),
    aside: z.boolean().optional(),
    footer: z.boolean().optional(),
  }).strict(),
  roles: z.record(z.string(), z.number().int().nonnegative()),
  missingAltSources: z.array(z.string()).optional(),
  contrastViolations: z.array(z.object({
    selector: z.string(),
    fg: z.string().optional(),
    bg: z.string().optional(),
    ratio: z.number().nonnegative(),
    level: z.enum(["AA", "AAA"]),
  })).optional(),
  ariaIssues: z.array(z.string()).optional(),
  lang: z.string().nullable().optional(),
  focusOrder: z.array(z.record(z.string(), JsonValueSchema)).nullable().optional(),
  formControls: z.record(z.string(), JsonValueSchema).nullable().optional(),
  wcagData: z.record(z.string(), JsonValueSchema).nullable().optional(),
  axe: z.record(z.string(), JsonValueSchema).optional(),
  audit_engine: z.object({
    name: z.string(),
    version: z.string(),
  }).optional(),
  wcag_version: z.string().optional(),
  audit_profile: z.enum(["basic", "essential", "full", "custom"]).optional(),
  audited_at: z.string().datetime().optional(),
  _meta: RecordMetaSchema.optional(),
});

export const SitemapDatasetRecordV1Schema = z.object({
  sitemap_id: z.string(),
  crawl_id: z.string(),
  url: z.string().url(),
  fetched_at: z.string().datetime(),
  http_status: z.number().int(),
  content_type: z.string(),
  is_index: z.boolean(),
  entries_found: z.number().int().nonnegative(),
  entries_enqueued: z.number().int().nonnegative(),
  parse_warning: z.boolean(),
  parse_error: z.string().nullable(),
  depth: z.number().int().nonnegative(),
  referenced_by: z.string().url().nullable(),
});

export const FrontierLedgerRecordV1Schema = z.object({
  url: z.string(),
  normalizedUrl: z.string(),
  status: z.enum(["discovered", "queued", "visited", "skipped"]),
  skipReason: z.string().optional(),
  depth: z.number().int().nonnegative().optional(),
  discoveredFrom: z.string().optional(),
  discoveredAt: z.string().datetime().optional(),
  hostGroup: z.string(),
});

export type PageMetadataDatasetRecordV1 = z.infer<typeof PageMetadataDatasetRecordV1Schema>;
export type NavigationDatasetRecordV1 = z.infer<typeof NavigationDatasetRecordV1Schema>;
export type ContentDatasetRecordV1 = z.infer<typeof ContentDatasetRecordV1Schema>;
export type StructuredDataDatasetRecordV1 = z.infer<typeof StructuredDataDatasetRecordV1Schema>;
export type TechnologyDatasetRecordV1 = z.infer<typeof TechnologyDatasetRecordV1Schema>;
export type RenderStateDatasetRecordV1 = z.infer<typeof RenderStateDatasetRecordV1Schema>;
export type SecurityDatasetRecordV1 = z.infer<typeof SecurityDatasetRecordV1Schema>;
export type PerformanceDatasetRecordV1 = z.infer<typeof PerformanceDatasetRecordV1Schema>;
export type PipelineFailureRecordV1 = z.infer<typeof PipelineFailureRecordV1Schema>;
export type PipelineAlertRecordV1 = z.infer<typeof PipelineAlertRecordV1Schema>;
export type EventRecordV1 = z.infer<typeof EventRecordV1Schema>;
export type AccessibilityDatasetRecordV1 = z.infer<typeof AccessibilityDatasetRecordV1Schema>;
export type SitemapDatasetRecordV1 = z.infer<typeof SitemapDatasetRecordV1Schema>;
export type FrontierLedgerRecordV1 = z.infer<typeof FrontierLedgerRecordV1Schema>;
