# Storage & Encoding

How records and binary payloads are serialized, compressed, and addressed inside an `.atls`
archive.

_Field names below match the Zod schemas. Byte-level procedures are normative as of spec 1.2. Decisions that used to live only in the writer are recorded in [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md)._

---

## Datasets: Zstandard-compressed JSON Lines

Every dataset is a stream of **JSON Lines** (one JSON object per line, UTF-8), split into part
files and compressed with **Zstandard**:

```
<dataset>/part-001.jsonl.zst
<dataset>/part-002.jsonl.zst
```

- Part files are JSON Lines, UTF-8, one JSON object per line. Blank lines are skipped by the
  reference reader.
- A dataset may span many parts. The reference reader lists every `*.jsonl` and `*.jsonl.zst`
  under the dataset prefix and sorts by name. It does not require a 3-digit index, a particular
  zstd level, or that the part be compressed.
- Directory names are the long names in `ATLAS_DATASET_KEYS`. The reference reader also accepts
  the short aliases `pages`, `edges`, and `failed_pages`.

To read a dataset: list the part files, decompress `.jsonl.zst` with a Zstandard decoder, and
parse each non-blank line as JSON. See [reading-archives.md](./reading-archives.md).

---

## The ZIP layer: no double compression

The `.atls` container is a ZIP. A producer may store entries without deflate (method 0) because
the payloads are already Zstandard-compressed. The reference reader accepts stored and deflated
entries. Either way, `.jsonl.zst` and blob payloads still need a Zstandard decoder. The reference
reader uses `fzstd`.

---

## Root metadata files

- `manifest.json`, `summary.json`, `summary.v2.json`, `capabilities.v1.json`, `schema.json`,
  `README.md` are stored as **plain text** (uncompressed JSON / Markdown) at the archive root.
- `provenance.v1.jsonl.zst` is the one root file that is **Zstandard-compressed JSON Lines** (one
  provenance record per dataset).
- `meta/config.effective.json` and `meta/config.requested.json` are plain JSON.

So most root files can be read directly from the ZIP without a Zstandard decoder; only
`provenance.v1.jsonl.zst` and the dataset/blob payloads need one.

---

## Blobs

Large or repeated binary payloads (raw response bodies, post-JS rendered HTML, screenshots,
favicons, and sub-resource bodies) are stored once. The blob id is the lowercase SHA-256 hex of
the uncompressed bytes. The ZIP entry is:

```
blobs/sha256/<aa>/<bb>/<64 hex>.zst
```

`<aa>` is the first two hex characters of the id. `<bb>` is the next two. The payload is
Zstandard at any level. Two compressors at the same nominal level do not produce the same frame.
Dedup is by the uncompressed hash, not by the compressed bytes. The same uncompressed bytes share
one path inside a single archive.

Verification: decompress with any Zstandard decoder, SHA-256 the uncompressed bytes, and compare
to the hash in the final path segment. Also check that the two shard directories equal the first
four hex characters. Do not recompress to verify.

`contentSha256` does not cover blobs. Blob integrity is this per-blob check.

### Blob references

The canonical spelling in records is:

```
sha256/<aa>/<bb>/<64 hex>
```

Readers must also accept the legacy spelling:

```
blobs/sha256/<aa>/<bb>/<64 hex>.zst
```

A missing `blobs/` prefix or a missing `.zst` suffix is the same reference when the hash and the
shards match. A string that is not that shape may be a live URL. Do not treat it as a blob.

Fields that carry references include `responses.bodyBlobRef`, `responses.renderedBodyBlobRef`,
`reconstruction_index.sourceBodyBlobRef`, and `page_metadata.media.favicon`.

### Media bytes

Screenshot and favicon transcoding (format, quality, tiling) is producer policy. The schemas store
refs and dimensions. They do not require a media type. Response bodies are the bytes the producer
stored, then Zstandard-compressed.

---

## Part checksums

A part checksum is the lowercase SHA-256 hex of the ZIP entry payload: the bytes a ZIP reader
returns for that entry after undoing the ZIP method. Those bytes are the Zstandard frame, or the
raw JSONL when the part is not compressed. Readers hash those bytes. They must not Zstandard-decompress
the part first, and they must not compress the JSONL again and compare. ZIP method 0 (store) and
ZIP method 8 (deflate) hold the same payload. The checksum is of the payload, not of the deflate
bitstream.

The checksum is copied to:

- `manifest.integrity.files`, keyed by the archive-relative part path
- `manifest.datasets.<name>.integrity.checksums`, same key and digest, with `algorithm` `sha256`
- `parts` index rows that carry a `sha256`, when a producer writes that index

The set is every dataset part file. Blobs, `schemas/`, `manifest.json`, `summary.json`,
`summary.v2.json`, `provenance.v1.jsonl.zst`, `capabilities.v1.json`, and `meta/` are outside it.

## `contentSha256`

`integrity.contentSha256` is the archive digest.

1. Take every dataset part checksum (lowercase hex).
2. Order the parts by relative path, using unsigned byte order of the UTF-8 path. This is not
   locale order and not `localeCompare`.
3. Concatenate the checksum strings with no separator, no filenames, and no newlines.
4. SHA-256 the UTF-8 bytes of that ASCII string. Encode as 64 lowercase hex characters.

An empty part set hashes the empty string:
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

The path strings themselves are not hashed. Renaming a part changes the digest when the new order
moves a different checksum, because order selects the concatenation. Replacing part bytes changes
that part's checksum and therefore the digest.

`contentSha256` does not cover:

- blob bytes (per-blob hash, above)
- schema files and `schemaHash`
- `manifest.json` (the digest is inside the manifest, so it cannot cover the manifest bytes)
- `summary.json` and `summary.v2.json`
- `provenance.v1.jsonl.zst` and `output.hashSha256`
- `capabilities.v1.json`, `README.md`, and `meta/`

### Spec 1.1 path order

Spec 1.1 writers sorted paths with `String.prototype.localeCompare` and no locale argument, which
uses the process locale. Spec 1.2 uses UTF-8 byte order.

For the lowercase paths those writers emit (`<dataset>/part-NNN.jsonl.zst`, dataset names from
`ATLAS_DATASET_KEYS`), `en-US` `localeCompare` matches UTF-8 byte order. A 1.1 archive sealed in
`en-US` has the same `contentSha256` a 1.2 reader computes. The published writer vectors for
`page_metadata/part-001.jsonl.zst` and `responses/part-001.jsonl.zst` are in that class. Both
orders produce `46bf71cfb164f3f857ff1dd0980a85d76631a22dcad2f92b12819452cbba1ec2`.

The orders differ for realistic paths in two cases:

1. Mixed case. `en-US` `localeCompare` folds case, so `Responses/part-001.jsonl.zst` sorts after
   `assets/...`. UTF-8 byte order puts `Responses/...` first, because `R` (U+0052) is before `a`
   (U+0061). Spec 1.1 writers emit lowercase directory names, so sealed archives do not hit this.
   A 1.1 archive that does contain a non-lowercase path can still carry either digest.
2. Locale `th`. That collation orders `sitemaps/` before `sitemap_urls/` because the underscore is
   not a primary difference. UTF-8 byte order and `en-US` order `sitemap_urls/` first (`_` is
   U+005F, `s` is U+0073). Both names are registry datasets. A 1.1 writer running under locale
   `th` produces a different digest when both parts exist. Numeric examples are in
   `conformance/vectors/url-and-hashes.json`.

`en-US` `localeCompare` also orders `_` and `-` differently from byte order (`part_001` before
`part-001` in the locale, the reverse in bytes). The 1.1 writer emits `part-NNN`, so a single
archive of those names is unaffected. An archive that contains both spellings can differ even
under `en-US`.

Reader guidance: a spec 1.2 archive must match UTF-8 byte order. A spec 1.1 archive (and any 1.x
archive whose minor version is below 2) is valid when `contentSha256` matches UTF-8 byte order,
`en-US` `localeCompare` order, or `th` `localeCompare` order. The reference `validate()` accepts
those three for 1.1 and only byte order for 1.2.

### Deprecated digest names

`archiveSha256` and `auditHash` are deprecated. Writers should not emit them. Readers ignore them.
In the only writer helper that set them, both were copies of `contentSha256`. They do not cover
the ZIP file and they do not cover an audit subset. Elsewhere the name `archiveSha256` means the
SHA-256 of a whole downloaded file. That is a different input. Do not read
`manifest.integrity.archiveSha256` as a hash of the ZIP.

## Other digests

| Digest | Input | Part of `contentSha256`? |
|---|---|---|
| Part checksum | ZIP entry payload of a dataset part | yes, after the rollup above |
| `contentSha256` | concatenated part checksums, UTF-8 path order | the rollup |
| Blob id | uncompressed blob bytes | no |
| `schemaHash` | raw bytes of the schema file the dataset names | no |
| `output.hashSha256` | uncompressed JSONL checksums concatenated in part-index order, then SHA-256. Empty input hashes the empty string. Order matters, and it is not path order. | no |
| `crawlConfigHash` | `JSON.stringify` of `{ seeds, renderMode, replayTier, robotsRespect, privacyConfig }` with keys in that order. Seeds are sorted by UTF-16 code unit and are not normalized. `privacyConfig` keeps the caller's key order. | no |
| `datasetId` | first 16 hex characters of SHA-256 of `JSON.stringify` of `{ crawlId, crawlStartedAt, origin, seeds }`, same seed sort, keys in that order | no |
| `urlKey` | SHA-256 of `normalizeUrl`. See [url-identity.md](./url-identity.md). Not stored on the page record. | no |

`manifest.hashing.urlKeyAlgo` is `sha256` for a spec 1.2 writer. A 1.1 archive may say `sha1`.
`manifest.hashing.algorithm`, `rawHtmlHash`, and `domHash` are descriptions the producer stores.
`rawHtmlHash` is SHA-256 of the raw HTTP body bytes. `domHash` in a browser render is SHA-256 of
the UTF-8 `document.documentElement.outerHTML` after the producer's HTML sanitizer. In raw mode it
is SHA-256 of the decoded HTML string. The strings on the manifest are labels, not the digests.

---

_Last verified against the Zod schemas, `src/integrity.ts`, and the reference reader: 2026-11-10._
