# Atlas Dataset Reference

The complete, code-verified field reference for every dataset record in an `.atls` archive. This
is the normative reference; the per-dataset `schemas/*.v1.schema.json` files in each archive are
the machine-validatable form.

_Verified against `packages/atls-spec/src/schemas/cartographer-datasets.schema.ts`,
`responses.schema.ts`, `resources.schema.ts`, `reconstruction_index.schema.ts`, and
`packages/atls-spec/src/types.ts` on 2026-06-04._

---

## Conventions

- **Casing:** all dataset record fields are camelCase (RC2+, `schemaVersion >= 2026-07-01`).
  Older archives predating the naming-parity sweep may contain snake_case fields — readers
  targeting legacy archives should tolerate both spellings.
- **Join key:** every page-scoped record carries `pageId` (UUID v7). Exceptions are called out
  per dataset — see [identity-and-keys.md](./identity-and-keys.md).
- **Presence:** which datasets appear depends on render mode. The matrix below is authoritative.

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
| `pipeline_failures` | ✓ | ✓ | ✓ | — | Zod |
| `pipeline_alerts` | ✓ | ✓ | ✓ | — | Zod |
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
| `frontier_ledger` | opt | opt | opt | `url` | Zod |

`*` pruned/written only when records exist · `†` built at finalization under default replay tier.
Every emitted dataset now has a published Zod schema in `@caifrazier/atls-spec` (see
[schema-system.md](./schema-system.md)).

---

## page_metadata

On-page SEO signals. Schema: `cartographer-datasets.schema.ts:31-71`. Key: `pageId`.

- `pageId` · `url` · `capturedAt` (ISO 8601) — root.
- `core` (object): `title`, `titleLength`, `metaDescription`, `descriptionLength`, `h1`,
  `canonicalTag`, `language`, `charset`, `favicon`, `viewport`, `themeColor`, `generator`.
  `core` is `passthrough` — extra keys may appear.
- `indexing` (object): `robotsMeta` (raw `<meta robots>`), `xRobotsTag` (raw header), and
  `robotsDirectives` — a **nested boolean object**: `noindex`, `nofollow`, `noarchive`,
  `nosnippet`, `noimageindex`, plus `unavailableAfter` (string date).
- `social` (object): `openGraph` (string map), `twitterCard` (string map).
- `resourceHints` (object, optional): `preload`, `prefetch`, `preconnect`, `dnsPrefetch` — each an
  array of URL strings.

---

## navigation

Per-page link graph. Schema: `cartographer-datasets.schema.ts:92-114`. Key: `pageId`.

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

Extracted text and headings. Schema: `cartographer-datasets.schema.ts:116-140`. Key: `pageId`.

- `pageId` · `url` · `capturedAt` — root.
- `mainText` (**required**) — full normalized body text.
- `contentHash` (**required**) — SHA-256 of normalized text (change detection).
- `previewSample`, `sampleWordCount`, `wordCount`, `textContentLength`.
- `headings[]`: `{ level (1–6), text, position }`.
- `headingOutline`: `h1Count`…`h6Count`, `multipleH1` (boolean).

---

## responses

Network truth — one record per fetched page. Schema: `responses.schema.ts`. Key: `pageId`.

- `pageId` · `url` · `finalUrl` · `statusCode` (**required**).
- `statusText`, `requestMethod`, `responseType`, `fromCache`.
- `redirectChain[]`, `redirectChainLength`.
- `contentType`, `contentLength`, `headers` (normalized map).
- Timing: `fetchStartedAt`, `fetchCompletedAt`, `renderStartedAt`, `renderCompletedAt`,
  `fetchMs`, `renderMs`, `renderMode`, `navEndReason`.
- `encoding` (**required**) — character encoding.
- `bodyBlobRef` (**required**) — blob ref to the source HTML body.
- `renderedBodyBlobRef`, `renderedDomHash` — post-JS rendered HTML (full mode only).

Use `responses.statusCode` as the transport truth — `page_metadata` has no status field.

---

## assets

Images, video, audio, documents. Schema: `runtime-core.schema.ts` (`AssetRecordSchema`, generated
as `assets.v1.schema.json`). Keys: `pageId` + `assetId` (UUID v5, deterministic).

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

Schema.org and social markup. Schema: `cartographer-datasets.schema.ts:149-183`. Key: `pageId`.
Present in prerender/full.

- `pageId` · `url` · `capturedAt`.
- `jsonLd[]`: `{ type, payload, source, validationIssues[] }`.
- `microdata[]`: `{ itemType, properties, source }`.
- `rdfa[]`: `{ itemType, properties, source }`.
- `openGraph[]` / `twitterCard[]`: `{ type, payload, source, validationIssues[] }`.
- `schemaTypes[]` — unique types found. `schemaTypeTree` — hierarchical type view.
- `summary`: `hasJsonLd`, `hasMicrodata`, `hasRdfa`, `hasOpenGraph`, `hasTwitterCard`, `itemCount`,
  `bytesTotal`, `truncated`.
- `validationIssues[]`: `{ type (malformed_json\|unknown_type\|missing_required), message, source }`.

---

## technology

Detected stack. Schema: `cartographer-datasets.schema.ts:185-196`. Key: `pageId`.

- `pageId` · `url`.
- `detectedTechnologies[]` — Wappalyzer-style entries (name, version, categories…).
- `serverSignatures`: `server`, `xPoweredBy`, `generator`.
- `detectionTimestamp` (unix).
- `_meta.fieldOrigins` — field-level provenance tier map (when present).

---

## security

Transport and third-party posture. Schema: `cartographer-datasets.schema.ts:212-246`. Key:
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

WCAG audit. Schema: `cartographer-datasets.schema.ts:311-346`. Key: `pageId`. Field depth grows
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

Resource timing and lab metrics. Schema: `cartographer-datasets.schema.ts:248-273`. Key:
`pageId`. Present in prerender/full.

- `pageId` · `url` · `capturedAt`.
- `labMetrics` (record), `renderHealth` (FCP/LCP/CLS/TTI etc).
- `resources[]`: `{ url, type, status, contentType, timing, size, cached }`.
- `summary`: `totalRequests`, `totalBytes`, `totalDuration`, `breakdown` (by type),
  `cachedRequests`, `uncachedRequests`, `failedRequests`.
- `_meta.fieldOrigins`.

---

## render_state

Post-render DOM capture. Schema: `cartographer-datasets.schema.ts:198-210`. Key: `pageId`. **Full
mode only.**

- `pageId` · `url` · `captureTimestamp` (unix ms).
- `viewport`: `width`, `height`, `devicePixelRatio`.
- `domSnapshot` (serialized DOM), `computedText`, `accessibilityTree` — each a record; full mode.

The `dom_snapshot` and `acc_tree` Zod schemas describe the payloads embedded here, not separate
top-level datasets.

---

## resources

Sub-resource network log. Schema: `resources.schema.ts`. Key: `resId` (UUID v4). Page link:
`ownerPageId`. **Full mode**, pruned if empty.

- `resId` · `ownerPageId` · `url` · `type` (`css\|js\|font\|image`).
- `status`, `contentType`, `hashBodySha256`, `bodyBlobRef`, `sizeBytes`, `critical`.

---

## sitemaps

Sitemap discovery. Schema: `cartographer-datasets.schema.ts:348-362`. Key: `sitemapId`. Carries
`crawlId`, not `pageId`. Written only when sitemaps were discovered.

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

Operational telemetry. Schema: `cartographer-datasets.schema.ts:289-309`. Key: `eventId`
(UUID v7). Optional `pageId`. Always present.

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

Hard failures and non-fatal alerts. Schema: `cartographer-datasets.schema.ts:275-287`
(`pipeline_alerts` is an alias of the same shape). No join key.

- `url` · `origin` · `hostname` · `occurredAt` · `phase` (`fetch\|render\|extract\|write`).
- `code`, `message`, `stack`, `details` (nullable record).

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

Discovery accounting. Schema: `cartographer-datasets.schema.ts:364-373`. Key: `url`. Written only
when a discovery tracker is wired.

- `url` · `normalizedUrl` · `status` (`discovered\|queued\|visited\|skipped`).
- `skipReason`, `depth`, `discoveredFrom`, `discoveredAt`, `hostGroup`.

---

_Last verified against codebase: 2026-07-06._
