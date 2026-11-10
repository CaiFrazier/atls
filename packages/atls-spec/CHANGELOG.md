# Changelog

## 26.11.2

Not published. First date-based package release (`YY.M.W` for November 10, 2026). The spec contract stays `1.3.0`. `atlasVersion` stays `1.3`. `formatVersion` stays `1.3.0`. The schema tag stays `2026-09-04`.

`1.2.0`, `1.3.0`, and `1.3.1` were the last counter-based package versions. A package release says when the tooling shipped. The format version says what an archive may contain and moves only when the format changes. Within 1.x those changes stay additive.

A later build in the same week is a lettered hotfix (`26.11.2-b`, then `26.11.2-c`). The weekly release is implicitly `a`. Only the weekly release is published, on npm `latest`. A hotfix is not published. See [Versioning](../../docs/VERSIONING.md).

## 1.3.1

Not published. Counter-based package version `1.3.1`. The spec contract stays `1.3.0`. The schema tag stays `2026-09-04`.

- A writer that emits the `robots` dataset must settle each origin's robots outcome, retries included, before fetching that origin's first page, and must use that copy for the rest of the crawl. The dataset has one row per origin.
- `frontier_ledger.matchedRobotsRule` stays a string. The recommended form is `<Directive>: <pattern>`, for example `Disallow: /cart`.
- The meanings of `robotsPolicy.mode`, `modeSource`, and `failClosed`, and of the applied-body digest, stay stable across 1.3.x. The applied-body digest is the `bodyBlobRef` hash when that ref stores the applied body. When `bodySource` is `lastGood`, that stored body is the last-good copy. `lastGoodBodySha256` is a last-good digest that is not the stored body. A null `bodyBlobRef` means no body was stored, independent of `fetchStatus`.
- `validate()` enforces the spec 1.2 writer rules when `atlasVersion` is 1.2 or later. Archives stamped 1.1 or earlier stay on the previous checks.

## 1.3.0

Not published. This counter-based package version used the same number as spec contract `1.3.0`. The schema tag stays `2026-09-04`. Archives stamped 1.1 and 1.2 stay valid. Every new field and the `robots` dataset are optional. A writer stamps `atlasVersion` `1.3`, `formatVersion` `1.3.0`, and `specVersion` `1.3.0` only when the archive emits a spec 1.3 field.

### Format

- Optional `robots` dataset, one row per origin. `origin` is the serialized origin of `normalizeUrl(robotsUrl)`. `responses429` and `responses5xx` count page responses from that origin, not robots.txt fetches. Null means not measured. 0 means measured and zero.
- `manifest.robotsPolicy` gains optional `mode`, `modeSource`, `failClosed`, `retryAttempts`, and `keepLastGood`. The pre-1.3 keys `respect`, `overridesUsed`, and `overrideReason` stay. `capabilities.robots` is unchanged.
- `frontier_ledger.skipReason` stays an open string. `ROBOTS_DISALLOWED` and `ROBOTS_UNREACHABLE` are spellings, not new enum values. Optional `skipSource` (`page`, `scout`, `sitemap`, `warmup`) and optional `matchedRobotsRule` (the matched Disallow pattern, or null).
- `summary.crawlContext.endReason` is optional and maps onto the unchanged required `completionReason`. Optional `skippedByReason` uses null for unmeasured and 0 for measured zero.
- `validate()` checks robots blob refs, `blockedNoCopy` against `robotsPolicy.failClosed`, one robots row per origin, and the `endReason` map when both fields are present.

## 1.2.0

Published to npm as `@caifrazier/atls-spec@1.2.0`. This replaces `1.0.0-rc.1` (2026-07-04). This counter-based package version used the same number as the spec contract. The schema tag stays `2026-09-04`. There was no `1.0.0` or `1.1.0` package on npm.

Install `@caifrazier/atls-spec`. `@atls/spec` is not published. The reader package is `@caifrazier/atls-sdk`. `@atls/sdk` is not published. Change those imports before you depend on the registry instead of a local checkout.

### Package surface since 1.0.0-rc.1

- `ATLAS_DATASET_KEYS` and `AtlasDatasetKey`.
- `ExtractionRecord` and `SitemapUrlRecord`.
- `normalizeUrl`, `urlKey`, `assetId`, `contentSha256`, `parseBlobRef`, and `screenshotBlobRefs`.
- `ATLAS_SCHEMA_VERSION` (`2026-09-04`), `ATLAS_SPEC_VERSION` (`1.2.0`), `ATLAS_FORMAT_VERSION`, and `ATLAS_VERSION`.
- Structured-data audit types, redirect rows on `responses` (`isRedirect`, `location`, `redirectType`, no body), and the shared dataset registry.
- Screenshot refs stay a plain string or `{ tiles[].src, totalWidth, totalHeight }` at `page_metadata.media.screenshots.desktop`, `desktopFullPage`, `reconstruction_index.screenshotDesktopBlobRef`, `faviconBlobRef`, and `bodyBlobRef`.
- Blob refs accept `sha256/<2>/<2>/<hash>` and `blobs/sha256/<2>/<2>/<hash>.zst`.

### Format

Spec 1.2 makes archive integrity, blob identity, URL identity, and record ids normative. The schema tag stays `2026-09-04`. Record field names do not change. Archives stamped 1.1 stay valid.

### Integrity

- `integrity.contentSha256` is the archive digest: SHA-256 of the concatenated lowercase-hex part checksums, paths in UTF-8 byte order.
- A part checksum is SHA-256 of the ZIP entry payload (the stored Zstandard frame, or the raw JSONL). Readers hash those bytes. They do not recompress.
- `contentSha256` does not cover blobs, schema files, `manifest.json`, `summary.json`, or provenance. Blob integrity is per blob.
- `archiveSha256` and `auditHash` are deprecated. Writers omit them. Readers ignore them.
- 1.1 readers accept a `contentSha256` from UTF-8 byte order, from `en-US` `localeCompare`, or from `th` `localeCompare`. See the storage chapter for when those orders differ.

### Blobs

- The blob id is SHA-256 of the uncompressed bytes.
- The entry is `blobs/sha256/<2>/<2>/<hash>.zst`, Zstandard at any level.
- Records use `sha256/<2>/<2>/<hash>`. Readers also accept `blobs/sha256/<2>/<2>/<hash>.zst`.
- Verification decompresses, then hashes, then compares to the hash in the path.

### URL identity

- One `normalizeUrl`, and `urlKey` as SHA-256 of that string. Unparseable or overlong URLs (more than 8192 code units) have no key.
- Fixes relative to the 1.1 writer: strip userinfo, sort query values as well as names, and test the full last segment so `.htaccess` and `.tar.gz` match the allowlist.
- The parameter blocklist and `www` folding are crawl policy, not identity.
- `urlNormalization.trailing_slash` = `append-unless-file` is the one slash declaration. Older slash fields are informational.
- `page_metadata.url` is the final URL. `responses.url` is the requested URL. A redirect row has `isRedirect: true` and no body.

### Ids

- `pageId` is UUID v7, crawl-local.
- `assetId` is UUID v5 in the RFC 4122 URL namespace of the normalized asset URL. Spec 1.1 hashed the raw URL.
- `resId` is UUID v4.
- `crawlId` is an opaque string. New writers should use UUID v7.
- `datasetId` is the 16-hex digest defined in the identity chapter.
- Schemas still accept other UUID versions, so 1.1 archives validate.

### Other decisions

- 1.x keeps existing snake_case keys. Camel case is the 2.0 target. No on-disk casing change in 1.2.
- Readers ignore unknown fields. Schema strictness is validation tooling only.
- Short directory names are a reader fallback. Writers use the long registry names.
- The presence-by-mode matrix stays producer guidance. The manifest must declare `page_metadata`.

## 1.1.0

Container and spec contract carried by archives before 1.2. `contentSha256`, when present, was computed with `localeCompare` in the process locale. For the lowercase paths those writers emit, `en-US` matches UTF-8 byte order. `urlKey` was SHA-1 and was not stored. `assetId` hashed the raw URL. `archiveSha256` and `auditHash` were not written by the sealed manifest.
