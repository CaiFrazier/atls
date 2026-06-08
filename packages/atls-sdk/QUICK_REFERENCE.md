# Atlas SDK Quick Reference

> ⚠️ **Readers return 0 records on `schemaVersion 2025-10-22` archives** (what the current
> Cartographer writer emits) — the SDK assumes a removed legacy folder layout (`pages/`/`edges/`)
> instead of the canonical `page_metadata/`/`navigation/`. Use Python + `zstd` directly or the
> low-level `iterateParts()` helper until the fix lands. See the README for details and a schema
> version check.

## Import

```ts
import { openAtlas, select, validate, MalformedRecordError } from '@atls/sdk';
```

## Open Archive

```ts
// strict (default) — throws MalformedRecordError on bad records
const atlas = await openAtlas('./crawl.atls');

// lenient — skips bad records, tracks count in atlas.stats
const lenient = await openAtlas('./crawl.atls', { strict: false });
console.log(lenient.stats.corruptedRecordCount);
```

## Read Datasets

```ts
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url);
}

for await (const edge of atlas.readers.navigation()) {
  console.log(edge.sourceUrl, edge.targetUrl);
}
```

## Generic Dataset Reader

```ts
for await (const record of atlas.readers.dataset('events')) {
  console.log(record);
}
```

## Select Helper

```ts
// status codes live in the `responses` dataset (snake_case fields), not page_metadata
for await (const row of select('./crawl.atls', {
  dataset: 'responses',
  where: (r) => r.status_code >= 400,
  fields: ['url', 'status_code'],
  limit: 100,
})) {
  console.log(row);
}
```

## Validate Archive

```ts
const result = await validate('./crawl.atls', {
  checkIntegrity: true,
  checkBrokenLinks: true,
  checkManifest: true,
  strict: false,
});

console.log(result.valid);
console.log(result.stats.errorsFound, result.stats.warningsFound);
```

## Close

```ts
atlas.close();
```

---

_Last verified against codebase: 2026-06-04._
