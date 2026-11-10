# atls

The **Atlas** archive format (`.atls`): specification, JSON Schemas, TypeScript types, and a read-side SDK.

An `.atls` file is a zip archive of compressed JSON Lines datasets plus content-addressed blobs, produced by crawl/analysis tooling and designed to be read back losslessly. This repository defines the format (spec 1.3, schema tag `2026-09-04`) and provides the reference reader. Spec 1.3 is additive: archives stamped 1.1 and 1.2 stay valid. The Zod schemas are authoritative when the prose disagrees. Decisions for this edition are in [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md). Conformance archives are in [`conformance/`](conformance/README.md). The package release is `26.11.2`. That date says when the tooling shipped. It is separate from the format version. Install that release from GitHub, below. See [`docs/VERSIONING.md`](docs/VERSIONING.md).

## Packages

| Package | Description |
|---|---|
| [`@caifrazier/atls-spec`](packages/atls-spec) | The Atlas format specification: Zod schemas, generated JSON Schemas, TypeScript types, and validators. |
| [`@caifrazier/atls-sdk`](packages/atls-sdk) | TypeScript SDK for reading and validating `.atls` archives. |

`@caifrazier/atls-sdk` depends on `@caifrazier/atls-spec` at the same version. Everything else (crawlers, apps) depends on these packages.

## Install

Install the current release from the GitHub Release tarballs. `npm pack` names them `caifrazier-atls-spec-26.11.2.tgz` and `caifrazier-atls-sdk-26.11.2.tgz`. Installing both in one command makes the SDK's `@caifrazier/atls-spec` dependency resolve to the spec tarball.

```bash
npm install https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-spec-26.11.2.tgz https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-sdk-26.11.2.tgz
```

npm currently has only the old 1.0.0-rc.1 release candidate. Use the GitHub release.

`pnpm add` of those two tarballs still requests `@caifrazier/atls-spec@26.11.2` from the registry, and that version is not there. For pnpm, depend on both tarball URLs and override the spec package with the spec tarball:

```json
{
  "dependencies": {
    "@caifrazier/atls-spec": "https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-spec-26.11.2.tgz",
    "@caifrazier/atls-sdk": "https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-sdk-26.11.2.tgz"
  },
  "pnpm": {
    "overrides": {
      "@caifrazier/atls-spec": "https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-spec-26.11.2.tgz"
    }
  }
}
```

Then run `pnpm install`.

To build this repository instead, clone it and run the development commands below.

## Development

```bash
pnpm install
pnpm build      # builds @caifrazier/atls-spec then @caifrazier/atls-sdk (topological order)
pnpm test       # runs the full test suite
```

Requires Node ≥ 20 and pnpm ≥ 9.

## Publish

Both packages release together on the date-based version `YY.M.W`. A weekly tag such as `v26.11.2` builds, tests, packs both packages, and creates a GitHub Release with the two tarballs. npm publish in that workflow runs only when the `NPM_TOKEN` secret is set. A hotfix tag such as `v26.11.2-b` matches the same `v*.*.*` trigger and stops. It does not create a release, and it does not publish to npm. A local `npm publish` is the fallback and does not attach provenance. Publishing is documented in [RELEASING.md](./RELEASING.md) and [docs/VERSIONING.md](./docs/VERSIONING.md).

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
