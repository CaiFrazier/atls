# atls

The **Atlas** archive format (`.atls`) — specification, JSON Schemas, TypeScript types, and a read-side SDK.

An `.atls` file is a zip archive of compressed JSON Lines datasets plus content-addressed blobs, produced by crawl/analysis tooling and designed to be read back losslessly. This repository defines the format (spec 1.2, schema tag `2026-09-04`) and provides the reference reader. The Zod schemas are authoritative when the prose disagrees. Decisions for this edition are in [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md). Conformance archives are in [`conformance/`](conformance/README.md).

## Packages

| Package | Description |
|---|---|
| [`@caifrazier/atls-spec`](packages/atls-spec) | The Atlas format specification: Zod schemas, generated JSON Schemas, TypeScript types, and validators. |
| [`@caifrazier/atls-sdk`](packages/atls-sdk) | TypeScript SDK for reading and validating `.atls` archives. |

`@caifrazier/atls-sdk` depends on `@caifrazier/atls-spec`. Everything else (crawlers, apps) consumes these as published dependencies.

## Development

```bash
pnpm install
pnpm build      # builds @caifrazier/atls-spec then @caifrazier/atls-sdk (topological order)
pnpm test       # runs the full test suite
```

Requires Node ≥ 20 and pnpm ≥ 9.

## License

Dual-licensed, by design — anyone can read, write, and build tooling around the
`.atls` format:

- **Code** (`@caifrazier/atls-spec`, `@caifrazier/atls-sdk`, and all source) — **Apache License 2.0**
  ([`LICENSE`](./LICENSE)).
- **The Atlas specification & JSON Schemas** — additionally **CC BY 4.0**
  ([`LICENSE-SPEC.md`](./LICENSE-SPEC.md)).

Trademarks ("Atlas", etc.) are not licensed by either grant — see
[`NOTICE`](./NOTICE). Contributions are accepted under the
[Developer Certificate of Origin](./CONTRIBUTING.md).

Copyright © 2026 Cai Frazier.
