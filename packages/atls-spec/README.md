# @caifrazier/atls-spec

Specification package for the Atlas (`.atls`) archive format. It ships the Zod schemas, the generated JSON Schemas, the TypeScript types, and the helpers for URL identity, blob refs, and archive digests.

The schema tag is `2026-09-04`. The spec contract is `1.3.0`. The package version is `1.3.1`. Archives stamped 1.1 and 1.2 stay valid. This package covers 22 datasets. Package 1.3.1 is not published to npm.

Install `@caifrazier/atls-spec`. The name `@atls/spec` is not published on npm.

```bash
npm install @caifrazier/atls-spec
```

Requires Node.js 20 or newer. The package is ESM only.

## Read the spec

The normative text is in this package:

- [SPECIFICATION.md](./SPECIFICATION.md)
- [docs/](./docs/)

The same text is on GitHub: [Atlas format specification](https://github.com/CaiFrazier/atls/blob/main/packages/atls-spec/SPECIFICATION.md).

When the prose and the Zod schemas disagree, the schemas win.

## Use the types and helpers

```ts
import {
  ATLAS_DATASET_KEYS,
  ATLAS_SCHEMA_VERSION,
  ATLAS_SPEC_VERSION,
  ExtractionRecord,
  PageMetadataDatasetRecordV1Schema,
  SitemapUrlRecord,
  assetId,
  contentSha256,
  normalizeUrl,
  screenshotBlobRefs,
  urlKey,
} from "@caifrazier/atls-spec";

console.log(ATLAS_SPEC_VERSION, ATLAS_SCHEMA_VERSION);
console.log(ATLAS_DATASET_KEYS.page_metadata);

const key = urlKey("https://example.com/about");
const id = assetId("https://example.com/a.png");
```

Per-schema modules are available at `@caifrazier/atls-spec/schemas/<file>.js`. Generated JSON Schemas are at `@caifrazier/atls-spec/schemas/<name>.v1.schema.json`.

`normalizeUrl` returns the spec 1.2 identity string, or `null` when the URL is unparseable or longer than 8192 code units. `urlKey` is SHA-256 of that string. `assetId` is UUID v5 of the normalized URL. `contentSha256` rolls part checksums up in UTF-8 path order.

Screenshot refs stay one of two shapes: a plain string, or `{ tiles[].src, totalWidth, totalHeight }`. Those fields are `page_metadata.media.screenshots.desktop`, `page_metadata.media.screenshots.desktopFullPage`, `reconstruction_index.screenshotDesktopBlobRef`, `reconstruction_index.faviconBlobRef`, and `reconstruction_index.bodyBlobRef`. `screenshotBlobRefs()` lists tile `src` values that are blob refs and leaves the spelling unchanged.

## Read and validate an archive

Reading and validation live in [`@caifrazier/atls-sdk`](https://github.com/CaiFrazier/atls/blob/main/packages/atls-sdk/README.md), which depends on this package:

```ts
import { openAtlas, validate } from "@caifrazier/atls-sdk";

const atlas = await openAtlas("./crawl.atls");
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url);
}
atlas.close();

const result = await validate("./crawl.atls");
console.log(result.valid, result.stats.errorsFound);
```

## Conformance suite

The suite is in the [atls repository](https://github.com/CaiFrazier/atls/blob/main/conformance/README.md), not in this tarball. It has small archives plus URL, hash, and spec 1.3 vectors. The reference check is `validate()` from `@caifrazier/atls-sdk`.

```bash
git clone https://github.com/CaiFrazier/atls.git
cd atls
pnpm install
pnpm build
pnpm test
```

`pnpm test` runs the spec tests and the SDK conformance test. To regenerate the archives after a spec change:

```bash
pnpm --filter @caifrazier/atls-spec build
node conformance/generate.mjs
```

## License

Code in this package is Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

The written specification and the JSON Schemas are also available under CC BY 4.0. See [LICENSE-SPEC.md](./LICENSE-SPEC.md).
