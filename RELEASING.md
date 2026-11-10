# Releasing

`@caifrazier/atls-spec` and `@caifrazier/atls-sdk` publish together at the same version. The package version is `1.3.1`. The spec contract stays `1.3.0`. Do not publish one package ahead of the other. Publish the spec package first. The SDK depends on that exact spec version. Package 1.3.1 is not published by this change.

`.npmrc` sets `link-workspace-packages=true` so a local install uses this repo's spec package before `1.3.1` exists on the registry. `npm pack` still records the dependency as `1.3.1`.

Nothing in this repository publishes on its own. A tag push runs `.github/workflows/publish.yml`. A laptop publish is the fallback when Actions cannot run.

## Tag publish (provenance)

The workflow runs on a tag that matches `v*.*.*`, for example `v1.2.0`.

1. Both `package.json` versions equal the tag without the leading `v`. The workflow exits if they differ.
2. It installs with pnpm 9, builds, and tests on Node 22.
3. It publishes `@caifrazier/atls-spec`, then `@caifrazier/atls-sdk`, with `npm publish --access public --provenance`.

Provenance needs a public GitHub repository and the workflow permission `id-token: write`. That permission is not a secret. The publish itself authenticates with the repository secret `NPM_TOKEN` (`NODE_AUTH_TOKEN` in the workflow).

`NPM_TOKEN` must be an npm granular access token, or a classic automation token, that can publish `@caifrazier/atls-spec` and `@caifrazier/atls-sdk`. It must not require an interactive one-time password. Actions cannot enter one. Store it under Settings, Secrets and variables, Actions, as `NPM_TOKEN`.

Create the tag from the commit you intend to release, then push the tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

Each package's `prepublishOnly` script builds and tests again before `npm publish` packs the tarball.

GitHub Actions billing can block this workflow. When it does, use the manual steps below. A manual publish does not attach npm provenance. Provenance is only minted from a supported CI run.

## Manual publish (no provenance)

From a clean checkout of the release commit, with Node 20 or newer and pnpm 9 or newer:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
```

Inspect both tarballs. They should contain `dist` (JavaScript, `.d.ts`, and for the spec package the generated JSON Schemas), `README.md`, `LICENSE`, `NOTICE`, and `CHANGELOG.md`. They should not contain tests, fixtures, `src/`, or `*.map` files.

```bash
npm pack --dry-run --workspace @caifrazier/atls-spec
npm pack --dry-run --workspace @caifrazier/atls-sdk
```

Log in, or export `NODE_AUTH_TOKEN` / `NPM_TOKEN`, then publish in this order:

```bash
npm publish --access public --workspace @caifrazier/atls-spec
npm publish --access public --workspace @caifrazier/atls-sdk
```

Do not pass `--provenance` from a laptop. npm rejects that outside GitHub Actions or GitLab CI.

Confirm both versions on the registry before telling consumers to upgrade:

```bash
npm view @caifrazier/atls-spec version
npm view @caifrazier/atls-sdk version
npm view @caifrazier/atls-sdk dependencies
```

The SDK dependency on `@caifrazier/atls-spec` must be the version you just published.
