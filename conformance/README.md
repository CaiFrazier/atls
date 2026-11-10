# Conformance

Small archives and vectors for Atlas spec 1.2 and spec 1.3. Any implementation can run them. The reference reader is `validate()` from `@caifrazier/atls-sdk`. Spec 1.3 archives are additive. A 1.2 reader still reads `minimal-valid-1.3.atls` when it ignores unknown fields and unknown datasets, and when `robotsPolicy` still carries `respect` and `overridesUsed`.

Regenerate after a spec build:

```bash
pnpm --filter @caifrazier/atls-spec build
node conformance/generate.mjs
```

The committed files are the suite. Do not treat a local edit of an `.atls` as authoritative until you regenerate.

## Archives

Each file is a ZIP (`.atls`) using store mode (ZIP method 0). Part and blob payloads are Zstandard. Verdicts are for `validate(path)` with default options, and for `validate(path, { strict: true })`. `errorCodes` is the complete set of error codes from the default run.

| File | valid | strict | error codes | What it checks |
|---|---|---|---|---|
| `archives/minimal-valid-1.1.atls` | yes | yes | none | A 1.1 archive. `specVersion` and `formatVersion` are `1.1.0`. `archiveSha256` and `auditHash` are present and must be ignored. `contentSha256` matches UTF-8 byte order, which equals `en-US` `localeCompare` for these lowercase paths. |
| `archives/minimal-valid-1.2.atls` | yes | yes | none | A 1.2 archive. No `archiveSha256` or `auditHash`. `urlNormalization.trailing_slash` is `append-unless-file`. `hashing.urlKeyAlgo` is `sha256`. The blob reference uses `sha256/<2>/<2>/<hash>`. |
| `archives/legacy-blob-ref.atls` | no | no | `LEGACY_BLOB_REF` | Same as the 1.2 archive, except `responses.bodyBlobRef` is `blobs/sha256/<2>/<2>/<hash>.zst`. `getBlob()` still reads that ref. `validate()` rejects it because `atlasVersion` is 1.2. |
| `archives/legacy-blob-ref-1.1.atls` | yes | yes | none | A 1.1 archive whose `responses.bodyBlobRef` uses the legacy spelling. `getBlob()` reads that opaque string and returns the blob bytes. |
| `archives/corrupted-part-checksum.atls` | no | no | `PART_CHECKSUM_MISMATCH` | `integrity.files` for `page_metadata/part-001.jsonl.zst` is not the SHA-256 of the stored part bytes. `contentSha256` still matches the real checksums. |
| `archives/bad-content-sha256.atls` | no | no | `CONTENT_SHA256_MISMATCH` | Every part checksum matches the stored bytes. `contentSha256` does not match the UTF-8 path-order rollup. |
| `archives/corrupted-blob.atls` | no | no | `BLOB_HASH_MISMATCH` | The blob frame decompresses. SHA-256 of those bytes is not the hash in the path. |
| `archives/missing-required-dataset.atls` | no | no | `MANIFEST_MISSING_PARTS` | The manifest does not declare `page_metadata`. The `responses` part and its checksums are valid. This is not a failure of the presence-by-mode matrix. |
| `archives/minimal-valid-1.3.atls` | yes | yes | none | A 1.3 archive. One robots row for each `fetchStatus` and each `bodySource`, including a punycode origin and a `blockedNoCopy` row whose `robotsPolicy.failClosed` is true. `endReason` `complete` maps to `completionReason` `finished`. `frontier_ledger.skipReason` uses `ROBOTS_DISALLOWED` and `ROBOTS_UNREACHABLE` as strings. `respect` and `overridesUsed` are present so a 1.2 reader can parse `robotsPolicy`. |
| `archives/robots-blocked-no-copy.atls` | no | no | `ROBOTS_BLOCKED_NO_COPY` | `blockedNoCopy` is true and `manifest.robotsPolicy.failClosed` is false. |
| `archives/robots-duplicate-origin.atls` | no | no | `ROBOTS_DUPLICATE_ORIGIN` | Two robots rows share one origin. |
| `archives/robots-missing-blob.atls` | no | no | `BLOB_NOT_FOUND` | `robots.bodyBlobRef` is canonical and does not resolve. |
| `archives/end-reason-mismatch.atls` | no | no | `END_REASON_MISMATCH` | `endReason` is `pageCap` and `completionReason` is `finished`. The map requires `capped`. |
| `archives/writer-deprecated-digest-1.2.atls` | no | no | `INTEGRITY_DEPRECATED_FIELD` | A 1.2 stamp with `integrity.archiveSha256` and `integrity.auditHash` present. |
| `archives/writer-locale-order-1.2.atls` | no | no | `CONTENT_SHA256_LOCALE_ORDER` | A 1.2 stamp whose `contentSha256` matches `th` `localeCompare` order and not UTF-8 byte order. |
| `archives/writer-legacy-blob-ref-1.2.atls` | no | no | `DATASET_SCHEMA_VIOLATION`, `LEGACY_BLOB_REF` | A 1.2 stamp with the legacy blob spelling on page screenshots, a tile `src`, `responses.bodyBlobRef`, reconstruction screenshot, favicon, and body refs, and `robots.bodyBlobRef`. The robots schema also rejects that spelling. |
| `archives/writer-trailing-slash-1.2.atls` | no | no | `TRAILING_SLASH_DECLARATION` | A 1.2 stamp with `urlNormalization.trailing_slash` plus `remove_trailing_slash`, `trailing_slash_policy`, `urlNormalizationRules`, and `compareCompatibility.removeTrailingSlash`. |
| `archives/writer-asset-id-1.2.atls` | no | no | `ASSET_ID_MISMATCH` | A 1.2 stamp whose `assetId` is the UUID v5 of the raw asset URL, not of `normalizeUrl(assetUrl)`. |

`page_metadata` is the one dataset the manifest must declare (`datasets.page_metadata` or a non-empty `parts.page_metadata`). It may contain zero records. Other datasets may be absent. The raw / prerender / full matrix is producer guidance, not a validity rule.

## How to check an archive

1. Open the ZIP.
2. Read `manifest.json`.
3. For each dataset part (`<long-or-alias-directory>/<file>.jsonl` or `.jsonl.zst`), SHA-256 the ZIP entry payload. That is the bytes a ZIP reader returns after undoing ZIP deflate. Do not Zstandard-decompress the part, and do not compress it again.
4. Compare each digest with `integrity.files` and, when present, `datasets.<name>.integrity.checksums`.
5. Compute `contentSha256` as in [storage-and-encoding.md](../packages/atls-spec/docs/storage-and-encoding.md). When `atlasVersion` is 1.2 or later, the digest must match UTF-8 byte order. A digest that matches only `en-US` or `th` `localeCompare` order is `CONTENT_SHA256_LOCALE_ORDER`. A 1.1 stamp also accepts those locale orders. On a 1.2 or later stamp, `archiveSha256` and `auditHash` must be absent (`INTEGRITY_DEPRECATED_FIELD`). On a 1.1 stamp, ignore them.
6. For each `blobs/sha256/<2>/<2>/<64 hex>.zst`, decompress with any Zstandard decoder, SHA-256 the uncompressed bytes, and compare to the hash in the path. Readers accept a record reference written as `sha256/<2>/<2>/<hash>` or `blobs/sha256/<2>/<2>/<hash>.zst`. `validate()` reports `LEGACY_BLOB_REF` for the second spelling when `atlasVersion` is 1.2 or later. A 1.1 stamp still accepts it. On that same 1.2 or later stamp, reject any trailing-slash declaration other than `urlNormalization.trailing_slash` set to `append-unless-file`, and require each `assetId` to be the UUID v5 of `normalizeUrl(assetUrl)`.
7. Require a `page_metadata` declaration.

`skipBlobVerification: true` on the reference `validate()` skips step 6 only.

## Vectors

`vectors/spec-1.3.json` holds origin cases (`robotsUrl`, `normalized`, `origin`), the `endReason` map, and the note that `skipReason` stays a string. `origin` must equal `serializedOrigin(robotsUrl)`.

`vectors/url-and-hashes.json` holds:

- `urlNormalization`: each input, the spec 1.2 `normalized` string, the spec 1.2 `urlKey` (SHA-256), the 1.1 writer string, and the 1.1 SHA-1 key. `differsFromWriter11` is true when the normalized string changed. Every `urlKey` differs from `writer11UrlKeySha1` because 1.1 used SHA-1 and did not store the key. The string changes are `.htaccess` (no added slash), stripped userinfo, query values sorted, and `not a url` (null, not hashed).
- `overlong`: a URL longer than 8192 code units is not eligible. Build the input in the test. It is not inlined.
- `hashes`: empty and `hello` SHA-256, the 1.1/1.2 `contentSha256` examples for lowercase paths, the mixed-case order split, the `th` locale split for `sitemap_urls` versus `sitemaps`, provenance rollups, `datasetId`, `crawlConfigHash`, and the asset-id change for a trailing slash.
- `fileExtensions`: the spec 1.2 allowlist.
- `notIdentity`: a reminder that the parameter blocklist and `www` folding are not `normalizeUrl`.

An implementation passes the vector file when `normalizeUrl` and `urlKey` return the `normalized` and `urlKey` fields, and when an overlong URL and `not a url` produce no key.
