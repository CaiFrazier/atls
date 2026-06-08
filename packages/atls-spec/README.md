# @atls/spec

Atlas specification package for Cartographer/Atlas archives.

It provides:

- TypeScript types
- Zod schemas
- JSON Schema generation artifacts

## Package Role

- Shared contract used by `@cf/cartographer` and `@atls/sdk`
- Canonical schema/type source for Atlas archive structures

## Exports

- Core types: `src/types.ts`
- Record split exports: `src/types/records/`
- Normalization helpers: `src/normalize.ts` (legacy camelCase → snake_case field adapters)
- Page-metadata flattening: `src/pageMetadataMapping.ts` (nested on-disk record → flat consumer shape)
- Schema exports: `src/schemas/index.ts`

Schemas are authored in **Zod**; the JSON Schema artifacts are generated from those Zod
definitions via `src/schemas/generator.ts` (`zod-to-json-schema`) as a build step — Zod is the
source of truth, not the emitted `.schema.json` files.

## Build

```bash
pnpm --filter @atls/spec build
```

This compiles TypeScript and generates JSON schema artifacts via `dist/schemas/generator.js`.

## Test

```bash
pnpm --filter @atls/spec test
```

## The Atlas Format Specification

The comprehensive, code-verified format spec lives in [`SPECIFICATION.md`](./SPECIFICATION.md)
(the index) and [`docs/`](./docs/):

- [Archive Structure](./docs/archive-structure.md) — ZIP layout, root files, dataset parts, blobs
- [Storage & Encoding](./docs/storage-and-encoding.md) — JSONL, Zstandard, blob addressing, hashing
- [Identity & Keys](./docs/identity-and-keys.md) — `page_id` join model, per-dataset keys
- [Versioning & Compatibility](./docs/versioning.md) — version axes, `specLevel`, compat rules
- [Root Metadata Files](./docs/root-files.md) — manifest / summary / capabilities / provenance fields
- [Dataset Reference](./docs/datasets.md) — all 19 datasets, every field, presence-by-mode
- [Schema System](./docs/schema-system.md) — Zod source, codegen, coverage gaps
- [Reading Archives](./docs/reading-archives.md) — correct reading + the SDK caveat + workaround

## Notes

- For the formal contract, start at [`SPECIFICATION.md`](./SPECIFICATION.md).
- Archived legacy docs are available at `legacy/v1/`.

---

_Last verified against codebase: 2026-06-04 (package version `1.0.0-rc.1`)._
