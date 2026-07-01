# Atlas Archive Structure

How an `.atls` file is laid out on disk. This is the authoritative reference for the physical
container; for the meaning of individual datasets see [datasets.md](./datasets.md), and for the
root metadata files see [root-files.md](./root-files.md).

_Verified against `packages/cartographer/src/io/atlas/` (writer) on 2026-06-04._

---

## The container

An `.atls` file is a **ZIP archive**. The ZIP is assembled with no additional compression
(`archiver` at `zlib` level 0) because every payload inside is already Zstandard-compressed — see
[storage-and-encoding.md](./storage-and-encoding.md). The writer packages entries from an
allowlist (`io/atlas/archiveCompiler.ts`); anything not on the allowlist is excluded from the
final archive.

There is **no `data/` wrapper directory**. Datasets are top-level directories. A reader that
expects `data/page_metadata/…` is wrong; the path is `page_metadata/…`.

```
crawl.atls
├── manifest.json                 ← authoritative archive index
├── summary.json                  ← aggregate stats (v1)
├── summary.v2.json               ← summary + aggregates block
├── capabilities.v1.json          ← capability declarations + seal
├── provenance.v1.jsonl.zst       ← per-dataset lineage (compressed JSONL)
├── schema.json                   ← combined field dictionary
├── README.md                     ← auto-generated human guide
├── schemas/                      ← one JSON Schema per dataset
│   ├── page_metadata.v1.schema.json
│   ├── navigation.v1.schema.json
│   └── …
├── blobs/                        ← content-addressed bodies & media
│   └── sha256/<aa>/<bb>/<hash>.zst
├── meta/                         ← resolved crawl configuration
│   ├── config.effective.json
│   └── config.requested.json
├── page_metadata/                ← dataset directory
│   ├── part-001.jsonl.zst
│   └── part-002.jsonl.zst
├── navigation/
│   └── part-001.jsonl.zst
├── responses/
├── content/
├── assets/
└── …                             ← one directory per dataset with records
```

---

## Root files (always present)

Seven files live at the archive root. All are packaged by the allowlist in
`archiveCompiler.ts:39-56`. Full field references are in [root-files.md](./root-files.md).

| File | Format | Purpose |
|---|---|---|
| `manifest.json` | JSON | Authoritative index: identity, versions, per-dataset metadata, coverage, integrity. |
| `summary.json` | JSON | Aggregate crawl stats and config snapshot (v1 shape). |
| `summary.v2.json` | JSON | `summary.json` plus an `aggregates` section (status buckets, totals). |
| `capabilities.v1.json` | JSON | Declared vs. active capabilities, datasets-with-records, the finalization seal. |
| `provenance.v1.jsonl.zst` | Zstd JSONL | One lineage record per dataset (producer, inputs, parameters, output hash). |
| `schema.json` | JSON | Combined field dictionary across all dataset schemas. |
| `README.md` | Markdown | Auto-generated human-readable guide to this specific archive. |

> Casing note: `manifest.json` mixes snake_case identity fields (`primary_origin`, `crawlId`)
> with camelCase version fields (`atlasVersion`). `summary.json` is camelCase throughout
> (`primaryOrigin`, `seedUrls`). This inconsistency is intentional and load-bearing — match it
> exactly. See [root-files.md](./root-files.md).

---

## Root directories

| Directory | Contents |
|---|---|
| `schemas/` | One `<dataset>.v1.schema.json` per dataset, generated from the Zod schemas. |
| `blobs/` | Content-addressed payloads under `sha256/<aa>/<bb>/<hash>.zst`. |
| `meta/` | `config.effective.json` (fully resolved config) and `config.requested.json` (user delta). |

The writer explicitly skips `frontier-store/` (an internal staging directory) when packaging
(`archiveCompiler.ts:54`).

---

## Dataset directories

Each dataset that produced at least one record gets a top-level directory named with the
canonical snake_case dataset key (defined in `io/atlas/datasets.ts`). The full list of possible
datasets and their presence-by-mode is in [datasets.md](./datasets.md).

Each dataset directory contains one or more **part files**:

```
<dataset>/part-NNN.jsonl.zst
```

- `NNN` is a zero-padded 3-digit index starting at `001` (`PartStreamManager.ts:195`).
- Each part is **Zstandard-compressed JSON Lines** — one JSON record per line, then `zstd`.
- Parts rotate at a size/record boundary, so a large dataset spans `part-001`, `part-002`, …
  Read **all** parts in a directory and concatenate the records.

`manifest.json` lists the exact part files per dataset under its `parts` map, and per-part SHA-256
checksums under each dataset's `integrity.checksums` — use those to verify completeness rather
than globbing the directory.

### Pruned-if-empty directories

`resources/` and `sitemaps/` are registered during the crawl but their directories are **deleted
before packaging** if no records were produced (`PersistenceOrchestrator.ts:1048-1059`). Treat any
optional dataset as "may be absent" and consult `manifest.datasets` rather than assuming a
directory exists.

---

## Blobs

Response bodies, rendered DOM, screenshots, and favicons are stored once, content-addressed by
SHA-256:

```
blobs/sha256/<first-2-hex>/<next-2-hex>/<full-64-hex>.zst
```

For example `blobs/sha256/ab/cd/abcd…ef.zst`. Records reference a blob by its `*_blob_ref` string
(e.g. `responses.bodyBlobRef`), which is the path tail `sha256/ab/cd/abcd…ef`. Identical content
is stored once and referenced by many records. See
[storage-and-encoding.md](./storage-and-encoding.md) for the addressing and dedup model.

---

## What is *not* in the archive

- **`frontier_ledger`** is a finalization-time discovery dataset that is only written when a
  discovery tracker is explicitly wired; it is not packaged under default config.
- The internal `frontier-store/` staging directory is never packaged.
- Staging scratch files (`state.json`, `visited.idx`, checkpoint snapshots) live in the staging
  directory during the crawl and are not part of the sealed `.atls`.

---

_Last verified against codebase: 2026-06-04._
