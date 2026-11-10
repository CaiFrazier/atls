# Atlas format map

Investigation of the Atlas (`.atls`) format as defined in this repository, written as a baseline for stewarding it as a public, portable standard. This is a reading of the tree at commit `77d1631` (2026-11-04), plus the npm registry state observed on 2026-11-10. No production code was changed.

**Where the definition actually lives.** Inside this repository the authoritative machine definition is the Zod schemas under `packages/atls-spec/src/schemas/`. The prose specification (`packages/atls-spec/SPECIFICATION.md` and `packages/atls-spec/docs/`) says so explicitly, and then disagrees with that code in several load-bearing places. The writer that several chapters treat as normative — `@cf/cartographer`, paths such as `packages/cartographer/src/io/atlas/` — is not in this repository. A second agent is mapping that monorepo. Anyone implementing Atlas from this repo alone is implementing the schemas and the reader, and inferring producer behavior from prose that cites code they cannot see.

**SDK, in one paragraph.** There is an SDK, and it lives here: `packages/atls-sdk`, published as `@caifrazier/atls-sdk`. It is a TypeScript, Node-only, read-side library. It does not write archives. npm has a single release, `1.0.0-rc.1`, published 2026-07-04. `package.json` on this tree still says `1.0.0-rc.1`, and the commits after that publish (describe API, redirect-evidence rows, Schema.org audit, shared dataset registry, and others) were never shipped as a new version. Details are in [The Atlas SDK](#2-the-atlas-sdk).

---

## 1. What Atlas is

An `.atls` file is a ZIP archive of one website crawl. Datasets are Zstandard-compressed JSON Lines. Large bodies live once, content-addressed, under `blobs/`. A page is not one row: it is many records joined by `pageId`. Root JSON files index and describe the archive.

That shape is stated in `README.md` (lines 1–5) and `packages/atls-spec/SPECIFICATION.md` (lines 12–20). The physical layout the prose describes is in `packages/atls-spec/docs/archive-structure.md`.

### 1.1 Container

| Piece | Prose | What this repo's code actually requires |
|---|---|---|
| Container | ZIP, `archiver` zlib level 0 (stored), because payloads are already zstd. `docs/archive-structure.md` lines 11–17; `docs/storage-and-encoding.md` lines 31–41. | The reader uses `yauzl` and accepts stored or deflated entries. Test fixtures are built with `archiver` zlib **level 9** (`packages/atls-sdk/test/helpers/fixtureArchive.ts` line 388). Level 0 is a writer convention documented against Cartographer, not a check the reader performs. |
| Dataset bytes | `<dataset>/part-NNN.jsonl.zst`, `NNN` from `001`. JSON Lines, UTF-8, then zstd. Writer prefers the `zstd` CLI at level 3, else `@mongodb-js/zstd`. `docs/storage-and-encoding.md` lines 10–29; `docs/archive-structure.md` lines 94–103. | The reader lists any `*.jsonl` or `*.jsonl.zst` under the dataset prefix, sorted by name (`reader.ts` `listPartFiles`, lines 510–521). Uncompressed `.jsonl` is accepted (`reader.ts` lines 643–648). Blank lines are skipped (`reader.ts` lines 343–346 and 363–366). Part index width, rotation size, and zstd level are not checked. |
| Compression library on read | Prose and `packages/atls-sdk/docs/API.md` line 234 name `@mongodb-js/zstd`. | `reader.ts` line 19 imports `Decompress` from `fzstd` `0.1.1`. `@mongodb-js/zstd` is a declared runtime dependency and is used by tests to *build* fixtures, not by the reader. |
| Blobs | `blobs/sha256/<aa>/<bb>/<64 hex>.zst`. Address is SHA-256 of the uncompressed bytes. Record field is the tail `sha256/<aa>/<bb>/<hash>`. `docs/storage-and-encoding.md` lines 58–87. | `normalizeBlobPath` (`reader.ts` lines 603–616) also accepts a `blobs/` prefix, a missing prefix, and an optional `.zst` suffix. `readBlob` decompresses and returns bytes. It does not recompute the SHA-256. Strict `validate()` checks the canonical regex only (`validate.ts` line 48). |
| Root files the prose calls always present | `manifest.json`, `summary.json`, `summary.v2.json`, `capabilities.v1.json`, `provenance.v1.jsonl.zst`, `schema.json`, `README.md`, plus `schemas/`, `blobs/`, `meta/`. `docs/archive-structure.md` lines 23–48 and 52–66. | `openAtlas` requires `manifest.json` and `summary.json` (`reader.ts` `readManifest` / `readSummary`, lines 727–751) and a `formatVersion` whose major is 1 (`formatVersion.ts` lines 17 and 72–96). `capabilities.v1.json` is optional. `summary.v2.json`, provenance, `schema.json`, the archive `README.md`, `schemas/`, and `meta/` are not opened by `openAtlas`. |
| Path | Extension is conventional. | `assertAtlasPath` rejects any path that does not end in `.atls` (`reader.ts` lines 167–173). |

Root metadata field lists are in `packages/atls-spec/docs/root-files.md`, with Zod in:

- `packages/atls-spec/src/schemas/manifest.schema.ts` (`AtlasManifestV1Schema`, from line 103)
- `packages/atls-spec/src/schemas/summary.schema.ts` (`AtlasSummarySchema`, line 28)
- `packages/atls-spec/src/schemas/capabilities.schema.ts` (`AtlasCapabilitiesV1Schema`, line 85)
- `packages/atls-spec/src/schemas/provenance.schema.ts` (`ProvenanceRecordV1Schema`, line 55)

There is no Zod schema for `summary.v2.json`, for the combined `schema.json` dictionary, for `meta/config.*.json`, or for the generated archive `README.md`. `AtlasSummarySchema` is a plain `z.object` (unknown keys are stripped on parse). The `aggregates` block documented for `summary.v2.json` (`docs/root-files.md` lines 166–176) would not survive that schema.

### 1.2 Datasets

`packages/atls-spec/src/datasetKeys.ts` lines 29–51 is the registry both the spec package and the SDK diff import. It lists **21** dataset directory names:

`navigation`, `page_metadata`, `content`, `assets`, `structured_data`, `technology`, `render_state`, `performance`, `accessibility`, `security`, `responses`, `resources`, `sitemaps`, `sitemap_urls`, `extraction`, `events`, `pipeline_failures`, `pipeline_alerts`, `quarantine`, `reconstruction_index`, `frontier_ledger`.

The presence-by-mode matrix in `docs/datasets.md` lines 24–46 lists the same 21. `SPECIFICATION.md` line 33 still says "all 19 datasets". That count matches the registry before `sitemap_urls` (documented as schema tag `2026-07-16`) and `extraction` (`2026-07-17`).

Per-dataset Zod, and whether it is a top-level directory:

| Schema module | Role |
|---|---|
| `src/schemas/cartographer-datasets.schema.ts` | On-disk records for page metadata, navigation, content, structured data, technology, render state, security, performance, pipeline failures/alerts, events, accessibility, sitemaps, sitemap URLs, extraction, frontier ledger, quarantine. |
| `src/schemas/responses.schema.ts` | `responses`. Re-exported as `ResponseRecordSchema` with `.passthrough()` from `runtime-core.schema.ts` line 229. |
| `src/schemas/resources.schema.ts` | `resources`. Page link is `ownerPageId`, not `pageId` (line 37). |
| `src/schemas/reconstruction_index.schema.ts` | `reconstruction_index`. |
| `src/schemas/runtime-core.schema.ts` `AssetRecordSchema` (line 167) | On-disk `assets`. The generator publishes this, not a schema from `cartographer-datasets.schema.ts`. |
| `src/schemas/dom_snapshot.schema.ts`, `acc_tree.schema.ts` | Standalone schemas. `render_state` does **not** use them. `RenderStateDatasetRecordV1Schema` types `domSnapshot`, `computedText`, and `accessibilityTree` as free `z.record` JSON (`cartographer-datasets.schema.ts` lines 418–429). `DOMSnapshotRecordV1Schema` is a different shape (`domJsonZstd` base64, `dom_snapshot.schema.ts` lines 29–37). |
| `src/schemas/render.schema.ts` | Legacy renderer-capture schema. In `schemaMap`. Not a dataset directory. |
| `src/schemas/audit_results.schema.ts` | Horizon placeholder. Exported from the package. Deliberately absent from `schemaMap` (`generator.ts` lines 71–73). |

`src/schemas/generator.ts` `schemaMap` (lines 37–74) is the list turned into `dist/schemas/<name>.schema.json` at build time via `zod-to-json-schema`. Those JSON files are not committed (`.gitignore` ignores `dist/`). Zod is the source; the JSON Schema is a build artifact (`packages/atls-spec/README.md` lines 23–25).

Join rules that are real in both prose and schemas:

- Page-scoped datasets carry `pageId`. `docs/identity-and-keys.md` lines 9–22. `responses.url` is the request URL; `page_metadata.url` is the final URL (same file, lines 18–22).
- `resources` joins on `ownerPageId`.
- `events.pageId` is optional. `pipeline_failures.pageId` is optional (`cartographer-datasets.schema.ts` lines 531–534): the prose table that says pipeline datasets have no page link (`docs/identity-and-keys.md` lines 80) is behind the schema.
- `frontier_ledger` is URL-keyed and may also carry `pageId` (`cartographer-datasets.schema.ts` lines 822–825). The prose says it has no page link.

Field-by-field prose is `docs/datasets.md`. Several fields exist on the Zod object and are absent from that prose, including on `page_metadata`: `core.canonicalResolved`, `media` (screenshot and favicon refs), `capture_degraded`, `degraded_reason`, and `limits` (`cartographer-datasets.schema.ts` lines 70–132). `capture_degraded` and `degraded_reason` are snake_case on a record the prose says is camelCase since schema tag `2026-07-01` (`docs/datasets.md` lines 15–16).

`PageRecord` / `PageRecordSchema` and `EdgeRecord` / `EdgeRecordSchema` are a second model. `page_metadata.schema.ts` lines 30–31 and `runtime-core.schema.ts` lines 93–105 say `PageRecordSchema` is the in-memory crawl composite (~20 required fields, `.passthrough()` for the rest) and is not the on-disk dataset. It still requires snake_case `page_id` (`runtime-core.schema.ts` line 109). `EdgeRecordSchema` (lines 134–165) is a flat edge with snake_case fields (`source_page_id`, `link_type`, `is_primary_nav`). The on-disk navigation record is an envelope of camelCase edges (`NavigationDatasetRecordV1Schema`, lines 136–180). `flattenPageMetadataRecord` (`src/pageMetadataMapping.ts`) is a third shape: the flat object `readers.pageMetadata()` yields. All three are exported from `@caifrazier/atls-spec`.

`types.ts` also exports engine types that are not archive datasets: `CrawlEvent`, `CrawlState`, `ConsoleRecord`, `ComputedTextNodeRecord`, `RobotsCacheEntry`, and the crawl progress structs (from roughly line 1096 through the manifest). A comment at lines 1148–1153 records that `EngineConfig` was removed because it is not part of the format. The other engine types remain in the public spec package.

### 1.3 Versioning

Five identifiers are easy to conflate. Nothing in this repo assigns the current values; the prose does, and the prose does not agree with itself. Schemas accept free strings (with one regex on `atlasVersion`).

| Field | `docs/versioning.md` lines 15–19 (verified date in that file: 2026-09-04) | Other prose | Code |
|---|---|---|---|
| `atlasVersion` | `"1.1"` | `docs/root-files.md` line 31: `"1.1"`, required. | `manifest.schema.ts` lines 108–110: regex `^v?\d+(\.\d+)?$`. `types.ts` line 1465 comment still says `"1.0"`. Fixtures write `"1.0"` (`fixtureArchive.ts` line 307). |
| `formatVersion` | `"1.1.0"` | `docs/root-files.md` line 32: `"1.1.0"`, required. | Required string. SDK accepts any major `1` (`formatVersion.ts` line 17) and warns on a prerelease suffix (lines 94–96). Fixtures and reader tests use `"1.0.0"`. |
| `specVersion` | `"1.1.0"` | `docs/root-files.md` line 33. | Optional string. `validate()` requires it only in strict mode. |
| `schemaVersion` | `"2026-09-04"` | `SPECIFICATION.md` lines 8 and 63, `docs/root-files.md` line 34, and the sample in `docs/reading-archives.md` line 21 all say `"2026-07-01"`. | Optional string. No enum, no constant, no branch in the reader. |
| npm package version | `1.0.0-rc.1`, not written into archives. | Same in `packages/atls-spec/package.json` and `packages/atls-sdk/package.json`. | `SDK_VERSION` reads the SDK `package.json` at load (`compatibility.ts` lines 34–35). |

`docs/versioning.md` lines 45–63 is the only changelog of schema tags: `2026-07-01` (camelCase cutover), `2026-07-16` (sitemap coverage and security forms), `2026-07-17` (extraction), `2026-07-23` (bodiless redirect rows), `2026-09-04` (Schema.org audit). Those features exist in the Zod files. The index page was not moved forward with them.

`specLevel` 1/2/3 is documented as a function of render mode (`docs/versioning.md` lines 67–79) and is a closed union on the manifest (`manifest.schema.ts` line 246). The presence matrix is producer policy. A record that violates the matrix still schema-validates.

Forward-compat text (`docs/versioning.md` lines 83–91) says unknown fields must be tolerated because nested objects use Zod `.passthrough()`. That is true of some nested objects (`core`, `indexing`, technology entries, manifest blocks) and of `TechnologyDatasetRecordV1Schema` itself (line 416). It is false of most outer dataset objects, including `page_metadata`, `navigation`, `content`, `responses`, `security`, and `accessibility`: Zod's default strips unknown keys on success and does not reject them. `RecordMetaSchema` and accessibility `landmarks` are `.strict()` (`cartographer-datasets.schema.ts` lines 56–58 and 695–701). A producer that adds a top-level field will see validators drop it.

### 1.4 Folder names

This is the sharpest layout contradiction in the repo.

`SPECIFICATION.md` lines 55–60: long names (`page_metadata/`, `navigation/`, `pipeline_failures/`) are current. Short names (`pages/`, `edges/`, `failed_pages/`) are "removed legacy". The SDK "resolves both".

`packages/atls-sdk/src/index.ts` lines 52–65 and 307–313, and `describe.ts` lines 37–42: the same short names are `NEWER_FORMAT_FOLDER_MAP`, commented as the layout of archives with `schemaVersion >= 2025-10-22`. That date appears nowhere in `docs/versioning.md`. The reader tries the long folder first, then the short alias (`index.ts` `resolveFolder`, lines 347–353). Tests that force the short layout are named "newer-format archives" (`test/reader.newerFormat.test.ts`).

`packages/atls-sdk/docs/API.md` lines 215–223 still tells callers that low-level `iterateParts` "sidesteps the broken folder resolution" and that long names are what work on "current 2026-07-01 archives".

What an implementer can rely on: this reader accepts both layouts and prefers the long name when both exist. What a producer must write is not settled by a single sentence in this repo. The dataset registry and the manifest keys use the long names.

### 1.5 Integrity, hashing, and other behavior the prose states and the code does not close

Documented in `docs/storage-and-encoding.md` lines 102–112 and `docs/root-files.md` lines 114–117:

- Blob address: SHA-256 of uncompressed bytes.
- Part checksum: SHA-256 of the compressed part, stored at `manifest.datasets.<name>.integrity.checksums`.
- Archive content hash: "SHA-256 over sorted file hashes" at `manifest.integrity.contentSha256`.
- URL key: SHA-1, `manifest.hashing.urlKeyAlgo`, after normalization recorded on the manifest.
- Schema hash: SHA-256 of schema JSON.

The combination order for the archive content hash, the JSON canonicalization for `schemaHash`, and the URL-normalization function that feeds SHA-1 are not specified as algorithms in this repo. The prose points at `manifest.ts` in Cartographer.

Field name for the archive hash itself disagrees:

- Zod and `docs/root-files.md` line 116: `integrity.contentSha256`, `integrity.auditHash` (`manifest.schema.ts` lines 285–293).
- `AtlasManifest` in `types.ts` lines 1775–1781: `content_sha256`, `archiveSha256`, `audit_hash`.

`validate()`'s `checkIntegrity` option is referential (edge source URL exists on a page, asset `pageUrl` exists). It does not hash parts, files, or blobs (`validate.ts` lines 112–128 and 312–370). `openAtlas` does not hash them either.

Other producer rules written as if they were format rules, with the algorithm left in Cartographer:

- Screenshot transcode (default WebP quality 80, tiling) and favicon transcode (`docs/storage-and-encoding.md` lines 93–98). Schemas store refs and dimensions, not a required media type.
- `pageId` is "UUID v7", `assetId` "UUID v5", `resId` "UUID v4", `eventId` and `sitemapId` "UUID v7" (`docs/identity-and-keys.md` lines 36–93). Schemas: `pageId` and `resId` are `z.string().uuid()` (any version); `assetId` is `z.string().min(1)` (`runtime-core.schema.ts` line 170); `eventId` and `sitemapId` are `z.string()` (`cartographer-datasets.schema.ts` lines 549 and 730). Fixtures use `randomUUID()` (v4) and `assetId: "asset-1"`.
- `crawlId` is "hex or `crawl_<timestamp>_<random>`" (`docs/identity-and-keys.md` lines 50–55). Schema: optional string.
- `datasetId` is "16 hex" in the prose. Schema: optional string.
- `owner.name` is documented as the literal `"Cai Frazier"` (`docs/root-files.md` line 38). Schema: required string, any value (`manifest.schema.ts` lines 116–118).
- `generator` is documented as `cartographer-engine/<version>`. Schema: required string.
- `consumers` default is `["atlas-sdk"]` in `docs/root-files.md` line 39 and `["Continuum SEO", "Horizon Accessibility"]` in the `types.ts` comment at line 1479. Schema: `string[]`.

Manifest block names drifted the same way. `docs/root-files.md` lines 54–62 still describes free-form snake_case blocks `crawler_settings` and `url_normalization`, and a snake_case `coverage` (`row_count`, `total_pages`, …). The Zod and the `AtlasManifest` interface use `crawlerSettings` and `urlNormalization` with snake_case *inner* keys (`manifest.schema.ts` lines 150–169; `types.ts` lines 1516–1536), and camelCase coverage since the 2026-07-04 recase (`manifest.schema.ts` lines 253–273; `types.ts` lines 1711–1734). `datasetPresence.ts` lines 104–108 still reads a legacy `row_count`. `identity` accepts both `primary_origin` and `primaryOrigin` (`manifest.schema.ts` lines 132–138). The root-files chapter's "casing is load-bearing, match it exactly" note (lines 10–15) describes a layout the schema no longer requires as the only legal one.

`responses` redirect rows (`isRedirect`, `location`, `redirectType`, body fields optional) are in `responses.schema.ts` lines 29–92. `docs/datasets.md` lines 103–117 still describes `encoding` and `bodyBlobRef` as required and does not mention redirect rows. `docs/versioning.md` lines 51–52 does.

### 1.6 How to treat the documents

| Document | Status |
|---|---|
| `packages/atls-spec/src/schemas/*.ts` | Normative for record and metadata shape, as far as this repo goes. |
| `packages/atls-spec/src/datasetKeys.ts` | Normative dataset-name registry (21 names). |
| `packages/atls-spec/SPECIFICATION.md` plus `docs/*.md` | The intended public spec. Self-described as "when this spec and the code differ, the code is authoritative" (`SPECIFICATION.md` lines 5–6). Verification footers cite `packages/cartographer/src/io/atlas/`, which is not in this tree, and dates from 2026-06-04 through 2026-09-04. Line numbers cited inside `docs/datasets.md` (for example "schema starts at line 31") do not match the current file. |
| `packages/atls-spec/src/types.ts` | Mixed. Some aliases track Zod (`EventRecord`, `AccessibilityRecord`). `AtlasManifest` and `PageRecord` disagree with the schemas as noted above. |
| `packages/atls-sdk/src/` | Normative for what the reference reader accepts, which is wider than the prose (deflated ZIPs, uncompressed parts, alias folders, permissive blob paths). |
| `legacy/v1/` | Cited from `packages/atls-spec/README.md` line 58 and `packages/atls-sdk/README.md` line 218. The directory does not exist. |
| `../cartographer/docs/current/` | Cited from `SPECIFICATION.md` line 70. Not in this repo. |

---

## 2. The Atlas SDK

The SDK is part of Atlas stewardship, and it is in this repository. There is no second SDK elsewhere in the tree, and the unscoped names `@atls/sdk` and `@atls/spec` are not packages here and are not on npm (registry lookup on 2026-11-10 returned 404). Those names survive in `NOTICE` lines 10–12 and in `SdkCompatibilityError`, which tells the caller to upgrade `@atls/sdk` (`packages/atls-sdk/src/compatibility.ts` lines 42–44).

### 2.1 Where it lives, language, packaging

| | |
|---|---|
| Path | `packages/atls-sdk` |
| npm name | `@caifrazier/atls-sdk` |
| Language | TypeScript, ESM only (`"type": "module"`). Types emitted next to `dist/index.js`. |
| Runtime | Node `>=20` (root `package.json` `engines`). No browser build, no WASM build, no Python/Rust/Go binding. |
| Public entry | `"."` → `dist/index.js` / `dist/index.d.ts`. No subpath exports. |
| Dependency on the format | `"@caifrazier/atls-spec": "workspace:*"` (`packages/atls-sdk/package.json` lines 51–52). |
| Libraries the reader actually imports | `yauzl` (ZIP), `fzstd@0.1.1` (zstd). Node `stream`. |
| Declared dependencies the SDK source does not import | `@mongodb-js/zstd` (native addon; used by tests to compress fixtures), `ajv`, `ajv-formats`. All three are under `dependencies`, so an install pulls them in. `ajv` is not referenced anywhere under `packages/atls-sdk`. |
| CLI | No `bin`. The `examples/` scripts are sample programs (`npx tsx examples/read-pages.ts`, or `node examples/*.mjs` against `dist/`). `examples/test.mjs` line 10 defaults to `../../tmp/accessibility-test.atls`, a path this repo does not contain. |
| License | Apache-2.0 only (`package.json` `license`, file `packages/atls-sdk/LICENSE`). The CC BY 4.0 grant covers the spec and JSON Schemas, not the SDK. |
| Publish intent | `publishConfig.access: "public"`, `prepublishOnly`: build then test. `files` ships `dist`, `README.md`, `QUICK_REFERENCE.md`, `examples`. |
| CI | `.github/workflows/ci.yml`: on push and PR to `main`, Node 20 and 22, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`, `pnpm typecheck`. No publish job. |

The spec package it sits on, `@caifrazier/atls-spec`, is the same repository (`packages/atls-spec`). Its runtime dependencies are `zod` and `zod-to-json-schema`. It performs no I/O (`SECURITY.md` lines 24–25).

### 2.2 Public API surface

Everything public is re-exported from `packages/atls-sdk/src/index.ts`. Grouped by job:

**Open and stream**

- `openAtlas(path, { strict?, limits? })` → `AtlasReader` (lines 269–480). Requires the `.atls` suffix, `manifest.json`, `summary.json`, and `formatVersion` major 1.
- `AtlasReader` members: `manifest`, `summary`, `datasets`, `packs`, `stats`, `hasDataset`, `getBlob`, `close`, `readers`, plus `Symbol.dispose` / `Symbol.asyncDispose` when the runtime has them (lines 462–473).
- Typed readers (lines 434–456): `navigation`, `pageMetadata`, `content`, `structuredData`, `technology`, `renderState`, `security`, `performance`, `pipelineFailures`, `pipelineAlerts`, `assets`, `events`, `accessibility`, `responses`, `resources`, `sitemapUrls`, `extraction`, and generic `dataset(name)`.
- Deprecated aliases, still wired: `pages`, `edges`, `errors`, `failedPages` (lines 222–237 and 437–448).
- `select(path, { dataset, where?, fields?, limit?, limits? })` (lines 521–605). Filter and dot-path projection. Throws `AtlasUnknownDatasetError` when the name is neither a canonical dataset nor mentioned by the manifest (`datasetPresence.ts` lines 50–64).
- Low-level: `openZipHandle`, `ZipHandle`, `readManifest`, `readSummary`, `iterateParts`, `iterateDataset`, `iteratePartLines`, `readBlob`, `decompressZstdBuffer`, `normalizeBlobPath` is used internally and not re-exported (it is exported from `reader.ts` but `index.ts` does not re-export it). Callers of the package entry do not get `normalizeBlobPath`.

**Describe (manifest plus ZIP central directory, no full scan)**

`describe.ts`, re-exported at `index.ts` lines 120–140. The file header (lines 17–24) says the API returns plain JSON so it can cross an IPC boundary from a Continuum daemon to a renderer.

- `describeArchive`, `describeDataset`
- `readDatasetSlice` (cursor over raw JSON lines), `readRecord` (by ordinal)
- `readSchema` (embedded `schemas/` entry), `statBlob` (sizes, no inflate)
- `AtlasRecordNotFoundError`

`describeArchive` tolerates a missing `summary.json` (lines 298–303). `openAtlas` does not.

**Validate**

`validate(path, options)` in `validate.ts` lines 182–510. Options: `checkIntegrity` (default true), `checkBrokenLinks` (default true), `checkManifest` (default true), `maxIssues` (default 1000), `errorsOnly`, `strict` (default **false**), `limits`. Result: `valid`, `indeterminate`, `issues`, `stats`, `truncated`. A run that stops at `maxIssues` with zero errors is `indeterminate` and not `valid` (lines 499–508).

`openAtlas({ strict })` and `validate({ strict })` use the same word for different checks. On the reader, `strict: true` (the default) throws `MalformedRecordError` on bad JSON or on the three datasets that have an on-read schema. On `validate`, `strict: false` is the default and means "do not require the full manifest field set, canonical blob-ref shape, or the null-vs-omit rule".

**Diff and cross-mode**

- `diffManifests` / `formatManifestDiff` (`diff.ts`). Default dataset list is `ATLAS_DATASET_KEYS` from the spec package (lines 17–33), so all 21 registry names are compared. Pure data, no I/O.
- `buildCrossModeIndex` (`crossMode.ts`). Joins two or more already-open readers on `page_metadata.url`, because `pageId` is not stable across crawls.

**Compatibility**

- `SDK_VERSION`, `checkCompatible`, `assertCompatible`, `SdkCompatibilityError` (`compatibility.ts`).
- `openAtlas` reads `capabilities.v1.json` and `console.warn`s when `compatibility.minSdkVersion` is newer than this SDK. It does not throw. Callers who want a throw call `assertCompatible` (`index.ts` lines 276–288).
- Comparison ignores prerelease tags, on purpose: the shipping SDK is `1.0.0-rc.1` and archives may say `minSdkVersion: "1.0.0"` (`compatibility.ts` lines 56–60).

**Versions and errors**

- `SUPPORTED_FORMAT_MAJOR` (value `1`), `parseFormatVersion`, `AtlasMissingFormatVersionError`, `AtlasUnsupportedFormatVersionError`.
- Read-path errors, each with a `code`: `AtlasResourceLimitError`, `AtlasDuplicateEntryError`, `AtlasInvalidEntryNameError`, `AtlasPathError`, `AtlasAbortError`, `AtlasDecompressionError`, `AtlasEntryNotFoundError`, `MalformedRecordError`, `AtlasUnknownDatasetError`.
- Default read limits are `DEFAULT_ATLAS_READ_LIMITS` (`reader.ts` lines 35–47): 250,000 ZIP entries, 256 MiB compressed entry, 512 MiB decompressed part, 64 MiB JSONL line, and similar caps. `SECURITY.md` lines 10–22 describes this as the threat model for untrusted archives.

**Types re-exported from the SDK** (`src/types.ts`): `AtlasManifest`, `AtlasSummary`, `AtlasPack` and pack name/state unions, `ResponseRecordV1`, `AssetRecord`, `EventRecord`, `AccessibilityRecord`, `ResourceRecordV1`, `SitemapUrlRecord`, `ExtractionRecord`, `DatasetName`, `AnyRecord`. `DatasetName` includes the 15 `CanonicalDatasetName`s, four legacy aliases, and `string & {}` so arbitrary names type-check (lines 62–98). The six registry datasets outside that union (`sitemaps`, `sitemap_urls`, `extraction`, `quarantine`, `reconstruction_index`, `frontier_ledger`) are still readable: `sitemapUrls()` and `extraction()` are dedicated readers; the other four go through `readers.dataset(name)`.

### 2.3 What the docs claim the API is

Three documents lag the exports.

| Document | Gap |
|---|---|
| `packages/atls-sdk/README.md` reader table, lines 70–89 | Omits `sitemapUrls()` and `extraction()`. Omits the describe module, compatibility helpers, and most typed errors. "Last verified" footer says 2026-06-04. |
| `packages/atls-sdk/QUICK_REFERENCE.md` | Same smaller surface. Footer says 2026-07-06. |
| `packages/atls-sdk/docs/API.md` | Export list (lines 11–20) omits describe, compatibility, `sitemapUrls`, `extraction`. `ValidationResult.stats` in the doc (lines 164–172) omits `sitemapUrlsChecked` and `extractionChecked`, which `validate.ts` lines 210–211 increment. Lines 199–201 say diff "may not reflect newer datasets"; `diff.ts` lines 21–33 now walks the full registry. Lines 215–234 say folder resolution is broken and that decompression uses `@mongodb-js/zstd`. The code has alias fallback and uses `fzstd`. `indeterminate` is absent from the documented result type. |

`packages/atls-spec/docs/schema-system.md` lines 69–74 says `validate()` counts `quarantine` and skips re-validating it. `validate.ts` has no quarantine counter and never opens `quarantine`, `reconstruction_index`, or `frontier_ledger`. `API.md` lines 182–184 repeats the "not re-validated" half.

### 2.4 How the SDK maps onto the format

| Format rule | SDK behavior |
|---|---|
| ZIP of zstd JSONL | Reads ZIP with `yauzl`. Inflates deflate if present. Decodes zstd frames with `fzstd`. |
| Long dataset directory names | Preferred. Short aliases `pages`, `edges`, `failed_pages` are a fallback. Manifest keys stay long; `datasets` on the reader advertises the long name when only the alias folder exists (`index.ts` lines 307–313). |
| `manifest.json` is the index | `datasetPresent` (`datasetPresence.ts` lines 72–114) trusts `datasets.*.recordCount` / `present` / `partCount`, then `parts`, then `coverage.matrix`. An empty part file with `recordCount: 0` is absent. A directory the manifest does not mention is invisible to `openAtlas` and shows up as `unexpected` only in `describeArchive`. |
| `page_metadata` on disk is nested | `readers.pageMetadata()` runs `flattenPageMetadataRecord` (`index.ts` lines 422–436). `readers.dataset("page_metadata")` and `select` return the nested record. `validate()` uses the nested reader on purpose (lines 255–257). |
| Schemas | On read, only `assets`, `responses`, and `resources` are `safeParse`d (`index.ts` lines 334–338). `validate()` then parses navigation, those three, and the `zodDatasets` list (lines 384–405): content, structured data, technology, render state, performance, security, responses, resources, sitemaps, sitemap URLs, extraction, events, accessibility, pipeline failures, pipeline alerts. Quarantine, reconstruction index, and frontier ledger are unchecked. Embedded `schemas/*.json` are not consulted; validation uses the Zod bundled in the installed spec package. `readSchema` can return the archived JSON Schema to a caller who asks. |
| `pageId` join | Not done by the reader. Callers join. `validate()`'s referential checks join on URL (`pageUrls` set from `page_metadata.url`; broken links look up `responses.url`), which is the join `docs/identity-and-keys.md` tells readers to avoid for redirects. |
| Blob bytes | `getBlob` / `readBlob` decompress. Strict `validate()` checks `bodyBlobRef` shape and the asset `resourceHint.bodyBlobRef` shape. Neither confirms the bytes hash to the address, nor that the entry exists, except by throwing if you later read a missing path. |
| Checksums and `contentSha256` | Stored if the producer wrote them. Unread by the SDK. |
| `summary.v2.json`, provenance, `schema.json`, `meta/`, archive `README.md` | Not part of `openAtlas`. Available only as raw ZIP entries through `ZipHandle`. |
| `capabilities.v1.json` | Optional compatibility warning, not a capability gate. The SDK does not refuse to iterate a dataset the seal omitted. |
| `schemaVersion` | Copied onto `describeArchive().schemaVersion`. No behavior switches on it. |
| `formatVersion` | Major must be 1, or open and validate fail. Minor and patch are ignored. `"1.0.0"` and `"1.1.0"` are the same to this SDK. |
| Unknown datasets | `select` throws if the name is unknown to both the 15-name list and the manifest. `readers.dataset` yields nothing when presence is false. |
| Packs (`Core`, `A11y-Light`, `A11y-Full`, `Perf`, `Visual`) | `buildPackView` (`index.ts` lines 150–185) exposes manifest `packs` as a typed view. The manifest Zod types `packs` as `z.array(z.record(z.unknown()))` (`manifest.schema.ts` line 128). Pack semantics are not specified beyond the TypeScript interface (`types.ts` lines 1447–1457). |

`pageMetadataMapping.ts` lines 34–38 names the flat shape's consumers as "app-foundation, Horizon, any SDK user". The adapter is part of the spec package, and the SDK is the only in-repo caller.

### 2.5 Versioning and publishing status

Observed on the public npm registry on 2026-11-10:

| Package | Versions | Created / modified |
|---|---|---|
| `@caifrazier/atls-spec` | `1.0.0-rc.1` only | 2026-07-04T08:29:58Z / 2026-07-04T08:29:59Z |
| `@caifrazier/atls-sdk` | `1.0.0-rc.1` only | 2026-07-04T08:30:40Z / 2026-07-04T08:30:41Z |
| `@atls/spec`, `@atls/sdk` | not published | |

The publish timestamp sits a few minutes after commit `8bd2354` (2026-07-04T01:26:17-07:00, "rename packages to `@caifrazier` scope for npm publication"). npm will not overwrite an existing version, and no later version exists. This tree's `package.json` files still say `1.0.0-rc.1`.

Commits on this branch's parent that are after that publish and therefore cannot be what `npm install @caifrazier/atls-sdk@1.0.0-rc.1` returns:

| Commit | Date | Subject |
|---|---|---|
| `0cf07c7` | 2026-07-06 | baseline RC2 camelCase + compatibility module work |
| `963e6d7` | 2026-07-06 | typed read-path errors |
| `37141f5` | 2026-07-07 | polymorphic axe check data |
| `c61f602` | 2026-07-17 | Workbench capture contracts (the commit message; the word "Workbench" does not appear in the current tree) |
| `c7b9634` | 2026-07-20 | SDK reader adjustments |
| `d78f5a0` | 2026-07-23 | SDK describe layer and capture-quality disclosure |
| `8e801cf` | 2026-07-24 | bodiless redirect-evidence rows |
| `4165795` | 2026-09-04 | structured data audit evidence |
| `77d1631` | 2026-11-04 | shared dataset registry for producers and the SDK diff |

`SECURITY.md` lines 5–8 marks `1.0.0-rc.x` supported and earlier pre-releases unsupported. There is no changelog file. Format identity (`schemaVersion` date) and package identity (`1.0.0-rc.1`) are independent, which `docs/versioning.md` says on purpose, and the package side has not moved since the first publish.

### 2.6 Test coverage

Runner: Vitest, forked pool, one worker (`packages/atls-sdk/package.json` `test` script). CI runs that plus `tsc -b`.

SDK tests, all against archives built in a temp directory by `test/helpers/fixtureArchive.ts` (archiver + `@mongodb-js/zstd`). Nothing under the repo is a checked-in `.atls`, `.jsonl`, or `.zst` fixture. No test opens a Cartographer-produced archive.

| File | What it locks |
|---|---|
| `test/reader.test.ts` | Happy-path open, blob read, `select` projection, unknown-dataset throw, format major rejection, prerelease warning, strict vs lenient malformed records, `close()` mid-iteration. |
| `test/reader.readpath.test.ts` | Entry limits, zstd expansion bombs, JSONL line cap, duplicate names, path traversal, uncompressed parts, corrupt central directory, corrupt manifest JSON. |
| `test/reader.typedErrors.test.ts` | `AtlasPathError`, empty blob ref, already-aborted signal. |
| `test/reader.newerFormat.test.ts` | Parts stored only under `pages/` and `edges/` still yield through `pageMetadata()`, `navigation()`, and `select`. |
| `test/reader.zeroRecords.test.ts` | Declared dataset with an empty part yields nothing and still validates. |
| `test/validate.test.ts` | Referential errors, broken-link warning, manifest `formatVersion`, strict blob-ref and null rules, `maxIssues`. |
| `test/validate.truncation.test.ts` | Unparseable records fail validation; truncation is indeterminate. |
| `test/describe.test.ts` | describe / slice / ordinal / archived schema / blob stat, including alias folders and missing parts. |
| `test/diff.test.ts` | Manifest deltas, and that the default list includes the six registry extensions. |
| `test/crossMode.test.ts` | URL join across modes. |
| `test/compatibility.test.ts` | `minSdkVersion` compare, including the prerelease exception. |

Spec-package tests that the SDK's correctness depends on: `packages/atls-spec/test/` (`schemas.test.ts`, `schema-negative.test.ts`, `structured-data-audit.test.ts`, `enum-validation.test.ts`, `generator-coverage.test.ts`, `generator-output.test.ts`, `datasetKeys.test.ts`, `phase4-schemas.test.ts`, `publicSurface.test.ts`, `readiness-checks.test.ts`). `generator-output.test.ts` regenerates JSON Schema and asserts it contains no accidental empty-object subschema. `readiness-checks.test.ts` requires the Apache header on TypeScript sources, bans a stale "returns 0 records" banner in a fixed doc list, and checks that package `LICENSE` files match the root.

The fixture archive is a small raw-mode sample: one page, one navigation record, one asset, one response, minimal manifest. It is enough to test the reader. It is not a conformance vector for the 21-dataset format, for `schemaVersion` history, for checksum layout, or for a real zstd CLI frame.

### 2.7 Gaps that block an outside developer from adopting the SDK

1. **The published tarball is not this tree, and it wears the same version.** `npm install @caifrazier/atls-sdk` returns the 2026-07-04 artifact. Installing from GitHub `main` returns a different API (describe, redirect rows, audit fields, registry diff) with no version boundary. A consumer cannot tell from the version number which one they have.
2. **Read-only.** Producing an archive still means depending on Cartographer, or writing a producer from the schemas. The SDK will not round-trip.
3. **Node ESM only**, with a native addon in `dependencies` that the library does not call. `fzstd` is pinned to `0.1.1` exactly (`package.json` line 56). Interop with frames the Cartographer docs say are produced by the system `zstd` CLI is untested in this repo.
4. **The documented API is a subset of the exported API**, and in two places (`API.md` on folder resolution and on the zstd library) it describes behavior the code no longer has. The first file a new user opens is wrong about how to read.
5. **`validate()` is not a conformance tool.** It does not check part checksums, the archive content hash, blob hashes, provenance, embedded JSON Schema, or three of the registry datasets. `checkIntegrity` joins on URL. A green result does not mean "this byte stream is Atlas".
6. **No golden archives.** Adoption and independent implementations need vectors. The synthetic helper is test-private, deflates the ZIP, and writes `formatVersion: "1.0.0"` / `atlasVersion: "1.0"`, which is a legal input to this SDK and not the layout `docs/versioning.md` calls current.
7. **Error text names a package that does not exist** (`@atls/sdk`). `NOTICE` does the same for `@atls/spec` and `@atls/sdk`.
8. **`pageMetadata()` hides the on-disk record.** That is a reasonable product choice and it is documented in `pageMetadataMapping.ts`, and it surprises anyone who treats the SDK types as the format. `PageRecord` in the spec package makes the same trap available one import away.
9. **No stability promise beyond the rc.** `formatVersion` major is the only hard compatibility gate, and it does not move when the dataset schema does. `schemaVersion` is informational. An adopter pinning `1.0.0-rc.1` is pinning a date, not a contract.
10. **Examples are not a supported interface.** They are excluded from the Apache-header readiness check when they are `.mjs` (the check looks at `.ts`). Three `.mjs` examples carry a 2025 copyright banner and import `../dist/index.js`, so they fail until `pnpm build`.

What already helps adoption, and should be kept: Apache-2.0, a public publish config, bounded reads for untrusted input (`SECURITY.md`), typed errors with stable `code`s, a real (if narrow) Vitest suite in CI, and a spec package the SDK consumes instead of forked interfaces.

---

## 3. Other tooling in this repository

There is no writer, no converter, no inspector CLI, and no language binding besides the TypeScript SDK above.

| Tool | Path | Role |
|---|---|---|
| Spec package | `packages/atls-spec` | Zod schemas, generated JSON Schema, TypeScript types, `flattenPageMetadataRecord`, `ATLAS_DATASET_KEYS`. npm: `@caifrazier/atls-spec@1.0.0-rc.1`, same publish-once situation as the SDK. SPDX in `package.json`: `Apache-2.0 OR CC-BY-4.0`. Subpath export `./schemas/*`. |
| JSON Schema generator | `packages/atls-spec/src/schemas/generator.ts` | Build step `node dist/schemas/generator.js` after `tsc`. Writes `dist/schemas/*.schema.json`. Not a committed schema set, not a network URL. |
| SDK | `packages/atls-sdk` | Section 2. |
| Examples | `packages/atls-sdk/examples/` | `read-pages.ts`, `export-edges.ts`, `validate-archive.ts`, `missing-alt.mjs`, `status-report.mjs`, `top-sections.mjs`, `test.mjs`. Sample programs, not a package bin. |
| Tests | `packages/atls-spec/test/`, `packages/atls-sdk/test/` | Schema positive/negative cases and synthetic reader fixtures. See section 2.6. |
| CI | `.github/workflows/ci.yml` | Build, test, typecheck. Node 20 and 22. |

Root `package.json` is `"private": true` and is only the pnpm workspace (`pnpm-workspace.yaml`: `packages/*`). Scripts: `build`, `test`, `lint`, `typecheck`, `clean`.

Searched and absent: a `bin` entry, a CLI framework, checked-in `.atls` / `.jsonl` / `.zst` samples, Python modules, Rust/Go/WASM crates, a Dockerfile, a publish workflow, a changelog.

---

## 4. CF-specific consumers baked into this repo

Cartographer is the assumed producer. Continuum, Horizon, and a handful of product names are assumed consumers. Navigator, Colorist, and the WordPress plugins are not referenced as format consumers anywhere in this tree. WordPress appears once, as an example string in a `techStack` comment (`types.ts` line 667). Navigator appears only as a trademark in `NOTICE`.

| Assumption | Where |
|---|---|
| Writer is `@cf/cartographer` → `src/io/atlas/`. | `SPECIFICATION.md` lines 4 and 48. Every storage chapter's "verified against" line points at `packages/cartographer/src/io/atlas/`, which this repo does not contain. `datasetKeys.ts` lines 21–23 says producers (Cartographer) and the SDK share the registry. |
| `generator` string `cartographer-engine/<version>`. | `docs/root-files.md` line 37; `types.ts` line 1784 comment. Provenance example app is `"cartographer"` (`provenance.schema.ts` line 28). |
| `owner.name` literal `"Cai Frazier"`. | `docs/root-files.md` line 38. Required field, unconstrained value, in the schema. |
| Continuum holds extraction rule definitions. The archive stores outcomes plus a snapshot. | `docs/datasets.md` lines 304–306; `cartographer-datasets.schema.ts` lines 781–787. The dataset is usable without Continuum; the prose tells you the rule registry lives there. |
| Continuum daemon → renderer IPC is why `describe.ts` returns plain data. | `describe.ts` lines 21–24. |
| Horizon owns `audit_results` and is a named consumer of flat page metadata. | `generator.ts` lines 71–73; `audit_results.schema.ts` lines 17–21; `pageMetadataMapping.ts` line 38. Schema is in the public package and out of `schemaMap`. |
| `consumers` examples: `"Continuum SEO"`, `"Horizon Accessibility"`, `"atlas-sdk"`. | `types.ts` line 1479; `docs/root-files.md` line 39; spec tests use `['Continuum SEO']`. |
| axe `auditEngine` enum includes `"cartographer"`. | `cartographer-datasets.schema.ts` line 650; `types.ts` line 1146 `AccessibilityEngineMode`. An outside producer must emit that enum value or omit `axe`. |
| Technology detection comments point at `extractors/wappalyzer.ts`. | `cartographer-datasets.schema.ts` lines 401–403. The on-disk shape is `{ name, version?, categories? }` plus passthrough, which is implementable without Wappalyzer. |
| Render mode `import` and `source.sourceType: 'warc'`. | `manifest.schema.ts` lines 107 and 121–126; `types.ts` lines 1485–1494. The WARC-to-Atlas mapping is not specified here. |
| Pack names `Core`, `A11y-Light`, `A11y-Full`, `Perf`, `Visual`. | `types.ts` lines 1447–1457. Product bundles, not explained as an interchange feature. |
| Trademarks reserved: Atlas, Cartographer, Continuum, Navigator. | `NOTICE` lines 28–33. The notice explicitly allows "compatible with the Atlas format". Colorist is not listed. |

`readiness-checks.test.ts` lines 108–126 forbids the string `drancich.com` in spec and SDK TypeScript. That is a CF client name being kept out of the public tree, not a format field.

---

## 5. Portability and openness gaps

Licensing is in better shape than the spec text. The gaps that stop an outside party from implementing Atlas from documentation alone are definitional.

**License, as it stands.** Code is Apache-2.0 (`LICENSE`, SPDX on the SDK). The written spec and the JSON Schemas are also CC BY 4.0 (`LICENSE-SPEC.md`). The spec package's SPDX expression is `Apache-2.0 OR CC-BY-4.0`, and `LICENSE-SPEC.md` lines 21–23 says a file that is both code and schema may be used under either. Zod *sources* are Apache-2.0 (the code grant). Generated JSON Schema is what the CC BY text names. Trademarks are not licensed (`NOTICE`). Contributions use the DCO (`CONTRIBUTING.md`). That is an open license. It is not a standards-body license: CC BY requires attribution, and the dual-licensing note is easy to misread. There is no patent-policy document beyond the Apache-2.0 grant on the code.

**What is already portable.** A motivated reader can unzip, zstd-decompress, and JSON-parse using the Python sketch in `docs/reading-archives.md` lines 32–65, then validate records against the Zod (or the generated JSON Schema, after a build). The 21 dataset names are one const. `pageId` as the join key is consistent. The SDK is Apache-2.0 and has been published, once.

**What is not implementable from the documents alone.**

1. **No single current edition.** `schemaVersion` is `2026-07-01` in the index and `2026-09-04` in the versioning chapter. `formatVersion` / `atlasVersion` are `1.1.0` / `1.1` in that chapter and `1.0.0` / `1.0` in the type comments and in the only fixtures. The SDK treats every `1.x` as the same format. There is no spec-version constant in code.
2. **Producer behavior is specified by citation to another repo.** Part rotation, zstd level, allowlist of archived paths, content-hash construction, URL-key normalization, media transcoding, when a dataset directory is pruned, and the literal `generator` / `owner` values are all "see Cartographer". Those files are not here.
3. **Folder-name history is told two ways** (section 1.4). A producer does not know which names are conformant.
4. **Three page/edge models** ship as the public API of the spec package (on-disk nested, flat `PageRecord`, flat `EdgeRecord` with snake_case). The SDK adds a fourth view via `pageMetadata()`.
5. **`dom_snapshot` / `acc_tree` / `render` schemas describe records the datasets do not store** (section 1.2). `render_state` embeds free JSON.
6. **Manifest casing and integrity field names** differ between `docs/root-files.md`, `manifest.schema.ts`, and `AtlasManifest` (section 1.5).
7. **Unknown-field behavior is not the rule the versioning chapter states.** Stripping versus rejecting versus preserving is per-object and easy to get wrong in another language.
8. **Checksums, archive hash, and blob-hash verification have no algorithm precise enough to reimplement, and the reference reader does not check them.** Two implementations can disagree and both pass `validate()`.
9. **Identifier versions are prose.** UUID v7/v5/v4 claims are not schema constraints.
10. **No conformance corpus.** Tests build throwaway ZIPs that do not match the documented "current" version stamps, use deflate, and cover a handful of datasets. There is no byte-level test vector, no negative corpus of almost-Atlas files, and no archive produced by the real writer checked in here.
11. **JSON Schema is a build product**, not a published edition. `zod-to-json-schema` output is what other languages would consume, and `generator-output.test.ts` exists because that translation has already emitted `{}` "accept anything" subschemas. A downstream implementation pinning the generated files needs a versioned artifact. Today those files appear only inside `dist/` after `pnpm build`, and inside whatever the 2026-07-04 npm tarball happened to contain.
12. **The reference SDK on npm is stale relative to this spec** (section 2.5). Adopters who trust the registry are not reading the format this repo defines today.
13. **CF literals in the prose** (`owner.name`, `generator` prefix, Continuum rule registry, Horizon audit schema, `auditEngine: "cartographer"`) read as format requirements. The schema makes most of them ordinary strings. The axe enum does not.
14. **Package names in `NOTICE` and in one error string** (`@atls/sdk`, `@atls/spec`) do not match the published names (`@caifrazier/atls-spec`, `@caifrazier/atls-sdk`).
15. **Engine types in the spec package** (`CrawlEvent`, `ConsoleRecord`, and the rest in `types.ts`) will be mistaken for archive records. `ConsoleRecord.page_id` is snake_case and points at a "pages dataset" (`types.ts` lines 1098–1104) that the current layout does not have.
16. **`summary.v2.json` is documented as always present and has no schema**, and the reader never loads it. Same for provenance hashing rules (`output.hashSha256` is "SHA-256 of the produced dataset" with the byte range unspecified).

---

## 6. Next steps, in order

1. **Cut one edition and point every document at it.** Pick the schema tag the Zod on `main` actually implements (the versioning chapter's `2026-09-04` is the one that matches the Schema.org fields). Put that string, plus `atlasVersion` / `formatVersion` / `specVersion`, in one const imported by the manifest schema as the *documented current* value, not as a reject-everything-else rule. Update `SPECIFICATION.md`, `root-files.md`, `reading-archives.md`, and `API.md` from that const. Correct "19 datasets" to the 21 in `datasetKeys.ts`. Delete or archive the `legacy/v1/` and `../cartographer/docs` pointers, or replace them with a real URL once the monorepo map exists.
2. **Split the interchange format from Cartographer policy.** In the spec, mark as producer policy, not wire format: presence-by-mode matrix, transcoding, `owner.name`, `generator` prefix, `consumers` defaults, pack names, WARC import, Continuum as the rule registry, Horizon as the owner of `audit_results`. Keep those sections; stop letting them define conformance.
3. **Resolve folder names in one paragraph that matches the code.** State that conformant producers write the long `ATLAS_DATASET_KEYS` directories, and that readers should accept `pages` / `edges` / `failed_pages` as a legacy alias. Rename `NEWER_FORMAT_FOLDER_MAP` when the code is next touched so the identifier stops contradicting the spec. This map does not change that code.
4. **Publish the SDK and the spec as a new version that is this tree.** Stop shipping further commits under `1.0.0-rc.1`. Add a release workflow. Fix `SdkCompatibilityError` and `NOTICE` so they name `@caifrazier/atls-sdk` and `@caifrazier/atls-spec`. Move `@mongodb-js/zstd`, `ajv`, and `ajv-formats` out of the SDK's runtime dependencies unless something in `src/` starts importing them. Refresh `README.md`, `QUICK_REFERENCE.md`, and `docs/API.md` so the documented surface includes `describe*`, `sitemapUrls`, `extraction`, compatibility, and `indeterminate`.
5. **Check in a conformance corpus and make `validate` able to use it.** Small sealed archives, committed as bytes: minimal raw; one redirect chain (bodiless `responses` rows); one archive that uses the alias folders; one that sets the camelCase coverage block and one that sets the pre-2026-07-04 snake_case block; vectors for part checksum, content hash, and blob hash with the exact byte range written down. Generate at least one vector with the `zstd` CLI, not only `@mongodb-js/zstd`, and one stored (method 0) ZIP. Teach `validate()` to verify those hashes, or document a separate `verifyIntegrity()` so the current referential checks keep their meaning.
6. **Make the on-disk schema the only normative type.** Mark `PageRecord`, `EdgeRecord`, `CrawlEvent`, `ConsoleRecord`, and the other engine structs as non-normative in the spec package's export docs, or move them to a clearly named entrypoint. Point `render_state`'s embedded payloads at a real schema or delete `dom_snapshot` / `acc_tree` from the "embedded in render_state" claim. Add the missing `page_metadata` fields (`media`, `limits`, `capture_degraded`, `canonicalResolved`) to `docs/datasets.md`, and decide whether `capture_degraded` stays snake_case.
7. **Write the algorithms that are currently names.** Content-hash concatenation order, schema-hash JSON canonicalization, URL-key normalization steps, provenance `output.hashSha256` byte range, part-file rotation. If the only specification is Cartographer source, copy the algorithm into `docs/storage-and-encoding.md` once the monorepo map confirms it, and add a vector per algorithm in the corpus.
8. **Version the spec the way outsiders can pin.** A `SCHEMA_VERSION` history table that is tested against the Zod (a fixture per tag, or an explicit "this edition accepts these optional fields" test). Treat additive fields as optional forever within a `formatVersion` major, which the versioning chapter already asks for and the SDK does not enforce. Publish generated JSON Schema next to the spec edition (a `schemas/` directory in the repo, or a GitHub release asset), so other languages do not have to run `zod-to-json-schema`.
9. **Decide the standards license in public.** Apache-2.0 plus CC BY 4.0 is enough for people to implement and ship. If the goal is a spec others will republish inside their own standards text, say whether the schema edition is available under CC0 or only CC BY, and keep the trademark rule already in `NOTICE` ("compatible with the Atlas format" is allowed; the names Atlas, Cartographer, Continuum, and Navigator are not licensed). Add Colorist to that list only if it is actually a mark you intend to reserve; it is not mentioned in this repo today.
10. **After the edition and the corpus exist, add a minimal reference writer in this repo** (or publish Cartographer's `io/atlas` writer as its own Apache-2.0 package with a charter that it implements the edition). Until a writer ships from the same commit as the schemas, "the code is authoritative" means "the reader and the Zod are authoritative" and producers remain a private implementation.

---

## Source index

| Concern | Path |
|---|---|
| Repo overview and dual license | `README.md`, `LICENSE`, `LICENSE-SPEC.md`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md` |
| Spec index | `packages/atls-spec/SPECIFICATION.md` |
| Layout, bytes, identity, versions, root files, datasets, schemas, reading | `packages/atls-spec/docs/*.md` |
| Dataset registry | `packages/atls-spec/src/datasetKeys.ts` |
| On-disk record Zod | `packages/atls-spec/src/schemas/cartographer-datasets.schema.ts`, `responses.schema.ts`, `resources.schema.ts`, `reconstruction_index.schema.ts`, `runtime-core.schema.ts` (`AssetRecordSchema`) |
| Manifest / summary / capabilities / provenance | `packages/atls-spec/src/schemas/manifest.schema.ts`, `summary.schema.ts`, `capabilities.schema.ts`, `provenance.schema.ts` |
| JSON Schema codegen | `packages/atls-spec/src/schemas/generator.ts` |
| In-memory composite and engine types | `packages/atls-spec/src/types.ts`, `src/schemas/runtime-core.schema.ts` |
| Flat page adapter | `packages/atls-spec/src/pageMetadataMapping.ts` |
| SDK entry and readers | `packages/atls-sdk/src/index.ts` |
| ZIP / zstd / limits | `packages/atls-sdk/src/reader.ts` |
| Validation | `packages/atls-sdk/src/validate.ts` |
| Describe / slice / schema / blob stat | `packages/atls-sdk/src/describe.ts` |
| Format gate, SDK floor, diff, cross-mode | `packages/atls-sdk/src/formatVersion.ts`, `compatibility.ts`, `diff.ts`, `crossMode.ts`, `datasetPresence.ts` |
| Synthetic archives | `packages/atls-sdk/test/helpers/fixtureArchive.ts` |
| SDK narrative (partially stale) | `packages/atls-sdk/README.md`, `QUICK_REFERENCE.md`, `docs/API.md` |
| Packages and CI | `packages/atls-spec/package.json`, `packages/atls-sdk/package.json`, `.github/workflows/ci.yml` |
