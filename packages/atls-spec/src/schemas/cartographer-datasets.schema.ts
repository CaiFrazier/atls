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
 * Cartographer dataset schemas (writer-facing Atlas JSONL records)
 */

import { z } from "zod";
import { EventType } from "../types.js";
import { JsonValueSchema } from "./json-value.schema.js";
import { EdgeLocationEnum, LinkTypeEnum, ScreenshotTileSchema } from "./runtime-core.schema.js";

const StringMapSchema = z.record(z.string(), z.union([z.string(), z.null()]));

// BUG-0143: mirrors ScreenshotReference (types.ts) — a screenshot blob ref is
// either a plain blob-path string, or a tiled-capture manifest object.
const ScreenshotReferenceSchema = z.union([
  z.string(),
  z.object({
    src: z.string().optional(),
    tiles: z.array(ScreenshotTileSchema).optional(),
    totalHeight: z.number().optional(),
    totalWidth: z.number().optional(),
  }),
]);

/**
 * Field-level provenance tier.  See {@link FieldOriginTier} in types.ts.
 */
const FieldOriginTierSchema = z.enum([
  "capture",
  "measurement",
  "classification",
  "audit",
  "aggregation",
  "not_computed",
]);

/**
 * Optional per-record metadata envelope for field-level provenance tagging.
 * Keys in `fieldOrigins` use at most one `.` separator (max depth-1 override).
 */
export const RecordMetaSchema = z.object({
  fieldOrigins: z.record(z.string(), FieldOriginTierSchema),
}).strict();

export const PageMetadataDatasetRecordV1Schema = z.object({
  pageId: z.string().uuid(),
  url: z.string().url(),
  core: z.object({
    title: z.string().optional(),
    titleLength: z.number().int().nonnegative().optional(),
    metaDescription: z.string().optional(),
    descriptionLength: z.number().int().nonnegative().optional(),
    h1: z.string().optional(),
    canonicalTag: z.string().optional(),
    // BUG-0140: the canonical tag's href resolved to an ABSOLUTE URL against
    // the page's base URL — `canonicalTag` is the raw as-authored value (may
    // be relative), `canonicalResolved` is what it actually points at.
    canonicalResolved: z.string().optional(),
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
      unavailableAfter: z.string().optional(),
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
  // BUG-0143: screenshot/favicon blob refs were captured at write time
  // (ArtifactWriter's internal pageRecord.media) but never persisted into the
  // archived page_metadata record, so reconstruction_index's join to them was
  // always reading a field that never existed. Additive, non-breaking.
  media: z.object({
    screenshots: z.object({
      desktop: ScreenshotReferenceSchema.optional(),
      mobile: ScreenshotReferenceSchema.optional(),
      desktopFullPage: ScreenshotReferenceSchema.optional(),
      mobileFullPage: ScreenshotReferenceSchema.optional(),
    }).optional(),
    favicon: z.string().optional(),
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
  // BUG-0126: shares EdgeRecordSchema's enums instead of accepting any string —
  // the writer (extractors/navigation.ts, AssetProcessor.ts) emits only these
  // values, verified against source before tightening.
  location: EdgeLocationEnum.optional(),
  linkType: LinkTypeEnum.optional(),
  isPrimaryNav: z.boolean().optional(),
  isBreadcrumb: z.boolean().optional(),
  isSkipLink: z.boolean().optional(),
  isPagination: z.boolean().optional(),
  protocolClass: z.enum(["http", "https", "mailto", "tel", "javascript", "hash"]).optional(),
  anchorTextLength: z.number().int().nonnegative().optional(),
  emptyAnchorReason: z.string().optional(),
}).passthrough();

export const NavigationDatasetRecordV1Schema = z.object({
  pageId: z.string().uuid(),
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
  pageId: z.string().uuid(),
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
  // A capped debug prefix of the raw text for a payload that failed to parse
  // or was truncated (data is then {}). Absent for normal, valid items.
  rawText: z.string().optional(),
});

export const StructuredDataDatasetRecordV1Schema = z.object({
  pageId: z.string().uuid(),
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
  pageId: z.string().uuid(),
  url: z.string().url(),
  // BUG-0126: was z.array(z.record(JsonValue)) — accept-anything. The producer
  // (extractors/wappalyzer.ts) always emits {name, categories, version?} plus
  // extras (confidence/website/icon), preserved via passthrough.
  detectedTechnologies: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    categories: z.array(z.string()).optional(),
  }).passthrough()),
  serverSignatures: z.object({
    server: z.string().optional(),
    xPoweredBy: z.string().optional(),
    generator: z.string().optional(),
  }).passthrough().optional(),
  detectionTimestamp: z.number().int().optional(),
  _meta: RecordMetaSchema.optional(),
}).passthrough();

export const RenderStateDatasetRecordV1Schema = z.object({
  pageId: z.string().uuid(),
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
  pageId: z.string().uuid(),
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
    categoryMatcher: z.array(z.string()).nullable(),
  })),
  transport: z.object({
    protocol: z.enum(["http", "https"]),
  }).passthrough(),
  securityHeaders: z.record(z.string(), z.string().optional()),
  capturedAt: z.string().datetime(),
});

export const PerformanceDatasetRecordV1Schema = z.object({
  pageId: z.string().uuid(),
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
  // BUG-0131: optional — fetch/render-phase failures occur before a page UUID
  // is assigned; write-phase failures carry it. Join by url; pageId when present.
  pageId: z.string().uuid().optional(),
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
  eventId: z.string(),
  crawlId: z.string(),
  occurredAt: z.string().datetime(),
  eventType: z.enum(EventType.values),
  severity: z.enum(["info", "warn", "error", "critical"]),
  url: z.string().optional(),
  hostname: z.string().optional(),
  pageId: z.string().uuid().optional(),
  message: z.string(),
  details: z.record(z.string(), JsonValueSchema).optional(),
  metrics: z.object({
    durationMs: z.number().nonnegative().optional(),
    memoryRssMb: z.number().nonnegative().optional(),
    queueDepth: z.number().int().nonnegative().optional(),
    concurrentRequests: z.number().int().nonnegative().optional(),
  }).strict().optional(),
  // BUG-0127/0124: rich shapes ported from the EventRecord interface (were loose
  // z.record(JsonValue) — which also caused recursive-reference generator warnings).
  rateLimit: z.object({
    host: z.string(),
    statusCode: z.number().int().optional(),
    retryAfter: z.number().optional(),
    backoffMs: z.number().optional(),
    attempts: z.number().int().optional(),
  }).optional(),
  challenge: z.object({
    provider: z.string().nullable().optional(),
    detectionConfidence: z.enum(["high", "medium", "low"]),
    resolutionAttempted: z.boolean(),
    resolutionSuccess: z.boolean().optional(),
    waitDurationMs: z.number().optional(),
  }).optional(),
  resourceUsage: z.object({
    cpuPercent: z.number().optional(),
    memoryHeapMb: z.number().optional(),
    memoryExternalMb: z.number().optional(),
    gcDurationMs: z.number().optional(),
  }).optional(),
});

// ── Axe accessibility result (BUG-0127: rich types, was z.record(JsonValue)) ──
// Ported from the AxeAccessibilityRecord interface so the schema is the single
// source of truth and consumers keep full type detail. Objects are non-strict so
// axe-core's extra fields don't fail validation (writeAccessibility validates as a
// gate and writes the original record).
const AxeImpactSchema = z.enum(["minor", "moderate", "serious", "critical"]);

const AxeRelatedNodeSchema = z.object({
  target: z.array(z.string()),
  html: z.string().optional(),
});

const AxeCheckResultSchema = z.object({
  id: z.string(),
  impact: AxeImpactSchema.nullable().optional(),
  message: z.string(),
  data: z.record(z.string(), JsonValueSchema).nullable().optional(),
  relatedNodes: z.array(AxeRelatedNodeSchema).optional(),
});

const AxeNodeResultSchema = z.object({
  target: z.array(z.string()),
  html: z.string().optional(),
  impact: AxeImpactSchema.nullable().optional(),
  failureSummary: z.string().optional(),
  any: z.array(AxeCheckResultSchema).optional(),
  all: z.array(AxeCheckResultSchema).optional(),
  none: z.array(AxeCheckResultSchema).optional(),
});

const AxeRuleResultSchema = z.object({
  id: z.string(),
  impact: AxeImpactSchema.nullable().optional(),
  description: z.string(),
  help: z.string(),
  helpUrl: z.string(),
  tags: z.array(z.string()).optional(),
  nodes: z.array(AxeNodeResultSchema),
});

const AxeAuditSummarySchema = z.object({
  violations: z.number().int().nonnegative(),
  passes: z.number().int().nonnegative(),
  incomplete: z.number().int().nonnegative(),
  inapplicable: z.number().int().nonnegative(),
  impact: z.object({
    critical: z.number().int().nonnegative(),
    serious: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    minor: z.number().int().nonnegative(),
  }),
});

const AxeAccessibilityRecordSchema = z.object({
  pageUrl: z.string(),
  pageId: z.string(),
  normalizedUrl: z.string().optional(),
  auditEngine: z.enum(["cartographer", "axe", "hybrid"]),
  axeVersion: z.string(),
  renderMode: z.enum(["raw", "import", "prerender", "full"]),
  auditedAt: z.string(),
  summary: AxeAuditSummarySchema,
  testEngine: z.object({ name: z.string(), version: z.string() }),
  testRunner: z.object({ name: z.string(), version: z.string() }).optional(),
  testEnvironment: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  toolOptions: z.record(z.string(), JsonValueSchema).optional(),
  violations: z.array(AxeRuleResultSchema),
  passes: z.array(AxeRuleResultSchema).optional(),
  incomplete: z.array(AxeRuleResultSchema).optional(),
  inapplicable: z.array(AxeRuleResultSchema).optional(),
});

const AccessibilityFormControlsSchema = z.object({
  totalInputs: z.number().int().nonnegative(),
  missingLabel: z.number().int().nonnegative(),
  inputsMissingLabel: z.array(z.string()),
  missingAutocomplete: z.number().int().nonnegative().optional(),
  inputsMissingAutocomplete: z.array(z.string()).optional(),
  requiredInputs: z.number().int().nonnegative().optional(),
  requiredWithoutConstraint: z.number().int().nonnegative().optional(),
  inputsWithPattern: z.number().int().nonnegative().optional(),
  elements: z.array(z.object({
    selector: z.string(),
    tag: z.enum(["input", "textarea", "select"]),
    type: z.string().optional(),
    required: z.boolean(),
    hasLabel: z.boolean(),
    autocomplete: z.string().optional(),
    hasConstraint: z.boolean(),
  })).optional(),
});

const AccessibilityFocusOrderSchema = z.array(z.object({
  selector: z.string(),
  tabindex: z.number().int(),
}));

export const AccessibilityDatasetRecordV1Schema = z.object({
  pageId: z.string().uuid(),
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
  focusOrder: AccessibilityFocusOrderSchema.nullable().optional(),
  formControls: AccessibilityFormControlsSchema.nullable().optional(),
  // wcagData is a large, evolving collection the interface itself types as
  // `object | null`; kept as a JSON map (its own enrichment is a separate pass).
  wcagData: z.record(z.string(), JsonValueSchema).nullable().optional(),
  axe: AxeAccessibilityRecordSchema.optional(),
  auditEngine: z.object({
    name: z.string(),
    version: z.string(),
  }).optional(),
  wcagVersion: z.string().optional(),
  auditProfile: z.enum(["basic", "essential", "full", "custom"]).optional(),
  auditedAt: z.string().datetime().optional(),
  _meta: RecordMetaSchema.optional(),
});

export const SitemapDatasetRecordV1Schema = z.object({
  sitemapId: z.string(),
  crawlId: z.string(),
  url: z.string().url(),
  fetchedAt: z.string().datetime(),
  httpStatus: z.number().int(),
  contentType: z.string(),
  isIndex: z.boolean(),
  entriesFound: z.number().int().nonnegative(),
  entriesEnqueued: z.number().int().nonnegative(),
  parseWarning: z.boolean(),
  parseError: z.string().nullable(),
  depth: z.number().int().nonnegative(),
  referencedBy: z.string().url().nullable(),
});

export const FrontierLedgerRecordV1Schema = z.object({
  // BUG-0131: optional — discovery accounting is URL-keyed; a pageId exists
  // only for URLs that were actually visited/captured.
  pageId: z.string().uuid().optional(),
  url: z.string(),
  normalizedUrl: z.string(),
  status: z.enum(["discovered", "queued", "visited", "skipped"]),
  skipReason: z.string().optional(),
  depth: z.number().int().nonnegative().optional(),
  discoveredFrom: z.string().optional(),
  discoveredAt: z.string().datetime().optional(),
  hostGroup: z.string(),
});

/**
 * Quarantine dataset (BUG-0128): records that failed write-time schema
 * validation, preserved verbatim for forensic analysis. Deliberately NOT
 * enforced at the producer's write gate — a quarantine record that itself
 * failed validation would have nowhere to go. `pageId` is a plain string
 * (not `.uuid()`): the quarantined source record is malformed by definition,
 * so its identifiers may be too. `url` falls back to `unknown://record` when
 * the source record carries no usable URL.
 */
export const QuarantineRecordV1Schema = z.object({
  quarantineId: z.string().uuid(),
  crawlId: z.string(),
  pageId: z.string().optional(),
  url: z.string(),
  dataset: z.string(),
  validationError: z.string(),
  quarantinedAt: z.string().datetime(),
  rawRecord: JsonValueSchema,
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
export type QuarantineRecordV1 = z.infer<typeof QuarantineRecordV1Schema>;
