# Atlas Format Specification

The normative specification for the Atlas `.atls` archive format. The machine definition in this
repository is the Zod schemas in `@caifrazier/atls-spec` (`packages/atls-spec/src/schemas/`). This
file is the index; each chapter is a focused document under [`docs/`](./docs/). **When this prose
and the Zod schemas differ, the schemas are authoritative.**

_Spec package version: `1.0.0-rc.1` · Current schema tag: `2026-09-04`._

The current schema tag is the constant `ATLAS_SCHEMA_VERSION` in `src/edition.ts`. It is the tag
this edition documents. `AtlasManifestV1Schema` still accepts any `schemaVersion` string.

---

## What Atlas is

An `.atls` file is a self-describing, local-first archive of a single website crawl. It is a ZIP
containing Zstandard-compressed JSON Lines datasets, content-addressed blob storage, embedded JSON
Schemas, and root metadata that indexes the archive. One crawled page is represented across many
datasets, joined by a shared `pageId`.

Atlas is **multi-dataset and page-keyed**, not a single flat table. Reading it well means knowing
which datasets exist, how they join, and how the bytes are laid out — the chapters below.

---

## The specification

| Chapter | Covers |
|---|---|
| [Archive Structure](./docs/archive-structure.md) | The ZIP layout: root files, directories, dataset part files, blobs. No `data/` wrapper. |
| [Storage & Encoding](./docs/storage-and-encoding.md) | JSON Lines, Zstandard, the ZIP container, blob paths, and which hash fields exist. |
| [Identity & Keys](./docs/identity-and-keys.md) | `pageId` / `crawlId` / `datasetId`, the join model, per-dataset keys. |
| [Versioning & Compatibility](./docs/versioning.md) | The version fields, the `schemaVersion` vs spec-package axes, `specLevel`, forward-compat rules. |
| [Root Metadata Files](./docs/root-files.md) | Field reference for `manifest`, `summary`, `summary.v2`, `capabilities`, `provenance`, `schema.json`. |
| [Dataset Reference](./docs/datasets.md) | Field reference for all 21 datasets, plus the producer presence-by-mode matrix. |
| [Schema System](./docs/schema-system.md) | Zod source of truth, JSON Schema codegen, which schemas are datasets, normalization adapters. |
| [Reading Archives](./docs/reading-archives.md) | How to read an archive with or without the SDK. |

Decisions that this edition does not settle are listed in [`docs/OPEN_QUESTIONS.md`](../../docs/OPEN_QUESTIONS.md)
at the repository root. They are not format requirements.

---

## Source of truth (this repository)

| Concern | Location |
|---|---|
| Current schema tag | `src/edition.ts` (`ATLAS_SCHEMA_VERSION`) |
| Dataset directory names | `src/datasetKeys.ts` (`ATLAS_DATASET_KEYS`, 21 names) |
| On-disk record and metadata schemas (Zod) | `src/schemas/` |
| JSON Schema codegen | `src/schemas/generator.ts` (`schemaMap`) → `dist/schemas/*.schema.json` |
| Hand-written TypeScript mirrors | `src/types.ts` (`AtlasManifest` follows `AtlasManifestV1Schema`) |
| Reference reader | `@caifrazier/atls-sdk` |

Schemas are authored in **Zod**. The JSON Schema files are generated from them at build time and
are not a second definition.

`AtlasManifest` in `src/types.ts` is the SDK-facing manifest type. Its field names match
`AtlasManifestV1Schema`, including `integrity.contentSha256`, `integrity.archiveSha256`, and
`integrity.auditHash`. `z.infer<typeof AtlasManifestV1Schema>` (`AtlasManifestV1`) is the inferred
schema type.

---

## The three things readers get wrong

1. **Dataset directories use the long registry names.** `page_metadata/`, `navigation/`,
   `pipeline_failures/`, and the other names in `ATLAS_DATASET_KEYS`. Manifest keys use those same
   long names. The reference reader also accepts three short directory aliases — `pages/` for
   `page_metadata/`, `edges/` for `navigation/`, and `failed_pages/` for `pipeline_failures/` —
   and prefers the long directory when both are present. Producers of this edition write the long
   names.
2. **Join on `pageId`, not `url`.** See [Identity & Keys](./docs/identity-and-keys.md).
3. **`schemaVersion` ≠ spec package version.** The archive carries a date-stamped
   `schemaVersion` (Current schema tag: `2026-09-04`); the npm package is `1.0.0-rc.1`. They are
   independent — see [Versioning](./docs/versioning.md).

---

## Related docs

- Open questions deferred from this edition: [`docs/OPEN_QUESTIONS.md`](../../docs/OPEN_QUESTIONS.md)
- Atlas SDK (the reference reader): [`packages/atls-sdk/README.md`](../atls-sdk/README.md)

---

_Last verified against the Zod schemas in this repository: 2026-11-10._
