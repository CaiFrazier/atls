# Atlas Dataset Reference

The complete, code-verified field reference for every dataset record in an `.atls` archive. This
is the normative reference; the per-dataset `schemas/*.v1.schema.json` files in each archive are
the machine-validatable form.

_Verified against `packages/atls-spec/src/schemas/cartographer-datasets.schema.ts`,
`responses.schema.ts`, `resources.schema.ts`, `reconstruction_index.schema.ts`, and
`packages/atls-spec/src/types.ts` on 2026-06-04._

---

## Conventions

- **Casing:** top-level dataset fields are snake_case **except** `page_metadata`, `navigation`,
  `content`, `structured_data`, `accessibility`, `performance`, `render_state`, `security`, and
  `technology`, which use camelCase nested objects (a historical split — match what's shown).
- **Join key:** every page-scoped record carries `page_id` (UUID v7). Exceptions are called out
  per dataset — see [identity-and-keys.md](./identity-and-keys.md).
- **Presence:** which datasets appear depends on render mode. The matrix below is authoritative.

## Presence by render mode

| Dataset | raw | prerender | full | Key | Schema |
|---|:--:|:--:|:--:|---|---|
| `page_metadata` | ✓ | ✓ | ✓ | `page_id` | Zod |
| `navigation` | ✓ | ✓ | ✓ | `page_id` | Zod |
| `content` | ✓ | ✓ | ✓ | `page_id` | Zod |
| `responses` | ✓ | ✓ | ✓ | `page_id` | Zod |
| `assets` | ✓ | ✓ | ✓ | `page_id`/`asset_id` | **none** |
| `technology` | ✓ | ✓ | ✓ | `page_id` | Zod |
| `events` | ✓ | ✓ | ✓ | `event_id` | Zod |
| `pipeline_failures` | ✓ | ✓ | ✓ | — | Zod |
| `pipeline_alerts` | ✓ | ✓ | ✓ | — | Zod |
| `quarantine` | ✓* | ✓* | ✓* | `quarantine_id` | **none** |
| `structured_data` | — | ✓ | ✓ | `page_id` | Zod |
| `security` | — | ✓ | ✓ | `page_id` | Zod |
| `accessibility` | ✓ (base) | ✓ (+forms/focus) | ✓ (+wcag/axe) | `page_id` | Zod |
| `performance` | — | ✓ | ✓ | `page_id` | Zod |
| `render_state` | — | — | ✓ | `page_id` | Zod |
| `resources` | — | — | ✓* | `res_id` | Zod |
| `sitemaps` | ✓* | ✓* | ✓* | `sitemap_id` | Zod |
| `reconstruction_index` | ✓† | ✓† | ✓† | `page_id` | Zod |
| `frontier_ledger` | opt | opt | opt | `url` | Zod |

`*` pruned/written only when records exist · `†` built at finalization under default replay tier ·
**none** = emitted by the writer but has no Zod schema in `@cf/atlas-spec` (see
[schema-system.md](./schema-system.md)).

---

## page_metadata

On-page SEO signals. Schema: `cartographer-datasets.schema.ts:31-71`. Key: `page_id`.

- `page_id` · `url` · `capturedAt` (ISO 8601) — root.
- `core` (object): `title`, `titleLength`, `metaDescription`, `descriptionLength`, `h1`,
  `canonicalTag`, `language`, `charset`, `favicon`, `viewport`, `themeColor`, `generator`.
  `core` is `passthrough` — extra keys may appear.
- `indexing` (object): `robotsMeta` (raw `<meta robots>`), `xRobotsTag` (raw header), and
  `robotsDirectives` — a **nested boolean object**: `noindex`, `nofollow`, `noarchive`,
  `nosnippet`, `noimageindex`, plus `unavailable_after` (string date).
- `social` (object): `openGraph` (string map), `twitterCard` (string map).
- `resourceHints` (object, optional): `preload`, `prefetch`, `preconnect`, `dnsPrefetch` — each an
  array of URL strings.

---

## navigation

Per-page link graph. Schema: `cartographer-datasets.schema.ts:92-114`. Key: `page_id`.

- `page_id` · `sourceUrl` · `capturedAt` — root.
- `edges[]` (array): one per outbound link —
  `sourceUrl`, `targetUrl` (**required**), `anchorText`, `anchorTextLength`, `rel`, `relTokens[]`,
  `nofollow`, `isExternal`, `location` (nav/header/footer/aside/main/other), `link_type`,
  `is_primary_nav`, `is_breadcrumb`, `is_skip_link`, `is_pagination`,
  `protocol_class` (`http\|https\|mailto\|tel\|javascript\|hash`), `emptyAnchorReason`.
- `redirectChain[]` (optional): `{ fromUrl, toUrl, statusCode, redirectType }` where
  `redirectType` ∈ `permanent\|temporary\|meta-refresh\|js-redirect`.
- `hreflang[]` (optional): `{ lang, url, rel }`.
- `pagination` (optional): `hasPrevNext`, `relPrev`, `relNext`, `detectedPageNumber`.

The link graph lives **here**, in `edges[]` — there is no separate `edges/` dataset.

---

## content

Extracted text and headings. Schema: `cartographer-datasets.schema.ts:116-140`. Key: `page_id`.

- `page_id` · `url` · `capturedAt` — root.
- `mainText` (**required**) — full normalized body text.
- `contentHash` (**required**) — SHA-256 of normalized text (change detection).
- `previewSample`, `sampleWordCount`, `wordCount`, `textContentLength`.
- `headings[]`: `{ level (1–6), text, position }`.
- `headingOutline`: `h1Count`…`h6Count`, `multipleH1` (boolean).

---

## responses

Network truth — one record per fetched page. Schema: `responses.schema.ts`. Key: `page_id`.

- `page_id` · `url` · `final_url` · `status_code` (**required**).
- `status_text`, `request_method`, `response_type`, `from_cache`.
- `redirect_chain[]`, `redirect_chain_length`.
- `content_type`, `content_length`, `headers` (normalized map).
- Timing: `fetch_started_at`, `fetch_completed_at`, `render_started_at`, `render_completed_at`,
  `fetch_ms`, `render_ms`, `render_mode`, `nav_end_reason`.
- `encoding` (**required**) — character encoding.
- `body_blob_ref` (**required**) — blob ref to the source HTML body.
- `rendered_body_blob_ref`, `rendered_dom_hash` — post-JS rendered HTML (full mode only).

Use `responses.status_code` as the transport truth — `page_metadata` has no status field.

---

## assets

Images, video, audio, documents. **No Zod schema** — shape defined in `types.ts:757-926`
(`AssetRecord`). Keys: `page_id` + `asset_id` (UUID v5, deterministic).

- Identity: `page_id`, `asset_id`, `pageUrl`, `assetUrl`, `type` (`image\|video\|audio\|document`).
- Image basics: `alt`, `hasAlt`, `naturalWidth/Height`, `displayWidth/Height`, `estimatedBytes`,
  `visible` (null in raw), `inViewport` (null in raw), `loading`, `wasLazyLoaded`.
- Responsive: `srcset`, `srcset_candidates[]` (`{url, descriptor, width, density}`), `sizes`,
  `picture_context` (`has_picture_parent`, `source_count`, `sources[] {srcset, media, type}`).
- Media (video/audio): `duration`, `mime_type`, `has_controls`, `autoplay`, `loop`, `muted`,
  `preload` (`none\|metadata\|auto`), `poster`, `tracks[]` (`{kind, src, srclang, label}`),
  `sources[]` (`{src, type}`).
- Lazy loading: `lazy_strategy` (`native\|intersection-observer\|data-src\|none`),
  `lazy_data_attrs` (`data_src`, `data_srcset`, `data_sizes`, `data_bg`), `lazy_classes[]`.
- Misc: `occurrence_count`, `resource_hint` (`{res_id, body_blob_ref, size_bytes}`),
  `tiles[]` (`{src, height, width, y, path}` — tiled screenshots).

---

## structured_data

Schema.org and social markup. Schema: `cartographer-datasets.schema.ts:149-183`. Key: `page_id`.
Present in prerender/full.

- `page_id` · `url` · `capturedAt`.
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

Detected stack. Schema: `cartographer-datasets.schema.ts:185-196`. Key: `page_id`.

- `page_id` · `url`.
- `detectedTechnologies[]` — Wappalyzer-style entries (name, version, categories…).
- `serverSignatures`: `server`, `xPoweredBy`, `generator`.
- `detectionTimestamp` (unix).
- `_meta.fieldOrigins` — field-level provenance tier map (when present).

---

## security

Transport and third-party posture. Schema: `cartographer-datasets.schema.ts:212-246`. Key:
`page_id`. Present in prerender/full.

- `page_id` · `url` · `capturedAt`.
- `mixedContent`: `hasIssues`, `resources[] {url, type, severity (active\|passive)}`.
- `subresourceIntegrity`: `checkedResources`, `integrityMissing[] {url, type}`, `integrityPresent`.
- `contentSecurityPolicy` (parsed CSP map), `cookies[]`, `storage`.
- `thirdPartyDomains[]`: `{ domain, resourceCount, resourceTypes[], category
  (analytics\|advertising\|cdn\|unknown), category_matcher }`.
- `transport.protocol` (`http\|https`), `securityHeaders` (header → value/null).

---

## accessibility

WCAG audit. Schema: `cartographer-datasets.schema.ts:311-346`. Key: `page_id`. Field depth grows
with render mode.

**Base (all modes):** `page_id`, `pageUrl`, `missingAltCount`, `headingOrder[]`,
`landmarks` (`header`, `nav`, `main`, `aside`, `footer` booleans), `roles` (ARIA role → count),
`missingAltSources[]`.

**Prerender additions:** `contrastViolations[]` (`{selector, fg, bg, ratio, level (AA\|AAA)}`),
`ariaIssues[]`, `lang`, `focusOrder[]` (`{selector, tabindex}`),
`formControls` (`totalInputs`, `missingLabel`, `inputsMissingLabel[]`, autocomplete/constraint
counts, `elements[] {selector, tag, type, required, hasLabel, autocomplete, hasConstraint}`).

**Full additions:** `wcagData` (full WCAG dict), `axe` (complete axe-core result:
violations/passes/incomplete/inapplicable), `audit_engine {name, version}`, `wcag_version`,
`audit_profile` (`basic\|essential\|full\|custom`), `audited_at`, `_meta`.

> Known issue: `contrastViolations` over-reports (~87% false positives) because the detector
> ignores transparent backgrounds and mis-pairs foreground color. Prefer `axe` contrast rules.
> Tracked as **BUG-0013**.

---

## performance

Resource timing and lab metrics. Schema: `cartographer-datasets.schema.ts:248-273`. Key:
`page_id`. Present in prerender/full.

- `page_id` · `url` · `capturedAt`.
- `labMetrics` (record), `renderHealth` (FCP/LCP/CLS/TTI etc).
- `resources[]`: `{ url, type, status, contentType, timing, size, cached }`.
- `summary`: `totalRequests`, `totalBytes`, `totalDuration`, `breakdown` (by type),
  `cachedRequests`, `uncachedRequests`, `failedRequests`.
- `_meta.fieldOrigins`.

---

## render_state

Post-render DOM capture. Schema: `cartographer-datasets.schema.ts:198-210`. Key: `page_id`. **Full
mode only.**

- `page_id` · `url` · `captureTimestamp` (unix ms).
- `viewport`: `width`, `height`, `devicePixelRatio`.
- `domSnapshot` (serialized DOM), `computedText`, `accessibilityTree` — each a record; full mode.

The `dom_snapshot` and `acc_tree` Zod schemas describe the payloads embedded here, not separate
top-level datasets.

---

## resources

Sub-resource network log. Schema: `resources.schema.ts`. Key: `res_id` (UUID v4). Page link:
`owner_page_id`. **Full mode**, pruned if empty.

- `res_id` · `owner_page_id` · `url` · `type` (`css\|js\|font\|image`).
- `status`, `content_type`, `hash_body_sha256`, `body_blob_ref`, `size_bytes`, `critical`.

---

## sitemaps

Sitemap discovery. Schema: `cartographer-datasets.schema.ts:348-362`. Key: `sitemap_id`. Carries
`crawl_id`, not `page_id`. Written only when sitemaps were discovered.

- `sitemap_id` · `crawl_id` · `url` · `fetched_at` · `http_status` · `content_type`.
- `is_index`, `entries_found`, `entries_enqueued`, `parse_warning`, `parse_error` (nullable),
  `depth`, `referenced_by` (nullable parent sitemap URL).

---

## events

Operational telemetry. Schema: `cartographer-datasets.schema.ts:289-309`. Key: `event_id`
(UUID v7). Optional `page_id`. Always present.

- `event_id` · `crawl_id` · `occurred_at` · `event_type` (enum) · `severity`
  (`info\|warn\|error\|critical`) · `message`.
- `url`, `hostname`, `page_id`, `details` (record).
- `metrics`: `duration_ms`, `memory_rss_mb`, `queue_depth`, `concurrent_requests`.
- `rate_limit`, `challenge`, `resource_usage` — free-form context maps on the relevant events.

`event_type` values include `crawl.*`, `page.*`, `render.*`, `rate_limit.*`, `backpressure.*`,
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

Records that failed schema validation, retained for forensics. **No Zod schema** — shape from the
cartographer `QuarantineRecord` interface. Keys: `quarantine_id` + `crawl_id`.

- `quarantine_id` · `crawl_id` · `page_id` (optional) · `url`.
- `dataset` — which dataset's record failed.
- `validation_error`, `quarantined_at`, `raw_record` (the original malformed record).

---

## reconstruction_index

Per-page replay index, built at finalization. Schema: `reconstruction_index.schema.ts`. Key:
`page_id`.

- `page_id` · `url` · `final_url` · `title`.
- Blob refs: `favicon_blob_ref`, `source_body_blob_ref`, `rendered_body_blob_ref` (full),
  `screenshot_desktop_blob_ref`, `screenshot_mobile_blob_ref`.
- `dom_snapshot_present` (boolean).
- `stylesheets[]` / `scripts[]` / `fonts[]` / `images[]` — each `{ url, blob_ref }`.
- `internal_links[]`: `{ url, anchor_text, target_page_id }`.

---

## frontier_ledger

Discovery accounting. Schema: `cartographer-datasets.schema.ts:364-373`. Key: `url`. Written only
when a discovery tracker is wired.

- `url` · `normalizedUrl` · `status` (`discovered\|queued\|visited\|skipped`).
- `skipReason`, `depth`, `discoveredFrom`, `discoveredAt`, `hostGroup`.

---

_Last verified against codebase: 2026-06-04._
