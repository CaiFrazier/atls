# Schema System

How Atlas schemas are defined, generated, and embedded in archives — and where coverage is
incomplete.

_Verified against `packages/atls-spec/src/schemas/` on 2026-11-10. Current schema tag: `2026-09-04`._

---

## Zod is the source of truth

Every Atlas schema is authored in **Zod** in `packages/atls-spec/src/schemas/*.ts`. The Zod
schemas are the canonical definitions; the JSON Schema files shipped in archives are *generated*
from them, not hand-written.

The canonical writer-facing record schemas live in `cartographer-datasets.schema.ts`. The
individual `*.schema.ts` files (`page_metadata.schema.ts`, `navigation.schema.ts`, …) re-export
those as aliases so SDK consumers can import a stable per-dataset symbol.

---

## JSON Schema codegen

`src/schemas/generator.ts` converts the Zod schemas to JSON Schema via `zod-to-json-schema` and
writes `dist/schemas/*.schema.json`. This is a **build step** (`pnpm --filter @caifrazier/atls-spec build`),
not automatic — editing a Zod schema without rebuilding leaves the JSON Schema stale.

The authoritative roster of which schemas the package publishes is the `schemaMap` array in
`generator.ts`. It contains:

- Metadata/infrastructure schemas: `manifest.v1`, `capabilities.v1`, `provenance.v1`, `summary.v1`.
- Per-dataset record schemas: `page_metadata.v1`, `navigation.v1`, `content.v1`, `assets.v1`,
  `structured_data.v1`, `technology.v1`, `render_state.v1`, `security.v1`, `performance.v1`,
  `accessibility.v1`, `responses.v1`, `resources.v1`, `pipeline_failures.v1`,
  `pipeline_alerts.v1`, `events.v1`, `sitemaps.v1`, `sitemap_urls.v1`, `extraction.v1`,
  `frontier_ledger.v1`, `reconstruction_index.v1`, `quarantine.v1`.
- Schemas that are not dataset directories: `dom_snapshot.v1`, `acc_tree.v1`, `render.v1`.

`audit_results` is exported from the package and is intentionally absent from `schemaMap`.

A producer may copy generated JSON Schemas into the archive's `schemas/` directory. `schema.json`
has no Zod schema here. See [root-files.md](./root-files.md).

---

## Emitted vs. specified

Every name in `ATLAS_DATASET_KEYS` has a Zod record schema, and `schemaMap` publishes a JSON
Schema for it. `assets` is `AssetRecordSchema`. `quarantine` documents records that already failed
validation; the schema is not a second write-time gate.

### Schemas that are not dataset directories

- **`dom_snapshot.v1`**, **`acc_tree.v1`**, and **`render.v1`** are in `schemaMap` and are not
  entries in `ATLAS_DATASET_KEYS`. `render_state.domSnapshot`, `computedText`, and
  `accessibilityTree` are free JSON objects (`z.record`). They are not instances of
  `dom_snapshot.v1` or `acc_tree.v1`. `render.v1` is an older renderer-capture schema.
- **`audit_results`** is exported from `@caifrazier/atls-spec` and is not in `schemaMap`. It is
  not an archive dataset.

See [OPEN_QUESTIONS.md](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md).

---

## Validation behavior

On read, `openAtlas` schema-checks `assets`, `responses`, and `resources`. `validate()` then
parses navigation, those three, and content, structured data, technology, render state,
performance, security, responses, resources, sitemaps, sitemap URLs, extraction, events,
accessibility, pipeline failures, and pipeline alerts.

`validate()` does not open `quarantine`, `reconstruction_index`, or `frontier_ledger`. Quarantine
records are retained because they already failed validation; the published schema documents that
shape and the SDK does not re-validate it.

`checkIntegrity` checks references (an edge or asset URL against `page_metadata`). Separately,
`validate()` checks part checksums, `contentSha256`, and blob hashes. `skipBlobVerification`
skips only the blob hash and blob-reference existence checks. `archiveSha256` and `auditHash`
are ignored. `strict` on `validate()` defaults to false and means "require the full manifest
field set, a blob ref that is either the canonical spelling or the legacy `blobs/.../<hash>.zst`
spelling, and the null-vs-omit rule."
`strict` on `openAtlas` defaults to true and means "throw `MalformedRecordError` on bad JSON or
on the three datasets checked at read time." The two flags share a name and do not share a meaning.

See the [Atlas SDK reference](https://github.com/CaiFrazier/atls/blob/main/packages/atls-sdk/docs/API.md).

---

## Normalization adapters

`@caifrazier/atls-spec` provides a shape adapter for consumers:

- `src/pageMetadataMapping.ts` — `flattenPageMetadataRecord()` converts the nested on-disk
  `page_metadata` record (`core.*`, `indexing.*`, `social.*`) into a flat consumer shape. The
  SDK's `readers.pageMetadata()` returns that flat shape. `readers.dataset("page_metadata")` and
  `select` return the nested record. `PageRecord` is an in-memory composite, not the on-disk
  dataset. See [OPEN_QUESTIONS.md](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md).

---

_Last verified against `schemaMap` and `@caifrazier/atls-sdk` `validate()`: 2026-11-10._
