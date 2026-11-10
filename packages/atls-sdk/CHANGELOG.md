# Changelog

## 1.2.0

First stable release. Replaces `1.0.0-rc.1` (2026-07-04). The npm version matches spec contract `1.2.0`. The schema tag stays `2026-09-04`. There was no `1.0.0` or `1.1.0` package on npm.

Install `@caifrazier/atls-sdk`. `@atls/sdk` is not published. Change imports from `@atls/sdk` to `@caifrazier/atls-sdk`. The spec package is `@caifrazier/atls-spec` at the same version. `@atls/spec` is not published.

### Since 1.0.0-rc.1

- `openAtlas`, `select`, and `validate` read the nested `page_metadata` record and flatten it for `pageMetadata()`.
- Typed read errors: `MalformedRecordError`, `AtlasPathError`, `AtlasResourceLimitError`, `AtlasEntryNotFoundError`, `AtlasDecompressionError`, `AtlasUnknownDatasetError`, `AtlasMissingFormatVersionError`, `AtlasUnsupportedFormatVersionError`.
- `checkCompatible` and `assertCompatible` read `capabilities.compatibility.minSdkVersion`. `openAtlas` warns. It does not refuse the archive.
- Describe layer: `describeArchive`, `describeDataset`, `readDatasetSlice`, `readRecord`, `readSchema`, `statBlob`, and their types (`ArchiveDescription`, `DatasetDescription`, `DatasetSlice`, `BlobStat`, and the rest).
- `validate()` checks part checksums, `contentSha256`, and blob hashes. `skipBlobVerification` skips blob hashes. `archiveSha256` and `auditHash` are ignored. A 1.1 digest may match UTF-8 byte order, `en-US` `localeCompare`, or `th` `localeCompare`. A 1.2 digest must match byte order.
- Re-exports `normalizeUrl`, `urlKey`, `assetId`, `contentSha256`, `ATLAS_DATASET_KEYS`, `ExtractionRecord`, and `SitemapUrlRecord`.
- `getBlob`, `readBlob`, and `statBlob` resolve both `sha256/<2>/<2>/<hash>` and `blobs/sha256/<2>/<2>/<hash>.zst`.
- Screenshot refs stay a plain string or `{ tiles[].src, totalWidth, totalHeight }` at `page_metadata.media.screenshots.desktop`, `desktopFullPage`, and at `reconstruction_index.screenshotDesktopBlobRef`, `faviconBlobRef`, and `bodyBlobRef`. Tile `src` blob refs use the same two spellings.
- Conformance archives, including a 1.1 archive with a legacy blob ref.

## 1.0.0-rc.1

Pre-release reader published on 2026-07-04. It did not include the describe layer, the spec 1.2 helpers, or the exports above.
