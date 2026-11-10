# atls

The **Atlas** archive format (`.atls`): specification, JSON Schemas, TypeScript types, and a read-side SDK.

An `.atls` file is a zip archive of compressed JSON Lines datasets plus content-addressed blobs, produced by crawl/analysis tooling and designed to be read back losslessly. This repository defines the format (spec 1.3, schema tag `2026-09-04`) and provides the reference reader. Spec 1.3 is additive: archives stamped 1.1 and 1.2 stay valid. The Zod schemas are authoritative when the prose disagrees. Decisions for this edition are in [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md). Conformance archives are in [`conformance/`](conformance/README.md). Spec 1.3.0 is not published to npm.

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

## Publish

Both packages release together. See [RELEASING.md](./RELEASING.md). A tag such as `v1.3.0` runs the provenance workflow. That workflow needs the `NPM_TOKEN` Actions secret. A local `npm publish` is the fallback and does not attach provenance. This change does not publish.

## License

Dual-licensed, by design. Anyone can read, write, and build tooling around the
`.atls` format:

- **Code** (`@caifrazier/atls-spec`, `@caifrazier/atls-sdk`, and all source): **Apache License 2.0**
  ([`LICENSE`](./LICENSE)).
- **The Atlas specification and JSON Schemas** are additionally **CC BY 4.0**
  ([`LICENSE-SPEC.md`](./LICENSE-SPEC.md)).

Trademarks ("Atlas", etc.) are not licensed by either grant. See
[`NOTICE`](./NOTICE). Contributions are accepted under the
[Developer Certificate of Origin](./CONTRIBUTING.md).

Copyright © 2026 Cai Frazier.
