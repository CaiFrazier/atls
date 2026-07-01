# Storage & Encoding

How records and binary payloads are serialized, compressed, and addressed inside an `.atls`
archive.

_Verified against `packages/cartographer/src/io/atlas/` on 2026-06-04._

---

## Datasets: Zstandard-compressed JSON Lines

Every dataset is a stream of **JSON Lines** (one JSON object per line, UTF-8), split into part
files and compressed with **Zstandard**:

```
<dataset>/part-001.jsonl.zst
<dataset>/part-002.jsonl.zst
```

- During the crawl, records are appended to plain `.jsonl` part files in the staging directory by
  `PartStreamManager` (part filename pattern `part-NNN.jsonl`, `PartStreamManager.ts:195`).
- Parts rotate at a record/size boundary, so one dataset can span many parts.
- At finalization, each `.jsonl` part is compressed to `.jsonl.zst`
  (`ArchiveCompiler`, `archiveCompiler.ts`).
- The compressor prefers the system `zstd` CLI (streaming, level 3) and falls back to the
  `@mongodb-js/zstd` binding when the CLI is unavailable.

To read a dataset: list every `part-*.jsonl.zst` in the directory, `zstd -d` each one, and parse
each line as JSON. See [reading-archives.md](./reading-archives.md) for code.

---

## The ZIP layer: no double compression

The `.atls` container is a ZIP built with `archiver` at **`zlib` level 0** (stored, not deflated)
— `archiveCompiler.ts`. Because dataset parts, blobs, and provenance are already Zstandard-
compressed, re-compressing them in the ZIP layer would waste CPU for no gain. The ZIP is therefore
a thin, uncompressed container around pre-compressed entries.

Implication for readers: unzip is cheap (no inflate), but you still need a Zstandard decoder to
read the entries.

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

## Blobs: content-addressed by SHA-256

Large or repeated binary payloads — raw response bodies, post-JS rendered HTML, screenshots,
favicons, and (in full mode) sub-resource bodies — are stored once in a content-addressed store
(`BlobStore`):

```
blobs/sha256/<aa>/<bb>/<full-hash>.zst
```

- The address is the **SHA-256 of the original (uncompressed) bytes**, hex-encoded
  (`createHash("sha256")`, `BlobStore.ts`).
- The path fans out by the first two and next two hex characters of the hash to keep directories
  shallow, then stores the body Zstandard-compressed.
- **Deduplication:** identical content hashes to the same path and is written once; many records
  can reference the same blob. The store keeps an in-process LRU of known hashes (cap ~500k) to
  skip re-writing within a single crawl. Dedup is per-archive — there is no cross-archive blob
  sharing.

### Blob references

Records point at blobs with a `*_blob_ref` string — for example `responses.bodyBlobRef`,
`responses.renderedBodyBlobRef`, `reconstruction_index.sourceBodyBlobRef`,
`*.faviconBlobRef`. The canonical form of a reference is the path tail:

```
sha256/<aa>/<bb>/<full-hash>
```

To resolve a reference, prepend `blobs/` and append `.zst`, read the ZIP entry, and `zstd -d` it.

> Caveat: not every field that ends in `_blob_ref` is guaranteed to be an in-archive
> `sha256/...` path in every archive. Validate that a reference matches the `sha256/<2>/<2>/<64hex>`
> shape before resolving it as an internal blob; some legacy/edge records may carry a live URL.

### Media transcoding

- **Screenshots** are transcoded to the configured format (default WebP, quality 80) before
  hashing/storing, and tiled when very tall (the `assets.tiles[]` field references the tiles).
- **Favicons** are preserved as-is when already `.ico`/`.svg`, otherwise transcoded.
- **Response bodies** are stored verbatim (no transcode), then Zstandard-compressed.

---

## Hashing summary

| Purpose | Algorithm | Where |
|---|---|---|
| Blob content address | SHA-256 of original bytes | `blobs/sha256/...` path |
| Dataset part integrity | SHA-256 of compressed part | `manifest.datasets.<name>.integrity.checksums` |
| Archive content hash | SHA-256 over sorted file hashes | `manifest.integrity.contentSha256` |
| URL key | SHA-1 | `manifest.hashing.urlKeyAlgo` |
| Schema hash | SHA-256 of schema JSON | `manifest.datasets.<name>.schemaHash` |

`manifest.hashing` records the algorithms in use (`algorithm: "sha256"`, `urlKeyAlgo: "sha1"`).

---

_Last verified against codebase: 2026-06-04._
