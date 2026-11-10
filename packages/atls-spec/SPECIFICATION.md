# Atlas Format Specification

The normative specification for the Atlas `.atls` archive format. The machine definition in this
repository is the Zod schemas in `@caifrazier/atls-spec` (`packages/atls-spec/src/schemas/`). This
file is the index; each chapter is a focused document under [`docs/`](./docs/). **When this prose
and the Zod schemas differ, the schemas are authoritative.**

_Package release: `26.11.2`. Spec contract: `1.3.0`. Format stamps: `atlasVersion` `1.3`, `formatVersion` `1.3.0`. Current schema tag: `2026-09-04`._

Spec 1.3 is an additive minor. New fields and the `robots` dataset are optional, so archives stamped 1.1 and 1.2 stay valid. A writer stamps `atlasVersion` `1.3`, `formatVersion` `1.3.0`, and `specVersion` `1.3.0` only when the archive emits a spec 1.3 field. The schema tag does not change. On a robots row, `responses429` and `responses5xx` count the page responses received from that origin during the crawl. They do not count fetches of robots.txt. Null means the count was not measured. 0 means it was measured and was zero. A robots writer settles each origin, retries included, before that origin's first page. `robotsPolicy.mode`, `modeSource`, `failClosed`, and the applied-body digest stay stable across 1.3.x. Those rules are spec contract `1.3.0`. The package release `26.11.2` is the date the tooling shipped, and it is a separate number. See [Package versioning](https://github.com/CaiFrazier/atls/blob/main/docs/VERSIONING.md).

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
| [Storage & Encoding](./docs/storage-and-encoding.md) | JSON Lines, Zstandard, part checksums, `contentSha256`, blob paths. |
| [Identity & Keys](./docs/identity-and-keys.md) | `pageId`, `crawlId`, `datasetId`, `assetId`, `resId`, the join model. |
| [URL Identity](./docs/url-identity.md) | `normalizeUrl`, `urlKey`, the trailing-slash field, redirect rows. |
| [Versioning & Compatibility](./docs/versioning.md) | Manifest stamps, the schema tag, the package release, `specLevel`, forward-compat rules. |
| [Root Metadata Files](./docs/root-files.md) | Field reference for `manifest`, `summary`, `summary.v2`, `capabilities`, `provenance`, `schema.json`. |
| [Dataset Reference](./docs/datasets.md) | Field reference for all 22 datasets, plus the producer presence-by-mode matrix. |
| [Schema System](./docs/schema-system.md) | Zod source of truth, JSON Schema codegen, which schemas are datasets, normalization adapters. |
| [Reading Archives](./docs/reading-archives.md) | How to read an archive with or without the SDK. |

Decisions for this edition are recorded in [`docs/OPEN_QUESTIONS.md`](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md).
The changelog is [CHANGELOG.md](./CHANGELOG.md). Conformance archives and vectors are in
[`conformance/`](https://github.com/CaiFrazier/atls/blob/main/conformance/README.md).

---

## Source of truth (this repository)

| Concern | Location |
|---|---|
| Current schema tag | `src/edition.ts` (`ATLAS_SCHEMA_VERSION`, `2026-09-04`) |
| Spec contract | `src/edition.ts` (`ATLAS_SPEC_VERSION`, `1.3.0`) |
| URL identity and digests | `src/urlIdentity.ts`, `src/integrity.ts`, `src/blobs.ts`, `src/ids.ts` |
| Dataset directory names | `src/datasetKeys.ts` (`ATLAS_DATASET_KEYS`, 22 names) |
| On-disk record and metadata schemas (Zod) | `src/schemas/` |
| JSON Schema codegen | `src/schemas/generator.ts` (`schemaMap`) → `dist/schemas/*.schema.json` |
| Hand-written TypeScript mirrors | `src/types.ts` (`AtlasManifest` follows `AtlasManifestV1Schema`) |
| Reference reader | `@caifrazier/atls-sdk` |

Schemas are authored in **Zod**. The JSON Schema files are generated from them at build time and
are not a second definition.

`AtlasManifest` in `src/types.ts` is the SDK-facing manifest type. Its field names match
`AtlasManifestV1Schema`, including `integrity.contentSha256`, the deprecated
`integrity.archiveSha256` and `integrity.auditHash`, and `urlNormalization.trailing_slash`.
`z.infer<typeof AtlasManifestV1Schema>` (`AtlasManifestV1`) is the inferred schema type.

---

## The three things readers get wrong

1. **Dataset directories use the long registry names.** `page_metadata/`, `navigation/`,
   `pipeline_failures/`, and the other names in `ATLAS_DATASET_KEYS`. Manifest keys use those same
   long names. The reference reader also accepts three short directory aliases — `pages/` for
   `page_metadata/`, `edges/` for `navigation/`, and `failed_pages/` for `pipeline_failures/` —
   and prefers the long directory when both are present. Producers write the long names. The short
   names are a reader fallback only.
2. **Join on `pageId`, not `url`.** See [Identity & Keys](./docs/identity-and-keys.md).
3. **The schema tag, the format stamps, and the package release are separate.** The archive carries a date-stamped
   `schemaVersion` (Current schema tag: `2026-09-04`) and the format stamps `atlasVersion` `1.3`, `formatVersion` `1.3.0`, and `specVersion` `1.3.0`. The package release (`26.11.2`) is the date the tooling shipped. It is not in the archive. See [Versioning](./docs/versioning.md).

---

## Related docs

- Open questions and the spec 1.2 decisions: [`docs/OPEN_QUESTIONS.md`](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Conformance suite: [`conformance/README.md`](https://github.com/CaiFrazier/atls/blob/main/conformance/README.md)
- Atlas SDK (the reference reader): [`packages/atls-sdk/README.md`](https://github.com/CaiFrazier/atls/blob/main/packages/atls-sdk/README.md)

---

_Last verified against the Zod schemas in this repository: 2026-11-10._
