# atls

The **Atlas** archive format (`.atls`) — specification, JSON Schemas, TypeScript types, and a read-side SDK.

An `.atls` file is a zip archive of compressed NDJSON datasets plus content-addressed blobs, produced by crawl/analysis tooling and designed to be read back losslessly. This repository defines the format and provides the canonical reader.

## Packages

| Package | Description |
|---|---|
| [`@atls/spec`](packages/atls-spec) | The Atlas format specification: Zod schemas, generated JSON Schemas, TypeScript types, and validators. |
| [`@atls/sdk`](packages/atls-sdk) | TypeScript SDK for reading and validating `.atls` archives. |

`@atls/sdk` depends on `@atls/spec`. Everything else (crawlers, apps) consumes these as published dependencies.

## Development

```bash
pnpm install
pnpm build      # builds @atls/spec then @atls/sdk (topological order)
pnpm test       # runs the full test suite
```

Requires Node ≥ 20 and pnpm ≥ 9.

## License

Dual-licensed, by design — anyone can read, write, and build tooling around the
`.atls` format:

- **Code** (`@atls/spec`, `@atls/sdk`, and all source) — **Apache License 2.0**
  ([`LICENSE`](./LICENSE)).
- **The Atlas specification & JSON Schemas** — additionally **CC BY 4.0**
  ([`LICENSE-SPEC.md`](./LICENSE-SPEC.md)).

Trademarks ("Atlas", etc.) are not licensed by either grant — see
[`NOTICE`](./NOTICE). Contributions are accepted under the
[Developer Certificate of Origin](./CONTRIBUTING.md).

Copyright © 2026 Cai Frazier.
