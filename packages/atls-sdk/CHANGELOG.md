# Changelog

## 26.11.2

Not on npm. First date-based package version, in lockstep with `@caifrazier/atls-spec@26.11.2`. A weekly tag attaches both package tarballs to a GitHub Release. The spec contract stays `1.3.0`. The schema tag stays `2026-09-04`. Archive format stamps are unchanged.

A later build in the same week is a lettered hotfix (`26.11.2-b`, then `26.11.2-c`) and is not released. Only the weekly tag creates a GitHub Release. See [Versioning](../../docs/VERSIONING.md).

## 1.3.1

Never released. Counter-based package version `1.3.1`. There is no git tag for it. The spec contract stays `1.3.0`. The schema tag stays `2026-09-04`.

- `validate()` enforces the spec 1.2 writer rules when `atlasVersion` is 1.2 or later. Archives stamped 1.1 or earlier keep the previous checks.
- `readDatasetSlice` accepts `maxBytes` (default 16 MiB). A slice stops before a row that would pass the cap and returns a cursor for that row. One row larger than the cap throws `AtlasResourceLimitError`. `limit` must be a positive integer and is still capped at 10,000.
- Slice cursors require safe non-negative integers for `part`, `line`, and `ordinal`.
- `validate({ maxIssues })` requires a positive integer.
- `describeArchive` does not report `meta/`, `schemas/`, or `blobs/` as unexpected datasets.
- `readSchema` uses `manifest.schemas` when the dataset entry does not name a schema path.
- `INTEGRITY_DEPRECATED_FIELD`: `integrity.archiveSha256` or `integrity.auditHash` is present.
- `CONTENT_SHA256_LOCALE_ORDER`: `integrity.contentSha256` matches `en-US` or `th` `localeCompare` path order and not UTF-8 byte order.
- `LEGACY_BLOB_REF`: a record uses `blobs/sha256/<2>/<2>/<hash>.zst`. `getBlob`, `readBlob`, and `statBlob` still resolve that spelling.
- `TRAILING_SLASH_DECLARATION`: more than one trailing-slash declaration, any declaration other than `urlNormalization.trailing_slash`, or a value that conflicts with `append-unless-file`.
- `ASSET_ID_MISMATCH`: `assetId` is not `assetId(assetUrl)`, the UUID v5 of `normalizeUrl(assetUrl)`.

## 1.3.0

Never released. This counter-based package version used the same number as spec contract `1.3.0`. There is no git tag for it. The schema tag stays `2026-09-04`.

- `readers.robots()` reads the optional spec 1.3 `robots` dataset. `RobotsRecord` is exported.
- `validate()` checks robots records, canonical `bodyBlobRef` resolution, `blockedNoCopy` against `manifest.robotsPolicy.failClosed`, duplicate origins, and the `endReason` / `completionReason` map when both are present.
- Re-exports `serializedOrigin` and `completionReasonForEndReason`.
- 1.1 and 1.2 archives still validate. A 1.2 reader can read a 1.3 archive that keeps `robotsPolicy.respect` and `robotsPolicy.overridesUsed`, because new keys are optional and `skipReason` stays a string.

## 1.2.0

Never released. This was the first stable package version in the repository, after `1.0.0-rc.1` (2026-07-04). There is no git tag for it. This counter-based package version used the same number as spec contract `1.2.0`. The schema tag stays `2026-09-04`. There was no `1.0.0` or `1.1.0` package.

The package name is `@caifrazier/atls-sdk`. `@atls/sdk` is not an npm package. Change imports from `@atls/sdk` to `@caifrazier/atls-sdk`. The spec package is `@caifrazier/atls-spec` at the same version. `@atls/spec` is not an npm package.

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

Pre-release reader published to npm on 2026-07-04. It predates the current format. It did not include the describe layer, the spec 1.2 helpers, or the exports above.
