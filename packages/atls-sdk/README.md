# @caifrazier/atls-sdk

Read and validate Atlas (`.atls`) archives. An `.atls` file is a ZIP of Zstandard-compressed JSON Lines datasets plus content-addressed blobs.

Install `@caifrazier/atls-sdk`. The name `@atls/sdk` is not published on npm. If an import still says `@atls/sdk`, change it to `@caifrazier/atls-sdk`.

```bash
npm install @caifrazier/atls-sdk
```

Requires Node.js 20 or newer. The package is ESM only. It depends on `@caifrazier/atls-spec` at the same version.

The format spec is [`@caifrazier/atls-spec`](https://github.com/CaiFrazier/atls/blob/main/packages/atls-spec/SPECIFICATION.md). Current schema tag: `2026-09-04`. Spec contract: `1.3.0`. Format stamps: `atlasVersion` `1.3`, `formatVersion` `1.3.0`. Package release: `26.11.2`, not published to npm. The package release is the date the tooling shipped. It is separate from those stamps. Archives stamped 1.1 and 1.2 stay readable. `validate()` enforces the 1.2 writer rules when `atlasVersion` is 1.2 or later. See [Versioning](../../docs/VERSIONING.md).

## Read an archive

```ts
import { openAtlas } from "@caifrazier/atls-sdk";

const atlas = await openAtlas("./crawl.atls");
try {
  console.log(atlas.manifest.atlasVersion);
  console.log([...atlas.datasets]);

  for await (const page of atlas.readers.pageMetadata()) {
    console.log(page.url);
  }
} finally {
  atlas.close();
}
```

`openAtlas` is strict by default. A record that is not valid JSON, or that fails the schema for `assets`, `responses`, or `resources`, throws `MalformedRecordError`. Pass `{ strict: false }` to skip those records and count them on `atlas.stats.corruptedRecordCount`.

Dataset readers include `pageMetadata()`, `navigation()`, `responses()`, `sitemapUrls()` (`SitemapUrlRecord`), `extraction()` (`ExtractionRecord`), and `robots()` (`RobotsRecord`, spec 1.3, one row per origin). `ATLAS_DATASET_KEYS` is the full registry of directory names.

## Resolve a blob

`getBlob`, `readBlob`, and `statBlob` take the ref as an opaque string. Both spellings resolve to the same ZIP entry:

- canonical: `sha256/<2>/<2>/<64 hex>`
- legacy: `blobs/sha256/<2>/<2>/<64 hex>.zst`

```ts
import { openAtlas } from "@caifrazier/atls-sdk";

const atlas = await openAtlas("./crawl.atls");
try {
  for await (const response of atlas.readers.responses()) {
    if (response.bodyBlobRef) {
      const html = await atlas.getBlob(response.bodyBlobRef);
      console.log(html.byteLength);
    }
  }
} finally {
  atlas.close();
}
```

## Screenshot refs

Do not reshape screenshot refs. Both of these stay valid:

- a plain string
- `{ tiles: [{ src, height, width, y }], totalWidth, totalHeight }`

They live at `page_metadata.media.screenshots.desktop`, `page_metadata.media.screenshots.desktopFullPage`, `reconstruction_index.screenshotDesktopBlobRef`, `reconstruction_index.faviconBlobRef`, and `reconstruction_index.bodyBlobRef`.

If a tile `src` is a blob ref, pass that string to `getBlob`. Both spellings work. `screenshotBlobRefs()` collects those strings and skips live URLs.

## Validate an archive

```ts
import { validate } from "@caifrazier/atls-sdk";

const result = await validate("./crawl.atls", {
  checkIntegrity: true,
  checkBrokenLinks: true,
  checkManifest: true,
});

console.log(result.valid, result.stats.errorsFound);
for (const issue of result.issues) {
  console.log(issue.severity, issue.code, issue.message);
}
```

`validate()` checks part checksums, `integrity.contentSha256`, and blob hashes. `skipBlobVerification: true` skips blob hashes only. When `atlasVersion` is 1.2 or later it also rejects `archiveSha256` and `auditHash` (`INTEGRITY_DEPRECATED_FIELD`), a `contentSha256` that matches only `en-US` or `th` `localeCompare` order (`CONTENT_SHA256_LOCALE_ORDER`), the legacy blob spelling (`LEGACY_BLOB_REF`), extra or conflicting trailing-slash declarations (`TRAILING_SLASH_DECLARATION`), and an `assetId` that is not `assetId(assetUrl)` (`ASSET_ID_MISMATCH`). Archives stamped 1.1 or earlier keep the previous checks. `getBlob`, `readBlob`, and `statBlob` still resolve the legacy spelling.

`validate({ strict: true })` also requires manifest fields and accepts either blob-ref spelling. That `strict` flag is not the same as `openAtlas({ strict })`.

## Describe an archive

```ts
import { describeArchive, describeDataset } from "@caifrazier/atls-sdk";

const description = await describeArchive("./crawl.atls");
console.log(description.schemaVersion, description.datasets.map((dataset) => dataset.name));
```

`describeArchive`, `describeDataset`, `readDatasetSlice`, `readRecord`, `readSchema`, and `statBlob` return plain data.

## URL identity and digests

These spec 1.2 helpers are re-exported:

```ts
import { assetId, contentSha256, normalizeUrl, urlKey } from "@caifrazier/atls-sdk";
```

## Conformance suite

The suite lives in the [atls repository](https://github.com/CaiFrazier/atls/blob/main/conformance/README.md). Clone it and run the tests. `legacy-blob-ref-1.1.atls` is a 1.1 archive whose `bodyBlobRef` uses the legacy spelling. The SDK test reads that ref with `getBlob()`.

```bash
git clone https://github.com/CaiFrazier/atls.git
cd atls
pnpm install
pnpm build
pnpm test
```

## More detail

[QUICK_REFERENCE.md](./QUICK_REFERENCE.md) and [docs/API.md](./docs/API.md) list the reader methods and options.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
