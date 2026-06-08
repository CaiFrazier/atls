# @atls/sdk

TypeScript SDK for reading and validating Atlas `.atls` archives.

> ⚠️ **Known compatibility issue — current archives read as empty.**
> The reader methods return **0 records** on archives written with `schemaVersion 2025-10-22`
> (the version the current `@cf/cartographer` writer emits). The SDK's dataset resolution assumes
> a legacy folder layout: `NEWER_FORMAT_FOLDER_MAP` (`src/index.ts:55`) maps canonical names to
> the short folders `pages/`/`edges/`/`failed_pages/`, but the writer's canonical output uses the
> long folders `page_metadata/`/`navigation/`/`pipeline_failures/` (the short names are removed
> legacy). Iteration silently yields nothing rather than erroring.
>
> **Workaround:** read these archives with Python + `zstd` directly (decompress each
> `<dataset>/*.zst` part as NDJSON), or use the low-level `iterateParts()` helper with the
> explicit long folder name. A fix is tracked in the repo bug tracker. Check the archive's schema
> version before relying on the readers:
> ```bash
> python3 -c "import zipfile,json; print(json.loads(zipfile.ZipFile('crawl.atls').read('manifest.json'))['schemaVersion'])"
> ```

## API

> **Full API reference:** [`docs/API.md`](./docs/API.md) — every method, option, and return type.
> The Atlas archive **format** itself is specified in
> [`@cf/atlas-spec`](../atlas-spec/SPECIFICATION.md).

Primary exports:

- `openAtlas(atlsPath, options?)`
- `select(atlsPath, options)`
- `validate(atlsPath, options)`
- `diffManifests` / `formatManifestDiff`, `buildCrossModeIndex`
- Low-level: `readManifest`, `readSummary`, `iterateParts`, `readBlob`, `openZipHandle`
- `MalformedRecordError`

## Quick Example

```ts
import { openAtlas } from '@atls/sdk';

const atlas = await openAtlas('./crawl.atls');

console.log(atlas.manifest.atlasVersion);
console.log([...atlas.datasets]);

for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url);
}

atlas.close();
```

## Reader Surface

`openAtlas()` returns an `AtlasReader` with:

- `manifest`
- `summary`
- `datasets`
- `packs`
- `stats` — `{ corruptedRecordCount }` (incremented when `strict: false`)
- `hasDataset(name)` — returns `true` if the dataset is present in this archive
- `getBlob(ref)` — fetch a content-addressed blob by its `body_blob_ref` string
- `close()`
- `readers.*` — typed async iterables per dataset (see table below)

Source: `src/index.ts`

### `readers` methods

| Method | Return type | Notes |
|---|---|---|
| `navigation()` | `AsyncIterable<Record>` | Link graph edges |
| `pageMetadata()` | `AsyncIterable<FlatPageMetadata>` | On-page SEO signals |
| `content()` | `AsyncIterable<Record>` | Full page text and headings |
| `structuredData()` | `AsyncIterable<Record>` | JSON-LD / microdata / OpenGraph |
| `technology()` | `AsyncIterable<Record>` | Detected tech stack per page |
| `renderState()` | `AsyncIterable<Record>` | Full-mode render state (`full` only) |
| `security()` | `AsyncIterable<Record>` | Security headers and HTTPS posture |
| `performance()` | `AsyncIterable<Record>` | Performance timing (`prerender`/`full`) |
| `pipelineFailures()` | `AsyncIterable<Record>` | Hard crawl failures |
| `pipelineAlerts()` | `AsyncIterable<Record>` | Non-fatal warnings |
| `assets()` | `AsyncIterable<AssetRecord>` | Images, scripts, fonts, stylesheets |
| `events()` | `AsyncIterable<EventRecord>` | Crawl lifecycle events |
| `accessibility()` | `AsyncIterable<AccessibilityRecord>` | WCAG 2.2 audit results |
| `responses()` | `AsyncIterable<ResponseRecordV1>` | HTTP response metadata |
| `resources()` | `AsyncIterable<ResourceRecordV1>` | Resource timing and network requests |
| `dataset<T>(name)` | `AsyncIterable<T>` | Generic accessor for any dataset by key |

Deprecated aliases (still functional, do not use in new code):

| Method | Canonical equivalent |
|---|---|
| `pages()` | `pageMetadata()` |
| `edges()` | `navigation()` |
| `errors()` | `pipelineFailures()` |
| `failedPages()` | `pipelineFailures()` |

## Error Policy for Malformed Records

By default, `openAtlas` operates in **strict mode** (`strict: true`). If a
dataset iterator encounters a record that cannot be parsed (invalid JSON or
schema validation failure), it throws a `MalformedRecordError` with the
`dataset` name and a human-readable `reason`.

To opt into lenient processing, pass `{ strict: false }`. Malformed records are
skipped and counted in `atlas.stats.corruptedRecordCount`, so callers always
know how many records were lost.

```ts
import { openAtlas, MalformedRecordError } from '@atls/sdk';

// Strict (default) — throws on first bad record
try {
  const atlas = await openAtlas('./crawl.atls');
  for await (const page of atlas.readers.pageMetadata()) {
    console.log(page.url);
  }
} catch (err) {
  if (err instanceof MalformedRecordError) {
    console.error(`Bad record in ${err.dataset}: ${err.reason}`);
  }
}

// Lenient — skip bad records, inspect count afterwards
const atlas = await openAtlas('./crawl.atls', { strict: false });
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url);
}
if (atlas.stats.corruptedRecordCount > 0) {
  console.warn(`Skipped ${atlas.stats.corruptedRecordCount} malformed records`);
}
atlas.close();
```

## Validation

```ts
import { validate } from '@atls/sdk';

const result = await validate('./crawl.atls', {
  checkIntegrity: true,
  checkBrokenLinks: true,
  checkManifest: true,
  strict: false,
});

console.log(result.valid, result.stats.errorsFound);
```

Source: `src/validate.ts`

## `select` — Filtered Dataset Streaming

For one-off filtered reads without opening a full `AtlasReader`:

```ts
import { select } from '@atls/sdk';

for await (const record of select('./crawl.atls', {
  dataset: 'accessibility',
  where: (a: any) => a.missingAltCount > 0,
  fields: ['pageUrl', 'missingAltCount'],
  limit: 50,
})) {
  console.log(record);
}
```

`SelectOptions`: `dataset` (required), `where` (filter predicate), `fields` (dot-path projection), `limit`.

## Advanced / Utilities

### Diff two archives

```ts
import { openAtlas, diffManifests, formatManifestDiff } from '@atls/sdk';

const [a, b] = await Promise.all([openAtlas('./before.atls'), openAtlas('./after.atls')]);
const diff = diffManifests(a.manifest, b.manifest);
console.log(formatManifestDiff(diff));   // formatted table
// or: JSON.stringify(diff)              // ManifestDiff object
a.close(); b.close();
```

Exports: `diffManifests`, `formatManifestDiff`, types `ManifestDiff`, `DatasetDelta`, `DiffManifestsOptions`.

### Cross-mode index

```ts
import { buildCrossModeIndex } from '@atls/sdk';
```

Builds a `CrossModeIndex` that aligns records across archives produced in different render modes. Exports: `buildCrossModeIndex`, types `CrossModeIndex`, `CrossModeEntry`.

### Low-level helpers

These bypass `openAtlas` and operate directly on the zip:

| Export | Description |
|---|---|
| `readManifest(zipHandle)` | Read and parse `manifest.json` |
| `readSummary(zipHandle)` | Read and parse `summary.json` |
| `iterateParts(zipHandle, dataset)` | Iterate raw NDJSON lines from compressed dataset parts |
| `readBlob(zipHandle, ref)` | Fetch a blob by content-addressed ref string |
| `openZipHandle(path)` | Open a zip for repeated reads (must call `.close()`) |
| `ZipHandle` | Type for the handle returned by `openZipHandle` |

## Development

```bash
pnpm --filter @atls/sdk build
pnpm --filter @atls/sdk test
pnpm --filter @atls/sdk lint
```

Archived legacy docs are available at `legacy/v1/`.

---

_Last verified against codebase: 2026-06-04._
