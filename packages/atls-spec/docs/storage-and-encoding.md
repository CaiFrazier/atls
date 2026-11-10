# Storage & Encoding

How records and binary payloads are serialized, compressed, and addressed inside an `.atls`
archive.

_Field names below match the Zod schemas. Byte-level hash procedures are not specified in this edition. See [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md)._

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

Large or repeated binary payloads — raw response bodies, post-JS rendered HTML, screenshots,
favicons, and sub-resource bodies — are stored once:

```
blobs/sha256/<aa>/<bb>/<64 hex>.zst
```

- The directory name is the hex SHA-256 of the uncompressed bytes. The path fans out on the first
  two and next two hex characters, then stores the body Zstandard-compressed.
- The same bytes share one path inside a single archive.
- The reference reader decompresses a blob and returns the bytes. It does not recompute the digest.
  Strict `validate()` checks that a blob ref matches `sha256/<2>/<2>/<64 hex>` and does not hash
  the bytes.

### Blob references

Records point at blobs with camelCase fields such as `responses.bodyBlobRef`,
`responses.renderedBodyBlobRef`, `reconstruction_index.sourceBodyBlobRef`, and
`page_metadata.media.favicon`. The canonical reference is the path tail:

```
sha256/<aa>/<bb>/<64 hex>
```

To resolve a canonical reference, prepend `blobs/` and append `.zst`, read the ZIP entry, and
decompress it. The reference reader also accepts a `blobs/` prefix, a missing prefix, and an
optional `.zst` suffix. A value that is not that shape may be a live URL rather than an in-archive
blob.

### Media bytes

Screenshot and favicon transcoding (format, quality, tiling) is producer policy. The schemas store
refs and dimensions. They do not require a media type. Response bodies are the bytes the producer
stored, then Zstandard-compressed when the part or blob is a `.zst` entry.

---

## Hash fields

These are the fields the schema defines. The byte ranges are not specified in this edition.

| Purpose | Where |
|---|---|
| Blob path | `blobs/sha256/<aa>/<bb>/<64 hex>.zst`. The reference reader also accepts a `blobs/` prefix, a missing prefix, and an optional `.zst` suffix. `validate({ strict: true })` checks the canonical pattern only. Neither recomputes the digest. |
| Dataset part digests | `manifest.datasets.<name>.integrity.checksums`, with `integrity.algorithm` when that object is present. |
| Archive digests | `manifest.integrity.contentSha256`, `manifest.integrity.archiveSha256`, `manifest.integrity.auditHash`. All optional. `integrity.files` maps a packaged path to a digest string. |
| URL key algorithm name | `manifest.hashing.urlKeyAlgo` (required string). Current edition's documented value: `sha1`. |
| Schema digest | `manifest.datasets.<name>.schemaHash` (optional string). |

`manifest.hashing` also requires `algorithm`, `rawHtmlHash`, and `domHash` as strings.

---

_Last verified against the Zod schemas and the reference reader: 2026-11-10._
