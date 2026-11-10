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

## Blobs

`getBlob` is a method on the reader from `openAtlas`. Record fields that hold a blob ref are camelCase, for example `bodyBlobRef`. The argument accepts `sha256/<2>/<2>/<64 hex>` and `blobs/sha256/<2>/<2>/<64 hex>.zst`, including the same path with only the `blobs/` prefix or only the `.zst` suffix.

```ts
for await (const response of atlas.readers.responses()) {
  if (response.bodyBlobRef) {
    const bytes = await atlas.getBlob(response.bodyBlobRef); // Promise<Buffer>
    console.log(bytes.byteLength);
  }
}
```

## Describe, schema, and blob stat

`describeArchive`, `readSchema`, and `statBlob` are package exports. Each takes an archive path or an open `ZipHandle`. The optional last argument is `AtlasReadOptions` (`limits`).

```ts
import { describeArchive, readSchema, statBlob } from '@caifrazier/atls-sdk';

// describeArchive(target, options?) => Promise<ArchiveDescription>
// Joins the manifest to ZIP central-directory facts. Does not scan rows or inflate blobs.
const description = await describeArchive('./crawl.atls');
console.log(description.atlasVersion, description.datasets.map((dataset) => dataset.name));

// readSchema(target, dataset, options?) => Promise<DatasetSchemaResult | null>
// Resolution: the dataset's manifest schema path, then manifest.schemas,
// then schemas/<dataset>.v1.schema.json. Null when the archive has no schema.
const schema = await readSchema('./crawl.atls', 'page_metadata');

// statBlob(target, blobRef, options?) => Promise<BlobStat>
// path, exists, compressedBytes, storedBytes. Does not inflate the blob.
// Accepts the same blob-ref spellings as getBlob.
const stat = await statBlob('./crawl.atls', 'sha256/ab/ab/' + 'ab'.repeat(32));
console.log(schema?.path, stat.exists, stat.storedBytes);
```

## Close

```ts
atlas.close();
```

---

_Last verified against `packages/atls-sdk/src/index.ts`: 2026-11-10._
