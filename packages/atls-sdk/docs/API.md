# Atlas SDK — API Reference

Complete reference for `@caifrazier/atls-sdk`, the read-side SDK for `.atls` archives.

Current schema tag: `2026-09-04`.

_Verified against `packages/atls-sdk/src/` and `AtlasManifestV1Schema` on 2026-11-10._

---

## Exports

```ts
import {
  openAtlas, select, validate,
  MalformedRecordError,
  diffManifests, formatManifestDiff,
  buildCrossModeIndex,
  readManifest, readSummary, iterateParts, readBlob, openZipHandle,
  AtlasResourceLimitError,
  describeArchive, describeDataset, readDatasetSlice, readRecord, readSchema, statBlob,
  AtlasRecordNotFoundError,
} from "@caifrazier/atls-sdk";
```

---

## `openAtlas(path, options?) → Promise<AtlasReader>`

Opens an archive and returns a reader.

```ts
interface OpenAtlasOptions {
  /** Default true. When true, a malformed record throws MalformedRecordError.
   *  When false, malformed records are skipped and counted in stats.corruptedRecordCount. */
  strict?: boolean;

  /** Optional overrides for default bounded ZIP, zstd, and JSONL read limits. */
  limits?: Partial<AtlasReadLimits>;
}
```

```ts
interface AtlasReadLimits {
  maxEntries: number;
  maxZipEntryBytes: number;
  maxJsonRootBytes: number;
  maxPartCompressedBytes: number;
  maxPartDecompressedBytes: number;
  maxBlobCompressedBytes: number;
  maxBlobDecompressedBytes: number;
  maxJsonlLineBytes: number;
}
```

### `AtlasReader`

| Member | Type | Notes |
|---|---|---|
| `manifest` | `AtlasManifest` | Parsed `manifest.json`. |
| `summary` | `AtlasSummary` | Parsed `summary.json`. |
| `datasets` | `Set<DatasetName>` | Datasets detected as present. |
| `packs` | `PackView` | Capability-pack view. |
| `stats` | `{ corruptedRecordCount: number }` | Cumulative read stats (lenient mode). |
| `hasDataset(name)` | `(DatasetName) => boolean` | Presence check. |
| `getBlob(ref)` | `(ref: string) => Promise<Buffer>` | Decompress a blob ref. Record fields are camelCase (`bodyBlobRef`). Accepts `sha256/<2>/<2>/<64 hex>` and `blobs/sha256/<2>/<2>/<64 hex>.zst`, including either the `blobs/` prefix or the `.zst` suffix alone. |
| `close()` | `() => void` | Release the zip handle. Always call it. |
| `readers.*` | object | Async-iterable dataset readers (below). |

### `readers` methods

Each returns an `AsyncIterable` of records for one dataset.

| Method | Yields | Dataset |
|---|---|---|
| `pageMetadata()` | `FlatPageMetadata` | `page_metadata` (flattened) |
| `navigation()` | record | `navigation` |
| `content()` | record | `content` |
| `structuredData()` | record | `structured_data` |
| `technology()` | record | `technology` |
| `renderState()` | record | `render_state` (full) |
| `security()` | record | `security` |
| `performance()` | record | `performance` |
| `accessibility()` | `AccessibilityRecord` | `accessibility` |
| `responses()` | `ResponseRecordV1` | `responses` |
| `resources()` | `ResourceRecordV1` | `resources` |
| `assets()` | `AssetRecord` | `assets` |
| `events()` | `EventRecord` | `events` |
| `pipelineFailures()` | record | `pipeline_failures` |
| `pipelineAlerts()` | record | `pipeline_alerts` |
| `sitemapUrls()` | `SitemapUrlRecord` | `sitemap_urls` |
| `extraction()` | `ExtractionRecord` | `extraction` |
| `robots()` | `RobotsRecord` | `robots` (spec 1.3, one row per origin) |
| `dataset<T>(name)` | `T` | any dataset by canonical key |

**Deprecated aliases** (functional, for backward compatibility): `pages()` → `pageMetadata()`,
`edges()` → `navigation()`, `errors()`/`failedPages()` → `pipelineFailures()`.

```ts
const atlas = await openAtlas("./crawl.atls");
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url, page.title);   // flattened by pageMetadataMapping
}
atlas.close();
```

> Records are joined across datasets on `pageId`. `pageMetadata()` returns the *flattened* shape
> (`title` at top level, not `core.title`) via `@caifrazier/atls-spec`'s `pageMetadataMapping`.

---

## Error handling

In strict mode (default) a record that fails to parse/validate throws `MalformedRecordError` with
`.dataset` and `.reason`. In lenient mode (`{ strict: false }`) such records are skipped and counted:

```ts
const atlas = await openAtlas("./crawl.atls", { strict: false });
for await (const p of atlas.readers.pageMetadata()) { /* … */ }
if (atlas.stats.corruptedRecordCount > 0) {
  console.warn(`skipped ${atlas.stats.corruptedRecordCount} malformed records`);
}
atlas.close();
```

---

## `select(path, options) → AsyncIterable<Partial<T>>`

One-shot filtered/projected read without managing an `AtlasReader`.

```ts
interface SelectOptions {
  dataset: DatasetName;                 // required
  where?: (record: any) => boolean;     // filter predicate
  fields?: string[];                    // dot-path projection
  limit?: number;                       // cap rows
  limits?: Partial<AtlasReadLimits>;    // ZIP, zstd, and JSONL read limits
}

// status codes live in `responses`
for await (const row of select("./crawl.atls", {
  dataset: "responses",
  where: (r) => r.statusCode >= 400,
  fields: ["url", "statusCode"],
  limit: 100,
})) {
  console.log(row);
}
```

Dataset names are canonicalized, so legacy aliases also resolve.

---

## `validate(path, options?) → Promise<ValidationResult>`

```ts
interface ValidateOptions {
  checkIntegrity?: boolean;   // default true. Edges and assets reference real pages.
  checkBrokenLinks?: boolean; // default true. Internal edges to 4xx/5xx are warnings.
  checkManifest?: boolean;    // default true. Manifest counts versus records read.
  maxIssues?: number;         // default 1000. Positive integer. Stop collecting after N issues.
  errorsOnly?: boolean;       // default false. Skip warnings.
  strict?: boolean;           // default false. Full manifest fields, blob-ref spelling, no nulls.
  limits?: Partial<AtlasReadLimits>; // default read limits while reading archive entries.
  skipBlobVerification?: boolean; // default false. Skip decompress-and-hash of blobs.
}

interface ValidationResult {
  valid: boolean;
  /** True when the run stopped at maxIssues before it could decide. Not valid. */
  indeterminate: boolean;
  issues: { severity: "error" | "warning"; code: string; message: string;
            dataset?: string; record?: any; details?: object }[];
  stats: {
    pageMetadataChecked: number; navigationEdgesChecked: number; assetsChecked: number;
    contentChecked: number; structuredDataChecked: number; technologyChecked: number;
    renderStateChecked: number; performanceChecked: number; securityChecked: number;
    responsesChecked: number; resourcesChecked: number; sitemapsChecked: number;
    sitemapUrlsChecked: number; extractionChecked: number; robotsChecked: number;
    eventsChecked: number; accessibilityChecked: number;
    pipelineFailuresChecked: number; pipelineAlertsChecked: number;
    errorsFound: number; warningsFound: number;
  };
  truncated: boolean;
}
```

```ts
const result = await validate("./crawl.atls", { strict: false });
console.log(result.valid, result.stats.errorsFound, result.stats.warningsFound);
```

> `validate()` checks part checksums, `contentSha256`, and blob hashes, then schema-checks the
> datasets listed in [schema-system.md](https://github.com/CaiFrazier/atls/blob/main/packages/atls-spec/docs/schema-system.md).
> When `atlasVersion` is 1.2 or later it reports `INTEGRITY_DEPRECATED_FIELD` if `archiveSha256` or
> `auditHash` is present, `CONTENT_SHA256_LOCALE_ORDER` if `contentSha256` matches only locale path
> order, `LEGACY_BLOB_REF` for `blobs/sha256/<2>/<2>/<hash>.zst` in a record, `TRAILING_SLASH_DECLARATION`
> for an extra or conflicting trailing-slash declaration, and `ASSET_ID_MISMATCH` when `assetId` is not
> the UUID v5 of `normalizeUrl(assetUrl)`. A 1.1 or earlier stamp keeps the previous checks.
> `getBlob`, `readBlob`, and `statBlob` still resolve the legacy spelling. `skipBlobVerification` skips
> blob hashes only. It does not schema-check `quarantine`, `reconstruction_index`, or `frontier_ledger`.
> On a 1.2 or later stamp it does read `reconstruction_index` for the legacy spelling. It does check
> `robots`: the schema, canonical `bodyBlobRef` resolution (unless `skipBlobVerification`), `blockedNoCopy`
> against `manifest.robotsPolicy.failClosed`, and one row per origin. When
> `summary.crawlContext.endReason` is present it must map onto `completionReason`.
> `checkIntegrity` checks references. `strict` here defaults to false. `openAtlas({ strict })`
> defaults to true and means something else: throw on a malformed record.

`normalizeUrl`, `urlKey`, `serializedOrigin`, `assetId`, and `contentSha256` are exported from
this package. URL identity is spec 1.2. `serializedOrigin` is the spec 1.3 origin of that
normalized URL. See [url-identity.md](https://github.com/CaiFrazier/atls/blob/main/packages/atls-spec/docs/url-identity.md).

---

## `diffManifests(a, b, options?)` / `formatManifestDiff(diff)`

Compare two archives by their manifests (pure data, no I/O):

```ts
const [a, b] = await Promise.all([openAtlas("./before.atls"), openAtlas("./after.atls")]);
const diff = diffManifests(a.manifest, b.manifest);
console.log(formatManifestDiff(diff));   // formatted table
a.close(); b.close();
```

Exports the `ManifestDiff`, `DatasetDelta`, and `DiffManifestsOptions` types. The default dataset
list is `ATLAS_DATASET_KEYS` (all 22 registry names).

---

## `buildCrossModeIndex(readers) → Promise<CrossModeIndex>`

Aligns records across archives crawled in different render modes, keyed by URL (since `pageId` is
not stable across crawls). Requires ≥2 readers; resolves each reader's mode from its `specLevel`.
Exports `CrossModeIndex` and `CrossModeEntry`.

---

## Low-level helpers

These bypass `openAtlas` and operate on the zip directly. `iterateParts` reads the directory name
you pass. It does not apply the short-alias fallback. `openAtlas` and `select` do: they prefer
the long `ATLAS_DATASET_KEYS` directory and fall back to `pages`, `edges`, or `failed_pages`.

| Export | Signature | Notes |
|---|---|---|
| `openZipHandle(path, options?)` | `(path: string, options?: AtlasReadOptions) => Promise<ZipHandle>` | Open a zip for repeated reads; call `.close()`. |
| `readManifest(path, options?)` | `(path: string, options?: AtlasReadOptions) => Promise<AtlasManifest>` | Also `(handle: ZipHandle) => Promise<AtlasManifest>`. Parse `manifest.json`. Field names match `AtlasManifestV1Schema`, including `integrity.contentSha256`. |
| `readSummary(path, options?)` | `(path: string, options?: AtlasReadOptions) => Promise<AtlasSummary>` | Also `(handle: ZipHandle) => Promise<AtlasSummary>`. Parse `summary.json`. |
| `iterateParts(path, dataset, options?)` | `(path: string, dataset: DatasetName, options?: { signal?: AbortSignal; zipHandle?: ZipHandle; limits?: Partial<AtlasReadLimits> }) => AsyncIterable<string>` | Raw JSON Lines from a dataset directory. Pass the long name (`page_metadata`) unless the archive stored that dataset under a short alias. The options type is not exported. |
| `readBlob(path, ref, options?)` | `(path: string, ref: string, options?: AtlasReadOptions) => Promise<Buffer>` | Also `(handle: ZipHandle, ref: string) => Promise<Buffer>`. Decompresses the blob. Accepts both spellings, the same as `getBlob`. |

```ts
for await (const line of iterateParts("./crawl.atls", "page_metadata")) {
  const rec = JSON.parse(line);
  console.log(rec.pageId, rec.url);
}
```

Decompression of zstd frames uses `fzstd`.

---

## `describeArchive(target, options?) → Promise<ArchiveDescription>`

```ts
function describeArchive(
  target: string | ZipHandle,
  options?: AtlasReadOptions,
): Promise<ArchiveDescription>;
```

Joins `manifest.json` to ZIP central-directory facts. It does not scan dataset rows and does not inflate blobs. `identity` is the summary identity when that file parses and has one, otherwise the manifest identity. `summaryStats` is `summary.stats`, or null when the summary is missing or unreadable. `options` is `{ limits?: Partial<AtlasReadLimits> }`.

```ts
type DatasetState = "present" | "empty" | "absent" | "partial" | "unexpected" | "corrupt";

interface DatasetPartDescription {
  path: string;
  compressedBytes: number;  // ZIP central-directory compressed size
  storedBytes: number;      // stored payload size (still zstd-compressed for .zst parts)
}

interface DatasetDescription {
  name: string;             // canonical dataset name (manifest key)
  folder: string;           // physical folder: the long name, or a short alias
  state: DatasetState;
  expected: boolean | null;
  declaredRecordCount: number | null;
  coveragePct: number | null;
  partCount: number;
  parts: DatasetPartDescription[];
  compressedBytes: number;
  storedBytes: number;
  schemaPath: string | null;    // fragment stripped
  schemaVersion: string | null;
  schemaHash: string | null;
}

interface ArchiveDescription {
  atlasVersion: string | null;
  formatVersion: string | null;
  specVersion: string | null;
  schemaVersion: string | null;
  crawlId: string | null;
  mode: string | null;
  generator: string | null;
  createdAt: string | null;
  crawlStartedAt: string | null;
  crawlCompletedAt: string | null;
  crawlConfigHash: string | null;
  configIncluded: boolean | null;
  incomplete: unknown;
  redactionApplied: unknown;
  privacyPolicy: unknown;
  identity: unknown;
  entryCount: number;
  datasets: DatasetDescription[];
  blobs: { count: number; compressedBytes: number; storedBytes: number };
  schemaEntries: string[];   // entries under schemas/
  hasCapabilities: boolean;
  summaryStats: unknown;
}
```

`state` comes from the manifest and the central directory. `unexpected` is a folder of part files the manifest did not declare. `corrupt` is a declared part missing from the archive. `meta/`, `schemas/`, and `blobs/` are not reported as datasets.

---

## `describeDataset(target, dataset, options?) → Promise<DatasetDescription | null>`

```ts
function describeDataset(
  target: string | ZipHandle,
  dataset: string,
  options?: AtlasReadOptions,
): Promise<DatasetDescription | null>;
```

Returns the `DatasetDescription` from `describeArchive` whose `name` or `folder` equals `dataset`. Returns `null` when neither matches.

---

## `readDatasetSlice(target, dataset, options?) → Promise<DatasetSlice>`

Read a bounded slice of one dataset. Parts before the cursor are not opened. Lines before the cursor line are not parsed.

```ts
interface ReadDatasetSliceOptions {
  cursor?: string | null;  // previous nextCursor. Omit to start at the first row.
  limit?: number;          // positive integer. Default 100. Capped at 10000.
  maxBytes?: number;       // positive integer. Max accumulated raw JSON bytes. Default 16 MiB.
  limits?: Partial<AtlasReadLimits>;
  signal?: AbortSignal;
}
```

`limit` and `maxBytes` must be positive integers. A row that would push the slice past `maxBytes` stays unread, and `nextCursor` points at that row. When the first row alone is larger than `maxBytes`, the call throws `AtlasResourceLimitError`. `part`, `line`, and `ordinal` in a cursor must be safe non-negative integers.

---

## `readRecord(target, dataset, ordinal, options?) → Promise<DatasetSliceRecord>`

```ts
function readRecord(
  target: string | ZipHandle,
  dataset: string,
  ordinal: number,
  options?: ReadRecordOptions,
): Promise<DatasetSliceRecord>;

interface ReadRecordOptions extends AtlasReadOptions {
  signal?: AbortSignal;
}
```

Reads one record by its global dataset ordinal (the same `ordinal` as `readDatasetSlice`). A negative ordinal, or one that is not an integer, throws `AtlasRecordNotFoundError`. So does an ordinal past the last record. The error has `code` `"ATLAS_RECORD_NOT_FOUND"`, `dataset`, and `ordinal`.

`DatasetSliceRecord` is `{ ordinal, part, partIndex, lineInPart, json }`. `json` is the raw JSON line, unparsed.

---

## `readSchema(target, dataset, options?) → Promise<DatasetSchemaResult | null>`

```ts
function readSchema(
  target: string | ZipHandle,
  dataset: string,
  options?: AtlasReadOptions,
): Promise<DatasetSchemaResult | null>;

interface DatasetSchemaResult {
  path: string;
  schema: unknown;
}
```

Reads the dataset's archived JSON Schema. When the dataset's manifest entry has `schema`, `schema_uri`, or `schemaUri`, that path is used with any fragment stripped. Otherwise a string at `manifest.schemas[dataset]` is used. `schemas/<dataset>.v1.schema.json` is the next candidate. The first of those entries that exists is returned. Returns `null` when none exist.

---

## `statBlob(target, blobRef, options?) → Promise<BlobStat>`

```ts
function statBlob(
  target: string | ZipHandle,
  blobRef: string,
  options?: AtlasReadOptions,
): Promise<BlobStat>;

interface BlobStat {
  path: string;            // normalized archive path, blobs/sha256/<2>/<2>/<hash>.zst
  exists: boolean;
  compressedBytes: number; // ZIP central-directory compressed size; 0 when absent
  storedBytes: number;     // stored payload size; 0 when absent. Not the inflated size.
}
```

Returns size metadata and does not inflate the blob. `blobRef` must be a non-empty string. It accepts the same spellings as `getBlob`: `sha256/<2>/<2>/<64 hex>` and `blobs/sha256/<2>/<2>/<64 hex>.zst`, including the same path with only the `blobs/` prefix or only the `.zst` suffix. The two shard directories must match the hash. An empty ref throws `Error`. Any other string throws `AtlasPathError`.

---

## Types

Record types (`PageRecord`, `AssetRecord`, `ResponseRecordV1`, …) come from `@caifrazier/atls-spec`. The
authoritative field reference is the [Atlas dataset reference](https://github.com/CaiFrazier/atls/blob/main/packages/atls-spec/docs/datasets.md).

---

_Last verified against `packages/atls-sdk/src/`: 2026-11-10._
