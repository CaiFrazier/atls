# Atlas SDK Quick Reference


## Import

```ts
import { openAtlas, select, validate, MalformedRecordError } from '@caifrazier/atls-sdk';
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

for await (const navigation of atlas.readers.navigation()) {
  for (const edge of navigation.edges) console.log(navigation.sourceUrl, edge.targetUrl);
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
// status codes live in the `responses` dataset, not page_metadata
for await (const row of select('./crawl.atls', {
  dataset: 'responses',
  where: (r) => r.statusCode >= 400,
  fields: ['url', 'statusCode'],
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
  skipBlobVerification: false,
});

console.log(result.valid);
console.log(result.stats.errorsFound, result.stats.warningsFound);
```

## Close

```ts
atlas.close();
```

---

_Last verified against codebase: 2026-07-06._
