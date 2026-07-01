# Root Metadata Files

Field reference for the seven files at the root of an `.atls` archive. For the physical layout see
[archive-structure.md](./archive-structure.md); for dataset records see [datasets.md](./datasets.md).

_Verified against `packages/atls-spec/src/schemas/*.schema.ts` and
`packages/cartographer/src/io/atlas/` on 2026-06-04; re-verified after the camelCase naming
parity sweep on 2026-06-30._

> **Casing is intentionally mixed and load-bearing.** `manifest.json` uses snake_case only for its
> free-form **identity, scope, and policy blocks** (`identity.primary_origin`, `scope.*`,
> `crawler_settings.*`, `url_normalization.*`, `coverage.*`, `discovery_summary.*`) but camelCase
> for all top-level, version, and integrity fields (`datasetId`, `crawlId`, `siteRoot`,
> `atlasVersion`, `createdAt`, `contentSha256`, `configIncluded`). `summary.json` is camelCase
> throughout. Match what's documented here exactly.

---

## `manifest.json`

The authoritative index. Schema: `manifest.schema.ts` (`AtlasManifestV1Schema`). Populated by
`manifest.ts:958-1145`. Many blocks are optional; only the most load-bearing are required.

### Identity & version

| Field | Casing | Type | Meaning |
|---|---|---|---|
| `datasetId` | camel | string (16 hex) | Archive identity (crawl id + origin hash). |
| `crawlId` | camel | string | Crawl run id. |
| `mode` | — | enum `raw\|import\|prerender\|full` | Render mode of the crawl. |
| `atlasVersion` | camel | string | Public Atlas line — `"1.1"` (RC2 camelCase cutover). **Required.** |
| `formatVersion` | camel | string | Container format — `"1.1.0"`. **Required.** |
| `specVersion` | camel | string | Spec contract — `"1.1.0"`. |
| `schemaVersion` | camel | string | Date-stamped schema tag — `"2026-07-01"`. |
| `incomplete` | camel | boolean | `true` at start, flipped to `false` at finalization. A `true` here means the crawl did not seal cleanly. |
| `createdAt` | camel | ISO 8601 | Manifest build time. **Required.** |
| `generator` | camel | string | `cartographer-engine/<version>`. **Required.** |
| `owner.name` | camel | string | `"Cai Frazier"`. |
| `consumers` | camel | string[] | Default `["atlas-sdk"]`. |

### Identity & scope blocks

| Field | Casing | Notes |
|---|---|---|
| `identity.primary_origin` | snake | Primary origin URL. |
| `identity.domain` / `identity.public_suffix` | snake | Registered domain / public suffix. |
| `identity.seed_urls` | snake | Seed URL list. |
| `siteRoot` | camel | Site root URL. |
| `scope.seeds` / `scope.allow` / `scope.deny` | snake | Discovery scope. |
| `scope.block_params` | snake | Stripped query params. |
| `scope.follow_external` | snake | Whether external links were followed. |
| `scope.max_pages` / `scope.max_depth` | snake | Crawl limits (0 / -1 meaning unlimited mirror the CLI). |

### Policy blocks

**Free-form `z.record` blocks — snake_case keys** (unchanged by the camelCase sweep):

- `crawler_settings.*` — `render_mode`, `robots_policy`, `robots_override`, `user_agent`,
  `concurrency`, `rps`, `replay_tier`, `cpu_slowdown_multiplier`, `network_conditions`.
- `url_normalization.*` — `lowercase_host`, `remove_default_port`, `strip_fragment`,
  `remove_trailing_slash`, `trailing_slash_policy`, `sort_query_params`, `querystring_policy`,
  `blocked_query_params`.

**Typed blocks — camelCase keys:**

- `privacyPolicy.*` — `stripCookies`, `stripAuthHeaders`, `redactInputs`, `redactForms`,
  `redactPii`.
- `robotsPolicy.*` — `respect`, `overridesUsed`, `overrideReason`.

### Crawl context & timing

| Field | Casing | Notes |
|---|---|---|
| `crawlContext` | camel | Full runtime context (mode, limits, normalization, completion inputs). |
| `crawlStartedAt` / `crawlCompletedAt` | camel | ISO 8601. |
| `crawlConfigHash` | camel | SHA-256 of the normalized config (compare/diff key). |
| `configSnapshot` | camel | Runtime config snapshot. |
| `configIncluded` / `redactionApplied` | camel | Booleans. **Required.** |

### Parts, schemas & datasets

| Field | Casing | Meaning |
|---|---|---|
| `parts` | snake keys | Map `<dataset> → ["<dataset>/part-001.jsonl.zst", …]`. **Required.** |
| `schemas` | snake keys | Map `<dataset> → "schemas/<name>.v1.schema.json#1"`. **Required.** |
| `datasets` | snake keys | Map `<dataset> → DatasetMetadata` (below). |
| `naming.currentPattern` / `naming.recommended` | camel | Part-naming hints. |

**`DatasetMetadata`** (per dataset, `manifest.schema.ts:11-29`):

| Field | Meaning |
|---|---|
| `name` | Canonical dataset name. |
| `present` | `true` if `recordCount > 0`. |
| `partCount` / `parts` | Number of part files. |
| `recordCount` | Total records across parts. |
| `bytes` | Total compressed bytes. |
| `schema` | Schema reference (`schemas/<name>.v1.schema.json#1`). |
| `schemaVersion` | Schema tag. |
| `schemaHash` | SHA-256 of the schema JSON. |
| `integrity.algorithm` | `"sha256"`. |
| `integrity.checksums` | Map `<part path> → SHA-256`. |
| `sidecarUri` / `sidecarSha256` | Optional external sidecar. |

### Capabilities, coverage, storage, integrity

- `capabilities.*` — `renderModes`, `modesUsed`, `specLevel` (1/2/3), `dataSets` (datasets with
  records), `robots.respectsRobotsTxt`, `robots.overrideUsed`.
- `coverage.*` — `matrix[]` (per-dataset `{part, expected, present, row_count, coverage_pct,
  reason_if_absent}`), plus `total_pages`, `successful_pages`, `failed_status_pages`,
  `pages_with_errors`, `incomplete`, `truncated_parts`.
- `storage.*` (camelCase) — `compression.{algorithm,level}`, `blobFormat`, `replayTier`,
  `contentAddressing`.
- `hashing` (camel) — `algorithm: "sha256"`, `urlKeyAlgo: "sha1"`, plus `rawHtmlHash`/`domHash`
  descriptions. **Required.**
- `integrity` (camel) — `contentSha256` (SHA-256 over sorted file hashes), `files` (map of every
  packaged path → SHA-256). **Required.**
- `discovery_summary` (snake, optional) — `total_discovered`, `visited`, `queued`, `pending`,
  `skipped`, `snapshot_at`, `skipped_by_reason`, `samples`.
- `compare` / `compareCompatibility` — diff/compare metadata (inner comparison keys are free-form snake).
- `notes` — free-form notes incl. resume/checkpoint/graceful-shutdown context. **Required.**

---

## `summary.json`

Aggregate stats. Schema: `summary.schema.ts` (`AtlasSummarySchema`). **camelCase throughout.**

### `identity` (camelCase)

`seedUrls`, `primaryOrigin`, `domain`, `publicSuffix`. (Contrast with manifest's snake_case
`identity.primary_origin`.)

### `crawlContext`

- `specLevel`, `completionReason` (enum `finished\|capped\|error_budget\|schema_budget_exhausted\|manual`),
  `frontierEmptyAtStop`, `stopConditionsTriggered`.
- `completionInputs.*` — `errorBudgetExceeded`, `budgetStopReason`, `gracefulShutdown`, `maxPages`,
  `pageCount`, `queueHasPending`, `enqueuedCount`, `visitedCount`.
- `config.*` — `maxPages`, `maxDepth`, `robotsRespect`, `followExternal`, `concurrency`, `rps`,
  `userAgent`, `paramPolicy`, `blockList`, `allowUrls`, `denyUrls`.
- `captureLimits.*` — `maxBytesPerPage`, `maxRequestsPerPage`, `maxAssetsPerPage`,
  `maxStructuredDataItems`, `renderTimeoutMs`, `networkIdleMs`.

### `stats`

Required totals: `totalPages`, `totalEdges`, `totalAssets`, `totalErrors`. Plus optional
per-dataset totals (`totalResponses`, `totalEvents`, `totalAccessibilityRecords`,
`totalNavigationRecords`, `totalSecurityRecords`, `totalResourceRecords`, `totalContentRecords`,
`totalStructuredDataRecords`, `totalTechnologyRecords`, `totalSitemapRecords`,
`totalQuarantineRecords`, `totalPerformanceDatasetRecords`, `totalDOMSnapshots`, and more).

Distribution maps:

- `statusCodes` — `{ "200": n, "301": n, "404": n, … }` (HTTP code → count). **Required.**
- `renderModes` — `{ raw\|import\|prerender\|full → count }`. **Required.**

### Other blocks

- `performance.avgRenderMs`, `performance.maxDepthReached`.
- `configSnapshot.requested` / `configSnapshot.effective`.
- `timestamps.crawlStartedAt`, `timestamps.crawlCompletedAt`, `timestamps.crawlDurationMs`.

---

## `summary.v2.json`

`summary.json` plus a top-level **`aggregates`** block (derived in `archiveCompiler.ts:158-190`):

| Field | Meaning |
|---|---|
| `aggregates.status.status2xx/3xx/4xx/5xx` | HTTP status-class counts. |
| `aggregates.render_modes` | Copy of `stats.renderModes` (snake_case key here). |
| `aggregates.totals.{pages,edges,assets,responses,errors}` | Convenience totals. |

Everything else is identical to `summary.json`.

---

## `capabilities.v1.json`

Declared vs. active capabilities and the finalization seal. Schema: `capabilities.schema.ts`.

| Field | Meaning |
|---|---|
| `version` | `"v1"`. |
| `capabilities` | Capability names present (e.g. `seo.core`, `a11y.core`, `render.dom`, `replay.html`). |
| `compatibility.minSdkVersion` | Minimum SDK version to read this archive. |
| `compatibility.breakingChanges` | Declared breaking changes. |
| `seal.extractors[]` | Each `{ id, capabilities[], datasets[] }` — what each extractor declared. |
| `seal.reconciliation.declaredCapabilities` | Union of declared capabilities. |
| `seal.reconciliation.activeCapabilities` | Capabilities that actually ran. |
| `seal.reconciliation.datasetsWithRecords` | Datasets that got ≥1 record. |
| `seal.reconciliation.orphanedCapabilities` | Active but produced no records. |
| `seal.reconciliation.undeclaredDatasets` | Had records but weren't declared. |
| `seal.sealedAt` | ISO 8601 finalization timestamp. |

`orphanedCapabilities` and `undeclaredDatasets` are the fields to check when auditing whether an
archive captured what it claimed to.

---

## `provenance.v1.jsonl.zst`

Zstandard-compressed JSON Lines — **one record per dataset**. Schema: `provenance.schema.ts`
(`ProvenanceRecordV1Schema`).

| Field | Casing | Meaning |
|---|---|---|
| `datasetName` | camel | Dataset produced (e.g. `"navigation.v1"`). |
| `producer.app` / `producer.version` / `producer.module` | camel | Producing component. |
| `createdAt` | camel | ISO 8601. |
| `inputs[]` | camel | `{ dataset, hashSha256 }` for each input dataset (empty for initial extraction). |
| `parameters` | camel field / free-form values | Key/value parameters (e.g. `{ "mode": "full" }`). |
| `output.recordCount` | camel | Records produced. |
| `output.hashSha256` | camel | SHA-256 of the produced dataset. |

This is the lineage record: it lets a consumer verify which producer/version generated each
dataset and from what inputs.

---

## `schema.json`

A computed **combined field dictionary** across every dataset schema (built in
`archiveCompiler.ts:192-236`). One entry per schema file:

```json
{
  "page_metadata.v1.schema.json": {
    "title": "…", "description": "…", "version": "…",
    "fields": [
      { "name": "core.title", "type": "string", "nullable": false,
        "required": false, "description": "…", "format": "…", "units": "…" }
    ]
  }
}
```

Use it as a single-file index of every field in the archive without unpacking the individual
`schemas/*.v1.schema.json` files. The per-dataset JSON Schemas in `schemas/` remain the
machine-validatable source.

---

_Last verified against codebase: 2026-06-30 (post camelCase naming parity sweep)._
