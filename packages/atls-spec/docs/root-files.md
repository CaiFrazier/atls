# Root Metadata Files

Field reference for the root metadata files of an `.atls` archive. Names and types in
`manifest.json` match `AtlasManifestV1Schema` in `manifest.schema.ts`. For the physical layout
see [archive-structure.md](./archive-structure.md); for dataset records see
[datasets.md](./datasets.md).

Current schema tag: `2026-09-04`.

Casing is mixed. Top-level manifest keys are camelCase. Some nested blocks keep snake_case inner
keys, and `identity` accepts both spellings of two fields. The lists below are the schema's names.
Why that mix should change is [OPEN_QUESTIONS.md](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md), not a license
to invent a third spelling.

`AtlasManifestV1Schema` is `.passthrough()` at the top, so a parse keeps unknown top-level keys.
Blocks that are not `.passthrough()` drop unknown inner keys. See
[versioning.md](./versioning.md).

---

## `manifest.json`

The archive index. Schema: `AtlasManifestV1Schema`.

### Required top-level fields

| Field | Type | Meaning |
|---|---|---|
| `atlasVersion` | string matching `^v?\d+(\.\d+)?$` | Public Atlas line. Current edition value: `"1.3"`. `"1.1"` and `"1.2"` remain valid. Stamp `"1.3"` only when the archive emits a spec 1.3 field. |
| `formatVersion` | string | Container version. Current edition value: `"1.3.0"`. Readers accept every major `1`. |
| `owner` | object | `name` (string). Any name. Required. |
| `consumers` | string[] | Consumer labels. No schema default. Required. |
| `hashing` | object | See below. Required. |
| `parts` | map of string → string[] | Dataset directory name → part paths. Required. |
| `schemas` | map of string → string | Dataset directory name → schema reference. Required. |
| `configIncluded` | boolean | Whether crawl config was packaged. Required. |
| `redactionApplied` | boolean | Whether redaction ran. Required. |
| `notes` | string[] | Free-form notes. Required. |
| `integrity` | object | See below. Required. |
| `createdAt` | string | Manifest build time. Required. |
| `generator` | string | Producer id. Any string. Required. |

### Optional top-level fields

| Field | Type | Meaning |
|---|---|---|
| `datasetId` | string | Archive identity. The schema does not require 16 hex characters. |
| `crawlId` | string | Crawl run id. The schema does not constrain the spelling. |
| `mode` | `raw` \| `import` \| `prerender` \| `full` | Render mode of the crawl. |
| `specVersion` | string | Spec contract. Current edition value: `"1.3.0"`. `"1.1.0"` and `"1.2.0"` remain valid. |
| `schemaVersion` | string | Date-stamped schema tag. Current edition value: `"2026-09-04"`. |
| `incomplete` | boolean | `true` means the crawl did not seal cleanly. |
| `source` | object | `sourceType`: `warc` \| `native`. Passthrough. |
| `packs` | array of objects | Free-form pack descriptors. |
| `identity` | object | See below. |
| `siteRoot` | string | Site root URL. |
| `scope` | object | See below. |
| `crawlerSettings` | object | See below. The block name is camelCase. |
| `urlNormalization` | object | See below. The block name is camelCase. |
| `crawlContext` | object | See below. |
| `crawlStartedAt` | string | ISO 8601. |
| `crawlCompletedAt` | string | ISO 8601. |
| `producer` | object | See below. |
| `environment` | object | See below. |
| `privacyPolicy` | object | See below. |
| `robotsPolicy` | object | See below. |
| `compareCompatibility` | map | Free-form compare metadata. |
| `crawlConfigHash` | string | SHA-256 of the fixed-key config object in [storage-and-encoding.md](./storage-and-encoding.md). Not part of `contentSha256`. |
| `datasets` | map of string → dataset metadata | See below. |
| `capabilities` | object | See below. |
| `coverage` | object | See below. Inner keys are camelCase. |
| `sitemapCoverage` | `absent` \| `failed` \| `partial` \| `complete` | Sitemap-discovery honesty. Missing means unknown, not `complete`. |
| `storage` | object | See below. |

`parts` and `schemas` are open records. Their keys are dataset directory names from
`ATLAS_DATASET_KEYS`, not a fixed subset.

### `identity`

Both spellings are in the schema for two fields. `publicSuffix` is camelCase only.

| Field | Type |
|---|---|
| `primary_origin` | string, optional |
| `primaryOrigin` | string, optional |
| `domain` | string, optional |
| `publicSuffix` | string, optional |
| `seed_urls` | string[], optional |
| `seedUrls` | string[], optional |

`summary.json` `identity` is camelCase only (`primaryOrigin`, `seedUrls`, `domain`, `publicSuffix`).

### `scope`

| Field | Type |
|---|---|
| `seeds` | string[], optional |
| `allow` | string[], optional |
| `deny` | string[], optional |
| `block_params` | string[], optional |
| `follow_external` | boolean, optional |
| `max_pages` | number, optional |
| `max_depth` | number, optional |

### `crawlerSettings`

| Field | Type |
|---|---|
| `render_mode` | string, optional |
| `robots_policy` | string, optional |
| `robots_override` | boolean, optional |
| `user_agent` | string, optional |
| `concurrency` | number, optional |
| `rps` | number, optional |
| `replay_tier` | string, optional |
| `cpu_slowdown_multiplier` | number, optional |
| `network_conditions` | `none` \| `mobile-4g` \| `mobile-3g` \| `mobile-2g` \| `slow-2g`, optional |

### `urlNormalization`

| Field | Type |
|---|---|
| `lowercase_host` | boolean, optional |
| `remove_default_port` | boolean, optional |
| `strip_fragment` | boolean, optional |
| `remove_trailing_slash` | boolean, optional. Informational. Readers do not use it for identity. |
| `trailing_slash` | string, optional. The one slash declaration. Spec 1.2 writers set `append-unless-file`. |
| `sort_query_params` | boolean, optional |
| `querystring_policy` | string, optional |
| `blocked_query_params` | string[], optional |

`trailing_slash` names the pathname rule. The normative algorithm is `normalizeUrl` in
[url-identity.md](./url-identity.md). It runs even when this field is absent. `remove_trailing_slash`,
a legacy `trailing_slash_policy` key, `crawlContext.urlNormalizationRules`, and compare-metadata
`removeTrailingSlash` flags are informational. Readers ignore them for identity.

The steps that produce a URL key are specified in [url-identity.md](./url-identity.md). Spec 1.2
sets `hashing.urlKeyAlgo` to `sha256`.

### `crawlContext`

| Field | Type |
|---|---|
| `mode` | `raw` \| `import` \| `prerender` \| `full`, optional |
| `robots` | boolean, optional |
| `maxPages` | number, optional |
| `maxDepth` | number, optional |
| `followExternal` | boolean, optional |
| `concurrency` | number, optional |
| `rps` | number, optional |
| `userAgent` | string, optional |
| `urlNormalization` | string, optional |
| `urlNormalizationRules` | string[], optional |
| `paramPolicy` | `keep` \| `sample` \| `strip`, optional |
| `parameterBlockList` | string[], optional |
| `allowUrls` | string[], optional |
| `denyUrls` | string[], optional |

### `producer`

| Field | Type |
|---|---|
| `name` | string, required |
| `version` | string, required |
| `build` | string, required |
| `git_hash` | string, optional |
| `command_line` | string, optional |

### `environment`

Required when the object is present: `device` (`desktop` | `mobile`), `viewport`, `user_agent`,
`locale`, `timezone`, `accept_language`, `browser`, `platform`.

| Field | Type |
|---|---|
| `viewport` | `width` (number), `height` (number) |
| `cpu_throttling` | number or null, optional |
| `network_conditions` | `none` \| `mobile-4g` \| `mobile-3g` \| `mobile-2g` \| `slow-2g`, optional |
| `network_profile` | `name` (string), `download_kbps` (number), `upload_kbps` (number), `latency_ms` (number) |
| `consent_state` | `cookies_enabled` (boolean), `do_not_track` (boolean), `gdpr_mode` (boolean, optional) |
| `browser` | `name` (string), `version` (string), `headless` (boolean) |
| `platform` | `os` (string), `arch` (string), `node_version` (string) |

### `privacyPolicy`

| Field | Type |
|---|---|
| `stripCookies` | boolean, required |
| `stripAuthHeaders` | boolean, required |
| `redactInputs` | boolean, required |
| `redactPii` | boolean, required |
| `redactForms` | boolean, optional |

### `robotsPolicy`

The object is optional. Two complete shapes are valid. A pre-1.3 object has `respect` and
`overridesUsed` and omits the spec 1.3 keys. A spec 1.3 object has `mode`, `modeSource`,
`failClosed`, `retryAttempts`, and `keepLastGood` together. It may also keep `respect` and
`overridesUsed`. A 1.2 reader strips unknown keys and still requires those two booleans, so a
writer that wants that reader to accept the object keeps them.

`mode` is `lenient` or `strict`. `modeSource` is `default`, `config`, or `flag`. Lenient mode
and `failClosed: false` are what a producer records when the operator did not choose otherwise.
The fields are recorded facts. The spec does not require a crawler to run in lenient mode, and
a missing object does not mean lenient. `capabilities.robots` (`respectsRobotsTxt`,
`overrideUsed`) is a separate object and stays unchanged.

The meanings of `mode`, `modeSource`, and `failClosed` stay stable across 1.3.x. A later 1.3
patch does not rename them, does not add a mode, and does not change when `failClosed` allows
`robots.blockedNoCopy`. The applied-body digest is defined with the `robots` dataset and is
stable across 1.3.x as well.

| Field | Type |
|---|---|
| `respect` | boolean. Required on a pre-1.3 object. Optional beside a complete spec 1.3 object. |
| `overridesUsed` | boolean. Same rule as `respect`. |
| `overrideReason` | string, optional |
| `mode` | `lenient` \| `strict`. Spec 1.3. Present together with the other 1.3 keys. |
| `modeSource` | `default` \| `config` \| `flag`. Spec 1.3. |
| `failClosed` | boolean. Spec 1.3. `robots.blockedNoCopy` can be true only when this is true. |
| `retryAttempts` | nonnegative integer. Spec 1.3. |
| `keepLastGood` | boolean. Spec 1.3. |

### `hashing`

| Field | Type |
|---|---|
| `algorithm` | string, required |
| `urlKeyAlgo` | string, required. `sha256` for spec 1.2. A 1.1 archive may say `sha1`. |
| `rawHtmlHash` | string, required |
| `domHash` | string, required |

These name algorithms. `urlKey` itself is not stored. `rawHtmlHash` is SHA-256 of the raw HTTP
body bytes. `domHash` is described in [storage-and-encoding.md](./storage-and-encoding.md).

### Dataset metadata (`datasets` values)

| Field | Type |
|---|---|
| `name` | string, optional |
| `partCount` | non-negative integer, optional |
| `recordCount` | non-negative integer, optional |
| `bytes` | non-negative integer, optional |
| `schema` | string, optional |
| `schemaVersion` | string, optional |
| `schemaHash` | string, optional. SHA-256 of the raw bytes of the schema file this dataset names. Not part of `contentSha256`. |
| `present` | boolean, optional |
| `parts` | non-negative integer, optional. This is a count, not the top-level `parts` map. |
| `sidecarUri` | string, optional |
| `sidecarSha256` | string or null, optional |
| `integrity` | object, optional |

Dataset `integrity`: `algorithm` (`sha256` when the object is present) and `checksums` (map of
part path to the SHA-256 of that part's stored ZIP payload). The same digest is in
`integrity.files`. See [storage-and-encoding.md](./storage-and-encoding.md).

### `capabilities`

Required when the object is present:

| Field | Type |
|---|---|
| `renderModes` | array of `raw` \| `import` \| `prerender` \| `full` |
| `modesUsed` | array of the same enum |
| `specLevel` | `1` \| `2` \| `3` |
| `dataSets` | string[] |
| `robots` | `respectsRobotsTxt` (boolean), `overrideUsed` (boolean) |

### `coverage`

Inner keys are camelCase. Required when the object is present, except the two marked optional.

| Field | Type |
|---|---|
| `matrix` | array of `{ part, expected, present, rowCount, coveragePct?, reasonIfAbsent? }` |
| `totalPages` | non-negative integer |
| `totalEdges` | non-negative integer |
| `totalAssets` | non-negative integer |
| `successfulPages` | non-negative integer |
| `failedStatusPages` | non-negative integer |
| `pagesWithErrors` | non-negative integer |
| `incomplete` | boolean |
| `truncatedParts` | string[], optional |

`matrix` entry fields: `part` (string), `expected` (boolean), `present` (boolean), `rowCount`
(non-negative integer), `coveragePct` (number, optional), `reasonIfAbsent` (string, optional).

The reference reader still reads a legacy `row_count` on a matrix entry when `rowCount` is
absent. That is reader tolerance, not a second current spelling. See
[OPEN_QUESTIONS.md](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md).

### `storage`

| Field | Type |
|---|---|
| `compression` | `algorithm` (string), `level` (integer, optional) |
| `blobFormat` | `zst` \| `tar.zst`, optional |
| `replayTier` | `html` \| `html+css` \| `full`, optional |
| `contentAddressing` | `on` \| `off`, optional |
| `imagePolicy` | `none` \| `dimensions` \| `full`, optional |
| `maxImageBytes` | non-negative integer, optional |
| `media` | `location` (string), `formats` (string[]). Passthrough. |
| `blobs` | `enabled` (boolean), `format` (string, optional) |

### `integrity`

| Field | Type |
|---|---|
| `algorithm` | string, optional. `sha256` when a spec 1.2 writer sets it. |
| `contentSha256` | string, optional in the schema. Required on a spec 1.2 archive. SHA-256 of the concatenated part checksums in UTF-8 path order. |
| `archiveSha256` | string, optional. Deprecated. Writers omit it. Readers ignore it. |
| `auditHash` | string, optional. Deprecated. Writers omit it. Readers ignore it. |
| `files` | map of packaged part path to the SHA-256 of that part's stored ZIP payload, required |

`contentSha256` does not cover blobs, schema files, the manifest, the summary, or provenance.
Blob integrity is per blob. The full procedure, including what a 1.1 reader accepts, is in
[storage-and-encoding.md](./storage-and-encoding.md).

---

## `summary.json`

Aggregate stats. Schema: `AtlasSummarySchema`. The schema is a plain object: unknown keys are
stripped on parse. **camelCase throughout.** `identity` does not accept the manifest's
snake_case aliases.

### `identity`

`seedUrls`, `primaryOrigin`, `domain`, `publicSuffix`. All required when `identity` is present,
and `identity` itself is required.

### `crawlContext`

Required: `specLevel`, `completionReason` (`finished` | `capped` | `error_budget` |
`schema_budget_exhausted` | `manual`), `config`. The `completionReason` enum does not grow
in spec 1.3.

- `endReason` (optional, spec 1.3): `complete` | `pageCap` | `timeBudget` | `circuitOpen` |
  `schemaBudget` | `manualStop` | `aborted`. When it is present, it maps onto
  `completionReason`: `complete` to `finished`, `pageCap` and `timeBudget` to `capped`,
  `circuitOpen` to `error_budget`, `schemaBudget` to `schema_budget_exhausted`, and
  `manualStop` and `aborted` to `manual`. `validate()` checks that map. A 1.2 summary omits
  `endReason` and is not checked.
- `skippedByReason` (optional, spec 1.3): a record of reason to nonnegative integer, or null
  when the tally was not measured. 0 is a measured zero. Omitting a key is not a zero. New
  1.3 counters use null for unmeasured and 0 for measured zero.
- `frontierEmptyAtStop`, `stopConditionsTriggered`: optional.
- `completionInputs` — optional object: `errorBudgetExceeded`, `budgetStopReason`,
  `gracefulShutdown`, `maxPages`, `pageCount`, `queueHasPending`, `enqueuedCount`,
  `visitedCount`.
- `config` — `robotsRespect`, `followExternal` required; `maxPages`, `maxDepth`, `concurrency`,
  `rps`, `userAgent`, `paramPolicy`, `blockList`, `allowUrls`, `denyUrls` as in the schema.
- `captureLimits` — optional: `maxBytesPerPage`, `maxRequestsPerPage`, `maxAssetsPerPage`,
  `maxStructuredDataItems`, `renderTimeoutMs`, `networkIdleMs`.

### `stats`

Required: `totalPages`, `totalEdges`, `totalAssets`, `totalErrors`, `statusCodes`, `renderModes`.
Further per-dataset totals are optional on the schema (`totalResponses`, `totalEvents`,
`totalAccessibilityRecords`, and the other `total*Records` counters).

### Other blocks

- `performance` is required. `avgRenderMs` is optional. `maxDepthReached` is required.
- `configSnapshot` is optional (`requested`, `effective`). This block is on `summary.json`, not on the manifest schema.
- `timestamps` is required: `crawlStartedAt`, `crawlCompletedAt`, `crawlDurationMs`.

---

## `summary.v2.json`

There is no Zod schema for this file. `openAtlas` does not read it. Producers may write
`summary.json` plus a top-level `aggregates` block. `AtlasSummarySchema` would strip `aggregates`
if that object were parsed as `summary.json`. Do not treat a missing `summary.v2.json` as an
invalid archive. The byte layout of `aggregates` is not part of this edition's schema; see
[OPEN_QUESTIONS.md](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md).

---

## `capabilities.v1.json`

Declared vs. active capabilities and the finalization seal. Schema: `capabilities.schema.ts`.
Optional for `openAtlas`. The reference reader uses `compatibility.minSdkVersion` only as a
warning unless the caller invokes `assertCompatible()`.

| Field | Meaning |
|---|---|
| `version` | `"v1"`. |
| `capabilities` | Capability names present (for example `seo.core`, `a11y.core`, `render.dom`, `replay.html`). |
| `compatibility.minSdkVersion` | Minimum SDK version the producer asks for. |
| `compatibility.breakingChanges` | Declared breaking changes. |
| `seal.extractors[]` | Each `{ id, capabilities[], datasets[] }`. |
| `seal.reconciliation.declaredCapabilities` | Union of declared capabilities. |
| `seal.reconciliation.activeCapabilities` | Capabilities that actually ran. |
| `seal.reconciliation.datasetsWithRecords` | Datasets that got at least one record. |
| `seal.reconciliation.orphanedCapabilities` | Active but produced no records. |
| `seal.reconciliation.undeclaredDatasets` | Had records but were not declared. |
| `seal.sealedAt` | ISO 8601 finalization timestamp. |

---

## `provenance.v1.jsonl.zst`

Zstandard-compressed JSON Lines — one record per dataset the producer chooses to describe.
Schema: `ProvenanceRecordV1Schema`. `openAtlas` does not read this file.

| Field | Meaning |
|---|---|
| `datasetName` | Dataset produced. |
| `producer.app` / `producer.version` / `producer.module` | Producing component. |
| `createdAt` | ISO 8601. |
| `inputs[]` | `{ dataset, hashSha256 }` for each input dataset. |
| `parameters` | Key/value parameters. |
| `output.recordCount` | Records produced. |
| `output.hashSha256` | SHA-256 of the uncompressed JSONL part checksums concatenated in part-index order. Not `contentSha256`. |

---

## `schema.json`

There is no Zod schema for this file in this package. Producers may write a combined field
dictionary here. The per-dataset JSON Schemas generated from the Zod `schemaMap` are the
machine-readable record definitions. A missing `schema.json` does not make an archive invalid
to the reference reader.

---

_Last verified against `AtlasManifestV1Schema`: 2026-11-10._
