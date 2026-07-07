# Atlas SDK — API Reference

Complete reference for `@caifrazier/atls-sdk`, the read-side SDK for `.atls` archives.

_Verified against `packages/atls-sdk/src/` on 2026-07-01._

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
| `getBlob(ref)` | `(string) => Promise<Buffer>` | Resolve a `*_blob_ref` to bytes. |
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
  checkIntegrity?: boolean;   // default true — edges/assets reference valid pages
  checkBrokenLinks?: boolean; // default true — internal edges to 4xx/5xx → warnings
  checkManifest?: boolean;    // default true — manifest vs actual data
  maxIssues?: number;         // default 1000 — stop collecting after N
  errorsOnly?: boolean;       // default false — skip warnings
  strict?: boolean;           // default false — enforce spec-level manifest requirements
}

interface ValidationResult {
  valid: boolean;
  issues: { severity: "error" | "warning"; code: string; message: string;
            dataset?: string; record?: any; details?: object }[];
  stats: {
    pageMetadataChecked: number; navigationEdgesChecked: number; assetsChecked: number;
    contentChecked: number; structuredDataChecked: number; technologyChecked: number;
    renderStateChecked: number; performanceChecked: number; securityChecked: number;
    responsesChecked: number; resourcesChecked: number; sitemapsChecked: number;
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

> `assets` is schema-validated against `assets.v1`. `quarantine` has a published schema but is not
> re-validated (it holds records that already failed validation). See the
> [Atlas schema-system chapter](../../atls-spec/docs/schema-system.md).

---

## `diffManifests(a, b, options?)` / `formatManifestDiff(diff)`

Compare two archives by their manifests (pure data, no I/O):

```ts
const [a, b] = await Promise.all([openAtlas("./before.atls"), openAtlas("./after.atls")]);
const diff = diffManifests(a.manifest, b.manifest);
console.log(formatManifestDiff(diff));   // formatted table
a.close(); b.close();
```

Exports the `ManifestDiff`, `DatasetDelta`, and `DiffManifestsOptions` types. Note: `diff` compares
a fixed set of canonical datasets and may not reflect newer datasets — read the diff output as
indicative, not exhaustive.

---

## `buildCrossModeIndex(readers) → Promise<CrossModeIndex>`

Aligns records across archives crawled in different render modes, keyed by URL (since `pageId` is
not stable across crawls). Requires ≥2 readers; resolves each reader's mode from its `specLevel`.
Exports `CrossModeIndex` and `CrossModeEntry`.

---

## Low-level helpers

These bypass `openAtlas` and operate on the zip directly. **`iterateParts` works on current
archives today** when given the long folder name — it sidesteps the broken folder resolution.

| Export | Signature | Notes |
|---|---|---|
| `openZipHandle(path)` | `=> ZipHandle` | Open a zip for repeated reads; call `.close()`. |
| `readManifest(zipHandle)` | `=> AtlasManifest` | Parse `manifest.json`. |
| `readSummary(zipHandle)` | `=> AtlasSummary` | Parse `summary.json`. |
| `iterateParts(path, dataset)` | `=> AsyncIterable<string>` | Raw NDJSON lines from a dataset's parts. Pass the **long** name (`page_metadata`). |
| `readBlob(zipHandle, ref)` | `=> Promise<Buffer>` | Resolve a blob ref. |

```ts
// Works on current 2026-07-01 archives:
for await (const line of iterateParts("./crawl.atls", "page_metadata")) {
  const rec = JSON.parse(line);
  console.log(rec.pageId, rec.url);
}
```

Decompression uses `@mongodb-js/zstd`.

---

## Types

Record types (`PageRecord`, `AssetRecord`, `ResponseRecordV1`, …) come from `@caifrazier/atls-spec`. The
authoritative field reference is the [Atlas dataset reference](../../atls-spec/docs/datasets.md).

---

_Last verified against codebase: 2026-07-06._
