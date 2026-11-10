# Changelog

## 1.2.0

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
