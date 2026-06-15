# Schema System

How Atlas schemas are defined, generated, and embedded in archives — and where coverage is
incomplete.

_Verified against `packages/atls-spec/src/schemas/` on 2026-06-04._

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
writes `dist/schemas/*.schema.json`. This is a **build step** (`pnpm --filter @atls/spec build`),
not automatic — editing a Zod schema without rebuilding leaves the JSON Schema stale.

The authoritative roster of which schemas the package publishes is the `schemaMap` array in
`generator.ts`. It contains:

- Metadata/infrastructure schemas: `manifest.v1`, `capabilities.v1`, `provenance.v1`, `summary.v1`.
- Per-dataset record schemas: `page_metadata.v1`, `navigation.v1`, `content.v1`,
  `structured_data.v1`, `technology.v1`, `render_state.v1`, `security.v1`, `performance.v1`,
  `accessibility.v1`, `responses.v1`, `resources.v1`, `dom_snapshot.v1`, `acc_tree.v1`, `render.v1`,
  `pipeline_failures.v1`, `pipeline_alerts.v1`, `events.v1`, `sitemaps.v1`, `frontier_ledger.v1`,
  `reconstruction_index.v1`.

When an archive is sealed, the cartographer writer copies the relevant JSON Schemas into the
archive's `schemas/` directory as `<dataset>.v1.schema.json`, and builds a combined field
dictionary at `schema.json` (see [root-files.md](./root-files.md)).

---

## Emitted vs. specified — the coverage gaps

The set of datasets the **writer emits** is not identical to the set the **spec defines a schema
for**. Two mismatches exist as of `schemaVersion 2025-10-22`:

### Emitted but unspecified (no Zod schema)

- **`assets`** — written to every archive, but its shape is defined only as the `AssetRecord`
  TypeScript interface in `packages/atls-spec/src/types.ts:757-926`. It is **not** in the
  `generator.ts` `schemaMap`, so no `assets.v1.schema.json` is produced and the validator skips it.
- **`quarantine`** — written when records fail validation, but its shape lives only in the
  cartographer `QuarantineRecord` interface. No Zod schema, not in `schemaMap`.

Consumers must validate `assets` and `quarantine` against the records themselves (or the TypeScript
types), not against a published JSON Schema, until the gap is closed. This is a known limitation
worth a tracker entry.

### Specified but not standalone datasets

Some schemas in `schemaMap` do **not** correspond to a top-level dataset directory:

- **`dom_snapshot.v1`** and **`acc_tree.v1`** describe payloads embedded **inside** `render_state`
  records (`domSnapshot`, `accessibilityTree`), not separate dataset folders.
- **`render.v1`** is a legacy renderer-capture schema retained for compatibility.
- **`audit_results.v1`** is intentionally **excluded** from Cartographer archives — it is owned by
  the downstream Horizon analysis layer (see the note in `generator.ts`). It remains available in
  `@cf/atlas-spec` for Horizon's use.

---

## Validation behavior

The SDK's `validate()` checks each dataset's records against its Zod schema. Datasets with no
schema (`assets`, `quarantine`) are counted but **not schema-validated** — they are reported as
present without field-level validation. Referential integrity (edges/assets referencing valid
pages) and blob-ref format checks are available as opt-in validation passes. See the
[Atlas SDK reference](../../atlas-sdk/README.md).

---

## Normalization adapters

Two helpers in `@cf/atlas-spec` smooth over historical shape drift:

- `src/normalize.ts` — coalesces legacy camelCase field aliases to the canonical snake_case form
  (`pageId → page_id`, `assetId → asset_id`, etc.) so older records read consistently.
- `src/pageMetadataMapping.ts` — `flattenPageMetadataRecord()` converts the nested on-disk
  `page_metadata` record (`core.*`, `indexing.*`, `social.*`) into a flat consumer shape. It
  detects whether a record is already flat and passes it through unchanged.

---

_Last verified against codebase: 2026-06-04._
