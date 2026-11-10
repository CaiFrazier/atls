# Atlas Archive Structure

How an `.atls` file is laid out on disk. This is the authoritative reference for the physical
container; for the meaning of individual datasets see [datasets.md](./datasets.md), and for the
root metadata files see [root-files.md](./root-files.md).

_Verified against `ATLAS_DATASET_KEYS`, the Zod schemas, and the reference reader on 2026-11-10._

---

## The container

An `.atls` file is a **ZIP archive**. Payloads inside are Zstandard-compressed, so a producer may
store ZIP entries with method 0. The reference reader accepts stored and deflated entries. See
[storage-and-encoding.md](./storage-and-encoding.md).

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

## Root files

`openAtlas` requires `manifest.json`, `summary.json`, and a `formatVersion` whose major is 1.
The other root files below are producer artifacts. A missing `summary.v2.json`, `schema.json`,
`provenance.v1.jsonl.zst`, `capabilities.v1.json`, or archive `README.md` does not by itself make
the archive unreadable. `capabilities.v1.json` is read only for the SDK-compatibility warning.
Full field references are in [root-files.md](./root-files.md).

| File | Format | Purpose |
|---|---|---|
| `manifest.json` | JSON | Authoritative index: identity, versions, per-dataset metadata, coverage, integrity. |
| `summary.json` | JSON | Aggregate crawl stats and config snapshot (v1 shape). |
| `summary.v2.json` | JSON | `summary.json` plus an `aggregates` section (status buckets, totals). |
| `capabilities.v1.json` | JSON | Declared vs. active capabilities, datasets-with-records, the finalization seal. |
| `provenance.v1.jsonl.zst` | Zstd JSONL | One lineage record per dataset (producer, inputs, parameters, output hash). |
| `schema.json` | JSON | Combined field dictionary across all dataset schemas. |
| `README.md` | Markdown | Auto-generated human-readable guide to this specific archive. |

> Casing note: top-level manifest fields are camelCase, including `crawlId`. `identity` accepts
> both `primary_origin` and `primaryOrigin` (and both `seed_urls` and `seedUrls`). `summary.json`
> identity is camelCase only (`primaryOrigin`, `seedUrls`). Match [root-files.md](./root-files.md).

---

## Root directories

| Directory | Contents |
|---|---|
| `schemas/` | One `<dataset>.v1.schema.json` per dataset, generated from the Zod schemas. |
| `blobs/` | Content-addressed payloads under `sha256/<aa>/<bb>/<hash>.zst`. |
| `meta/` | `config.effective.json` (fully resolved config) and `config.requested.json` (user delta). |

`frontier-store/` is not an archive directory. The reference reader does not look for it.

---

## Dataset directories

Each dataset directory uses a long name from `ATLAS_DATASET_KEYS` (`packages/atls-spec/src/datasetKeys.ts`).
The reference reader also accepts `pages` for `page_metadata`, `edges` for `navigation`, and
`failed_pages` for `pipeline_failures`, and prefers the long directory when both exist. Those
short names are a reader fallback only. Writers must use the long names. Manifest keys stay the
long names. The producer presence matrix is in [datasets.md](./datasets.md). It is not a validity
rule, except that the manifest must declare `page_metadata`.

Each dataset directory contains one or more **part files**:

```
<dataset>/part-001.jsonl.zst
```

- The usual producer name is `part-NNN.jsonl.zst` with a zero-padded index. The reference reader
  accepts any `*.jsonl` or `*.jsonl.zst` under the dataset prefix, sorted by name, including
  uncompressed parts.
- Each compressed part is Zstandard-compressed JSON Lines — one JSON record per line.
- Read **all** parts in a directory and concatenate the records. Blank lines are skipped.

`manifest.json` lists part paths under `parts` and lists digests under `integrity.files` and
`datasets.<name>.integrity.checksums`. Each digest is the SHA-256 of that part's stored ZIP
payload. `integrity.contentSha256` rolls those checksums up in UTF-8 path order. See
[storage-and-encoding.md](./storage-and-encoding.md). Consult `manifest.datasets` for presence
rather than assuming a directory exists. A producer may omit a directory that has no records.
The manifest must still declare `page_metadata`.

---

## Blobs

Response bodies, rendered DOM, screenshots, and favicons are stored once, content-addressed by
SHA-256:

```
blobs/sha256/<first-2-hex>/<next-2-hex>/<full-64-hex>.zst
```

For example `blobs/sha256/ab/cd/abcd…ef.zst`. The canonical record reference is the path tail
`sha256/ab/cd/abcd…ef`. Readers also accept `blobs/sha256/ab/cd/abcd…ef.zst`. Verification
decompresses the entry and checks SHA-256 against the hash in the path. See
[storage-and-encoding.md](./storage-and-encoding.md).

---

## What is *not* in the archive

- **`frontier_ledger`** is a real dataset. The reference producer writes it only when a discovery
  tracker is wired. Its absence is not a schema failure.
- `frontier-store/` is not an archive directory.
- Staging scratch files (`state.json`, `visited.idx`, checkpoint snapshots) are not part of the
  sealed `.atls`.

---

_Last verified against `ATLAS_DATASET_KEYS` and the reference reader: 2026-11-10._
