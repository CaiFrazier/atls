# Atlas Format Specification

The normative specification for the Atlas `.atls` archive format, as implemented in
`@cf/atlas-spec` (schemas) and produced by `@cf/cartographer` (writer). This file is the index;
each chapter is a focused document under [`docs/`](./docs/). **When this spec and the code differ,
the code is authoritative** — every chapter is verified against code and dated.

_Spec package version: `1.0.0-rc.1` · current archive `schemaVersion`: `2025-10-22`._

---

## What Atlas is

An `.atls` file is a self-describing, local-first archive of a single website crawl. It is a ZIP
containing Zstandard-compressed JSON Lines datasets, content-addressed blob storage, embedded JSON
Schemas, and root metadata that indexes and seals the whole thing. One crawled page is represented
across many datasets, joined by a shared `page_id`.

Atlas is **multi-dataset and page-keyed**, not a single flat table. Reading it well means knowing
which datasets exist, how they join, and how the bytes are laid out — the chapters below.

---

## The specification

| Chapter | Covers |
|---|---|
| [Archive Structure](./docs/archive-structure.md) | The ZIP layout: root files, directories, dataset part files, blobs. No `data/` wrapper. |
| [Storage & Encoding](./docs/storage-and-encoding.md) | JSON Lines, Zstandard, the level-0 ZIP, blob content-addressing, hashing. |
| [Identity & Keys](./docs/identity-and-keys.md) | `page_id` / `crawl_id` / `dataset_id`, the join model, per-dataset keys, UUID versions. |
| [Versioning & Compatibility](./docs/versioning.md) | The version fields, the `schemaVersion` vs spec-package axes, `specLevel`, forward-compat rules. |
| [Root Metadata Files](./docs/root-files.md) | Field reference for `manifest`, `summary`, `summary.v2`, `capabilities`, `provenance`, `schema.json`. |
| [Dataset Reference](./docs/datasets.md) | Complete field reference for all 19 datasets + presence-by-mode matrix. |
| [Schema System](./docs/schema-system.md) | Zod source of truth, JSON Schema codegen, coverage gaps (`assets`/`quarantine`), normalization adapters. |
| [Reading Archives](./docs/reading-archives.md) | How to read correctly, the SDK 0-records caveat, and the Python+zstd workaround. |

---

## Source of truth (code)

| Concern | Location |
|---|---|
| Record types | `src/types.ts` |
| Canonical record schemas (Zod) | `src/schemas/cartographer-datasets.schema.ts` |
| Per-dataset schema aliases | `src/schemas/*.schema.ts` |
| Metadata schemas | `manifest.schema.ts`, `summary.schema.ts`, `capabilities.schema.ts`, `provenance.schema.ts`, `runtime-core.schema.ts` |
| JSON Schema codegen | `src/schemas/generator.ts` (`schemaMap`) → `dist/schemas/*.schema.json` |
| Writer (produces archives) | `@cf/cartographer` → `src/io/atlas/` |
| Reader SDK | `@caifrazier/atls-sdk` |

Schemas are authored in **Zod**; the JSON Schema files are generated from them as a build step.

---

## The three things readers get wrong

1. **Dataset folder names are long.** `page_metadata/`, `navigation/`, `pipeline_failures/`. The
   short names `pages/`/`edges/`/`failed_pages/` are removed legacy. The `@caifrazier/atls-sdk`
   reader correctly resolves both formats automatically — see
   [Reading Archives](./docs/reading-archives.md).
2. **Join on `page_id`, not `url`.** See [Identity & Keys](./docs/identity-and-keys.md).
3. **`schemaVersion` ≠ spec package version.** The archive carries a date-stamped
   `schemaVersion` (`2025-10-22`); the npm package is `1.0.0-rc.1`. They are independent — see
   [Versioning](./docs/versioning.md).

---

## Related docs

- Cartographer engine (the writer): `../cartographer/docs/current/`
- Atlas SDK (the reader): `../atlas-sdk/README.md`

---

_Last verified against codebase: 2026-06-04._
