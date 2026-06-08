# atls

The **Atlas** archive format (`.atls`) — specification, JSON Schemas, TypeScript types, and a read-side SDK.

An `.atls` file is a zip archive of compressed NDJSON datasets plus content-addressed blobs, produced by crawl/analysis tooling and designed to be read back losslessly. This repository defines the format and provides the canonical reader.

## Packages

| Package | Description |
|---|---|
| [`@atls/spec`](packages/atls-spec) | The Atlas v1.0 specification: Zod schemas, generated JSON Schemas, TypeScript types, and validators. |
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

License is being finalized for public release. Until a `LICENSE` file is added,
all rights are reserved by Cai Frazier.
