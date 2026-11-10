# Atlas Dataset Reference

The complete, code-verified field reference for every dataset record in an `.atls` archive. This
is the normative reference; the per-dataset `schemas/*.v1.schema.json` files in each archive are
the machine-validatable form.

_Verified against the dataset Zod schemas on 2026-11-10. Current schema tag: `2026-09-04`._

---

## Conventions

- **Casing:** dataset record fields are camelCase from schema tag `2026-07-01` onward, with the
  exceptions the schemas still spell in snake_case (notably `page_metadata.capture_degraded` and
  `page_metadata.degraded_reason`). Spec 1.2 does not rename keys. Spec 2.0 is the camelCase
  target, and 1.x readers keep accepting the snake_case keys. See
  [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).
- **Join key:** every page-scoped record carries `pageId`. Where the schema uses
  `z.string().uuid()`, any UUID version matches. Spec 1.2 writers use the versions in
  [identity-and-keys.md](./identity-and-keys.md).
- **Presence:** the matrix below is producer guidance, not a validity rule. A dataset the matrix
  omits for a mode still validates if its record matches the Zod schema. The manifest must declare
  `page_metadata` (`datasets.page_metadata`, or a non-empty `parts.page_metadata`). It may contain
  zero records. Spec 1.2 does not turn the rest of the matrix into a schema constraint.

## Presence by render mode

| Dataset | raw | prerender | full | Key | Schema |
|---|:--:|:--:|:--:|---|---|
| `page_metadata` | ✓ | ✓ | ✓ | `pageId` | Zod |
| `navigation` | ✓ | ✓ | ✓ | `pageId` | Zod |
| `content` | ✓ | ✓ | ✓ | `pageId` | Zod |
| `responses` | ✓ | ✓ | ✓ | `pageId` | Zod |
| `assets` | ✓ | ✓ | ✓ | `pageId`/`assetId` | Zod |
| `technology` | ✓ | ✓ | ✓ | `pageId` | Zod |
| `events` | ✓ | ✓ | ✓ | `eventId` | Zod |
| `pipeline_failures` | ✓ | ✓ | ✓ | `pageId?` | Zod |
| `pipeline_alerts` | ✓ | ✓ | ✓ | `pageId?` | Zod |
| `quarantine` | ✓* | ✓* | ✓* | `quarantineId` | Zod |
| `structured_data` | — | ✓ | ✓ | `pageId` | Zod |
| `security` | — | ✓ | ✓ | `pageId` | Zod |
| `accessibility` | ✓ (base) | ✓ (+forms/focus) | ✓ (+wcag/axe) | `pageId` | Zod |
| `performance` | — | ✓ | ✓ | `pageId` | Zod |
| `render_state` | — | — | ✓ | `pageId` | Zod |
| `resources` | — | — | ✓* | `resId` | Zod |
| `sitemaps` | ✓* | ✓* | ✓* | `sitemapId` | Zod |
| `sitemap_urls` | ✓* | ✓* | ✓* | `loc` | Zod |
| `extraction` | ✓* | ✓* | ✓* | `pageId`+`ruleId` | Zod |
| `reconstruction_index` | ✓† | ✓† | ✓† | `pageId` | Zod |
| `frontier_ledger` | opt | opt | opt | `url`, `pageId?` | Zod |

`*` pruned/written only when records exist · `†` built at finalization under default replay tier.
Every emitted dataset now has a published Zod schema in `@caifrazier/atls-spec` (see
[schema-system.md](./schema-system.md)).

---

## page_metadata

On-page SEO signals. Schema: `PageMetadataDatasetRecordV1Schema`. Key: `pageId` (`z.string().uuid()`).

- `pageId` · `url` · `capturedAt` (ISO 8601) — root. `capturedAt` is required. `url` is the
  final URL after redirects. Identity for `urlKey` uses `normalizeUrl` of this URL. See
  [url-identity.md](./url-identity.md).
- `core` (object): `title`, `titleLength`, `metaDescription`, `descriptionLength`, `h1`,
  `canonicalTag`, `canonicalResolved`, `language`, `charset`, `favicon`, `viewport`, `themeColor`,
  `generator`. `canonicalTag` is the raw authored value. `canonicalResolved` is that href resolved
  to an absolute URL. `core` is `passthrough` — extra keys may appear.
- `indexing` (object): `robotsMeta` (raw `<meta robots>`), `xRobotsTag` (raw header), and
  `robotsDirectives` — a **nested boolean object**: `noindex`, `nofollow`, `noarchive`,
  `nosnippet`, `noimageindex`, plus `unavailableAfter` (string date).
- `social` (object): `openGraph` (string map), `twitterCard` (string map). Both are required when
  `social` is present, and `social` itself is required.
- `resourceHints` (object, optional): `preload`, `prefetch`, `preconnect`, `dnsPrefetch` — each an
  array of URL strings.
- `media` (object, optional): `screenshots` (`desktop`, `mobile`, `desktopFullPage`,
  `mobileFullPage` — each a blob-path string or a tiled-capture object with `src`, `tiles`,
  `totalHeight`, `totalWidth`) and `favicon` (blob path).
- `capture_degraded` (optional boolean) and `degraded_reason` (optional string). These two names
  are snake_case on this otherwise camelCase record.
- `limits` (object, optional): `requestsCapped`, `maxRequestsPerPage`, `bytesCapped`,
  `maxBytesPerPage`, `assetsTruncated`, `maxAssetsPerPage`, `structuredDataTruncated`,
  `maxStructuredDataItems`, `totalRequests`, `totalBytes`.

---

## navigation

Per-page link graph. Schema: `NavigationDatasetRecordV1Schema`. Key: `pageId` (`z.string().uuid()`).

- `pageId` · `sourceUrl` · `capturedAt` — root.
- `edges[]` (array): one per outbound link —
  `sourceUrl`, `targetUrl` (**required**), `anchorText`, `anchorTextLength`, `rel`, `relTokens[]`,
  `nofollow`, `isExternal`, `location` (nav/header/footer/aside/main/other), `linkType`,
  `isPrimaryNav`, `isBreadcrumb`, `isSkipLink`, `isPagination`,
  `protocolClass` (`http\|https\|mailto\|tel\|javascript\|hash`), `emptyAnchorReason`.
- `redirectChain[]` (optional): `{ fromUrl, toUrl, statusCode, redirectType }` where
  `redirectType` ∈ `permanent\|temporary\|meta-refresh\|js-redirect`.
- `hreflang[]` (optional): `{ lang, url, rel }`.
- `pagination` (optional): `hasPrevNext`, `relPrev`, `relNext`, `detectedPageNumber`.

The link graph lives **here**, in `edges[]` — there is no separate `edges/` dataset.

---

## content

Extracted text and headings. Schema: `ContentDatasetRecordV1Schema`. Key: `pageId` (`z.string().uuid()`).

- `pageId` · `url` · `capturedAt` — root.
- `mainText` (**required**) — full normalized body text.
- `contentHash` (**required**) — SHA-256 of normalized text (change detection).
- `previewSample`, `sampleWordCount`, `wordCount`, `textContentLength`.
- `headings[]`: `{ level (1–6), text, position }`.
- `headingOutline`: `h1Count`…`h6Count`, `multipleH1` (boolean).

---

## responses

Network truth. Schema: `ResponseRecordV1Schema`. Key: `pageId` (`z.string().uuid()`).

Two kinds of row share this schema. The schema does not use a discriminated union; body fields
are optional so both kinds validate.

- **Terminal rows** — the crawled request's final response, including `statusCode` `0` when no
  HTTP response was received. Producers set `encoding` and `bodyBlobRef` on these rows.
  `page_metadata.url` matches this row's final URL. `responses.url` on this row is the URL that
  was requested, which is the last hop, not the original request when a redirect happened.
- **Redirect rows** — one row per intermediate 3xx hop, keyed by that hop's requested `url`.
  `isRedirect` is `true`, `statusCode` is the 3xx status, and `location` is the next hop.
  `redirectType` classifies the hop. These rows omit `encoding` and `bodyBlobRef`.
  `finalUrl` on a redirect row is the terminal URL, not the hop URL.

Fields:

- `pageId` · `url` · `finalUrl` · `statusCode` (integer 0–599). These four are required.
- `statusText`, `requestMethod`, `responseType`, `fromCache`.
- `redirectChain[]` (array of strings), `redirectChainLength`.
- `isRedirect`, `location`, `redirectType` — redirect rows. Terminal rows omit them.
- `contentType`, `contentLength`, `headers` (normalized map), `setCookie` (every `Set-Cookie`
  value; `headers` keeps only the first).
- Timing: `fetchStartedAt`, `fetchCompletedAt`, `renderStartedAt`, `renderCompletedAt`,
  `fetchMs`, `renderMs`, `renderMode`, `navEndReason`.
- `encoding` — character encoding. Optional. Absent on redirect rows.
- `bodyBlobRef` — blob ref to the source HTML body. Optional. Absent on redirect rows.
- `renderedBodyBlobRef`, `renderedDomHash` — post-JS rendered HTML.

Use `responses.statusCode` as the transport truth — `page_metadata` has no status field.

---

## assets

Images, video, audio, documents. Schema: `AssetRecordSchema` (generated as `assets.v1.schema.json`).
Keys: `pageId` (`z.string().uuid()`) and `assetId` (`z.string().min(1)`). A UUID v5 producer
convention is not a schema constraint.

- Identity: `pageId`, `assetId`, `pageUrl`, `assetUrl`, `type` (`image\|video\|audio\|document`).
- Image basics: `alt`, `hasAlt`, `naturalWidth/Height`, `displayWidth/Height`, `estimatedBytes`,
  `visible` (null in raw), `inViewport` (null in raw), `loading`, `wasLazyLoaded`.
- Responsive: `srcset`, `srcsetCandidates[]` (`{url, descriptor, width, density}`), `sizes`,
  `pictureContext` (`hasPictureParent`, `sourceCount`, `sources[] {srcset, media, type}`).
- Media (video/audio): `duration`, `mimeType`, `hasControls`, `autoplay`, `loop`, `muted`,
  `preload` (`none\|metadata\|auto`), `poster`, `tracks[]` (`{kind, src, srclang, label}`),
  `sources[]` (`{src, type}`).
- Lazy loading: `lazyStrategy` (`native\|intersection-observer\|data-src\|none`),
  `lazyDataAttrs` (`data_src`, `data_srcset`, `data_sizes`, `data_bg`), `lazyClasses[]`.
- Misc: `occurrenceCount`, `resourceHint` (`{resId, bodyBlobRef, sizeBytes}`),
  `tiles[]` (`{src, height, width, y, path}` — tiled screenshots).

---

## structured_data

Schema.org and social markup. Schema: `cartographer-datasets.schema.ts` (`StructuredDataDatasetRecordV1Schema`). Key: `pageId`.
Present in prerender/full.

- `pageId` · `url` · `capturedAt`.
- `jsonLd[]`: `{ id, type, payload, source, graphPointer?, diagnosticIds?, validationIssues[] }`.
- `microdata[]`: `{ id, itemType, properties, source, diagnosticIds? }`.
- `rdfa[]`: `{ id, itemType, properties, source, diagnosticIds? }`.
- `openGraph[]` / `twitterCard[]`: `{ type, payload, source, validationIssues[] }`.
- `schemaTypes[]` — unique types found. `schemaTypeTree` — hierarchical type view.
- `summary`: `hasJsonLd`, `hasMicrodata`, `hasRdfa`, `hasOpenGraph`, `hasTwitterCard`, `itemCount`,
  `bytesTotal`, `truncated`.
- `validationIssues[]`: legacy extraction/parser issues. This field does not establish Schema.org validity.
- `captureIssues[]`: typed capture and syntax diagnostics with item ids, evidence plane, severity,
  certainty, and JSON Pointer path.
- `schemaOrgAudit`: non-destructive vocabulary audit output. It records the audit engine version,
  pinned Schema.org vocabulary version, source URL, release date, and SHA-256, outcome (`no_findings\|findings\|not_applicable`),
  coverage (`complete\|partial\|unavailable`), diagnostic counts, and typed diagnostics. Schema.org
  domains and ranges are treated as expected-use guidance, so mismatches are findings rather than
  grounds for discarding captured markup.

Archive contract validation checks this record's shape and reference integrity. It does not turn a
`schemaOrgAudit.outcome` into an archive-valid/archive-invalid verdict.

---

## technology

Detected stack. Schema: `TechnologyDatasetRecordV1Schema` (the record itself is `.passthrough()`). Key: `pageId` (`z.string().uuid()`).

- `pageId` · `url`.
- `detectedTechnologies[]` — Wappalyzer-style entries (name, version, categories…).
- `serverSignatures`: `server`, `xPoweredBy`, `generator`.
- `detectionTimestamp` (unix).
- `_meta.fieldOrigins` — field-level provenance tier map (when present).

---

## security

Transport and third-party posture. Schema: `SecurityDatasetRecordV1Schema`. Key:
`pageId`. Present in prerender/full.

- `pageId` · `url` · `capturedAt`.
- `mixedContent`: `hasIssues`, `resources[] {url, type, severity (active\|passive)}`.
- `subresourceIntegrity`: `checkedResources`, `integrityMissing[] {url, type}`, `integrityPresent`.
- `contentSecurityPolicy` (parsed CSP map), `cookies[]`, `storage`.
- `thirdPartyDomains[]`: `{ domain, resourceCount, resourceTypes[], category
  (analytics\|advertising\|cdn\|unknown), categoryMatcher }`.
- `transport.protocol` (`http\|https`), `securityHeaders` (header → value/null).
- `forms[]` (B2 / schemaVersion `2026-07-16`, optional): per-`<form>` submission-security
  facts — `formIndex`, `selector`, `method`, `actionRaw`/`actionNormalized`/`actionProtocol`/
  `actionOrigin`, `actionState` (`same-origin\|external\|insecure\|relative\|malformed`),
  `mixedAction`, `hasPasswordField`, and `sensitiveControls[] {name, type}`. **Never captures
  input values** — only control name + type. Form actions also strip userinfo, query parameters,
  and fragments before persistence, so credentials embedded in an action URL are not archived.
  Absent on pre-B2 archives; the presence of the
  `forms` field (vs. its absence) is the degrade signal, since the `security` dataset itself
  predates B2.

---

## accessibility

WCAG audit. Schema: `AccessibilityDatasetRecordV1Schema`. Key: `pageId` (`z.string().uuid()`). Field depth grows
with render mode.

**Base (all modes):** `pageId`, `pageUrl`, `missingAltCount`, `headingOrder[]`,
`landmarks` (`header`, `nav`, `main`, `aside`, `footer` booleans), `roles` (ARIA role → count),
`missingAltSources[]`.

**Prerender additions:** `contrastViolations[]` (`{selector, fg, bg, ratio, level (AA\|AAA)}`),
`ariaIssues[]`, `lang`, `focusOrder[]` (`{selector, tabindex}`),
`formControls` (`totalInputs`, `missingLabel`, `inputsMissingLabel[]`, autocomplete/constraint
counts, `elements[] {selector, tag, type, required, hasLabel, autocomplete, hasConstraint}`).

**Full additions:** `wcagData` (full WCAG dict), `axe` (complete axe-core result:
violations/passes/incomplete/inapplicable), `auditEngine {name, version}`, `wcagVersion`,
`auditProfile` (`basic\|essential\|full\|custom`), `auditedAt`, `_meta`.

> Known issue: `contrastViolations` over-reports (~87% false positives) because the detector
> ignores transparent backgrounds and mis-pairs foreground color. Prefer `axe` contrast rules.
> Tracked as **BUG-0013**.

---

## performance

Resource timing and lab metrics. Schema: `PerformanceDatasetRecordV1Schema`. Key:
`pageId`. Present in prerender/full.

- `pageId` · `url` · `capturedAt`.
- `labMetrics` (record), `renderHealth` (FCP/LCP/CLS/TTI etc).
- `resources[]`: `{ url, type, status, contentType, timing, size, cached }`.
- `summary`: `totalRequests`, `totalBytes`, `totalDuration`, `breakdown` (by type),
  `cachedRequests`, `uncachedRequests`, `failedRequests`.
- `_meta.fieldOrigins`.

---

## render_state

Post-render DOM capture. Schema: `RenderStateDatasetRecordV1Schema`. Key: `pageId`
(`z.string().uuid()`). The reference producer writes this dataset in `full` mode. The schema does
not enforce that.

- `pageId` · `url` · `captureTimestamp` (unix ms, required).
- `viewport`: `width`, `height`, `devicePixelRatio` (optional).
- `domSnapshot`, `computedText`, `accessibilityTree` — each an optional free JSON object
  (`z.record`). They are not typed as `dom_snapshot.v1` or `acc_tree.v1`.

`dom_snapshot.v1`, `acc_tree.v1`, and `render.v1` are published schemas and are not dataset
directories. See [schema-system.md](./schema-system.md) and
[OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).

---

## resources

Sub-resource network log. Schema: `ResourceRecordV1Schema`. Key: `resId` (`z.string().uuid()`, any
version). Page link: `ownerPageId`. The reference producer writes this in full mode and prunes
the directory when it is empty. The schema does not enforce the mode.

- `resId` · `ownerPageId` · `url` · `type` (`css\|js\|font\|image`).
- `status`, `contentType`, `hashBodySha256`, `bodyBlobRef`, `sizeBytes`, `critical`.

---

## sitemaps

Sitemap discovery. Schema: `SitemapDatasetRecordV1Schema`. Key: `sitemapId` (`z.string()`, not a
UUID check). Carries `crawlId`, not `pageId`. The reference producer writes this only when
sitemaps were discovered.

- `sitemapId` · `crawlId` · `url` · `fetchedAt` · `httpStatus` · `contentType`.
- `isIndex`, `entriesFound`, `entriesEnqueued`, `parseWarning`, `parseError` (nullable),
  `depth`, `referencedBy` (nullable parent sitemap URL).
- `truncated` (optional, B4 / schemaVersion `2026-07-16`): `true` when a discovery cap stopped this
  sitemap's entries from all being processed. Absent on older archives — treat as *unknown*, not
  `false`.

---

## sitemap_urls

Per-URL sitemap entries (B4 / schemaVersion `2026-07-16`). One record per `<url>` in a non-index
sitemap, preserving the per-entry metadata the crawl parses. Schema:
`cartographer-datasets.schema.ts` (`SitemapUrlDatasetRecordV1Schema`). Carries `crawlId`, not
`pageId`. Written only when a sitemap declared URLs. Reader: `atlas.readers.sitemapUrls()`.

- `crawlId` · `sourceSitemapUrl` (the sitemap file that declared this URL) · `loc` (raw `<loc>`).
- `normalizedUrl` (nullable — `null` when the URL was filtered out of scope by crawl policy).
- `lastmod`, `changefreq`, `priority` (all nullable — as declared).
- `enqueued`: the engine accepted the URL into the frontier as a new entry. Not a crawl-outcome
  claim; join `normalizedUrl` to the pages actually captured to classify missing-from-crawl.

The crawl-level rollup is `manifest.sitemapCoverage` (`absent`\|`failed`\|`partial`\|`complete`).

---

## extraction

Custom extraction-rule results (B1 / schemaVersion `2026-07-17`). One record per page ×
consumer-configured rule. Schema: `cartographer-datasets.schema.ts`
(`ExtractionDatasetRecordV1Schema`). Present ONLY when the crawl ran with rules; the
`extraction.rules` capability flag advertises that. Reader: `atlas.readers.extraction()`.

Rule DEFINITIONS are mutable and live in the consumer (Continuum registry); the archive
records only the immutable outcome plus a crawl-time snapshot, so editing a rule never
rewrites a historical archive.

- `crawlId` · `pageId` · `url` — page anchors.
- `ruleId` · `ruleVersion` — rule provenance.
- `ruleName` · `kind` (`css`\|`xpath`\|`regex`) · `expression` · `attribute` · `multiplicity` ·
  `failurePolicy` · `valueType` (`text`\|`number`\|`boolean`\|`date`) · `evaluatorVersion` —
  the complete evaluator input and policy snapshot at crawl time. The added hotfix.2 fields are
  optional so archives written before evaluator version 2 remain valid.
- `sourceStage`: which captured source was read — `raw` (pre-JS server body, every mode) or
  `rendered` (browser DOM, prerender/full crawls).
- `status`: `ok` (values extracted) · `empty` (evaluated, nothing matched) · `error` (the rule
  failed on this page; see `error`) · `unavailable-source` (the mode never produced the source
  the rule targets — honesty state, NOT an empty result).
- `values`: typed extracted values (bounded by the engine's match cap).
- `truncatedMatches`: the cap truncated the result set (disclosed, never silent).

---

## events

Operational telemetry. Schema: `EventRecordV1Schema`. Key: `eventId` (`z.string()`, not a UUID
check). Optional `pageId` (`z.string().uuid()`). The reference producer always writes this dataset.

- `eventId` · `crawlId` · `occurredAt` · `eventType` (enum) · `severity`
  (`info\|warn\|error\|critical`) · `message`.
- `url`, `hostname`, `pageId`, `details` (record).
- `metrics`: `durationMs`, `memoryRssMb`, `queueDepth`, `concurrentRequests`.
- `rateLimit`, `challenge`, `resourceUsage` — free-form context maps on the relevant events.

`eventType` values include `crawl.*`, `page.*`, `render.*`, `rateLimit.*`, `backpressure.*`,
`resource.*`, `network.*`, `validation.*`, `checkpoint.*`, `observability.*` (full enum in
`types.ts`).

---

## pipeline_failures / pipeline_alerts

Hard failures and non-fatal alerts. Schema: `PipelineFailureRecordV1Schema`
(`pipeline_alerts` is the same shape). `pageId` is an optional UUID: fetch and render failures
can happen before a page id exists. Join by `url`, and by `pageId` when it is present.

- `pageId` (optional UUID) · `url` · `origin` · `hostname` · `occurredAt` · `phase`
  (`fetch`\|`render`\|`extract`\|`write`).
- `code`, `message` (required), `stack`, `details` (nullable record).

---

## quarantine

Records that failed schema validation, retained for forensics. Schema:
`cartographer-datasets.schema.ts` (`QuarantineRecordV1Schema`, generated as
`quarantine.v1.schema.json`). Keys: `quarantineId` + `crawlId`.

- `quarantineId` · `crawlId` · `pageId` (optional) · `url`.
- `dataset` — which dataset's record failed.
- `validationError`, `quarantinedAt`, `rawRecord` (the original malformed record).

---

## reconstruction_index

Per-page replay index, built at finalization. Schema: `reconstruction_index.schema.ts`. Key:
`pageId`.

- `pageId` · `url` · `finalUrl` · `title`.
- Blob refs: `faviconBlobRef`, `sourceBodyBlobRef`, `renderedBodyBlobRef` (full),
  `screenshotDesktopBlobRef`, `screenshotMobileBlobRef`.
- `domSnapshotPresent` (boolean).
- `stylesheets[]` / `scripts[]` / `fonts[]` / `images[]` — each `{ url, blobRef }`.
- `internalLinks[]`: `{ url, anchorText, targetPageId }`.

---

## frontier_ledger

Discovery accounting. Schema: `FrontierLedgerRecordV1Schema`. Key: `url`. `pageId` is an optional
UUID, set when the URL was visited. The reference producer writes this dataset only when a
discovery tracker is wired.

- `url` · `normalizedUrl` · `status` (`discovered`\|`queued`\|`visited`\|`skipped`) · `hostGroup`.
- `pageId` (optional UUID), `skipReason`, `depth`, `discoveredFrom`, `discoveredAt`.

---

_Last verified against the dataset Zod schemas: 2026-11-10._
