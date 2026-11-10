# Releasing

`@caifrazier/atls-spec` and `@caifrazier/atls-sdk` publish together at the same version. That version is the date-based package release `YY.M.W` in [docs/VERSIONING.md](./docs/VERSIONING.md). The current release is `26.11.2`. The spec contract stays `1.3.0`. `atlasVersion` stays `1.3`. `formatVersion` stays `1.3.0`. The schema tag stays `2026-09-04`. Publish the spec package first. The SDK depends on that exact spec version.

`.npmrc` sets `link-workspace-packages=true`, so a local install uses this repo's spec package. `npm pack` still records the dependency as the version in `packages/atls-sdk/package.json` (`26.11.2`).

Nothing in this repository publishes on its own. A tag push runs `.github/workflows/publish.yml`. A laptop publish is the fallback when Actions cannot run. The packages are not yet on npm. Publishing is documented in this file and in [docs/VERSIONING.md](./docs/VERSIONING.md).

## Cut a release

1. `pnpm version:set` writes today's `YY.M.W` into both packages and into the SDK dependency. `pnpm version:set -- --date=YYYY-MM-DD` pins the calendar day. The command refuses a version that already exists as the git tag `v<version>`, unless you pass `--force`.
2. Add a changelog entry for that version in both packages.
3. Tag the release commit `v26.11.2` and push the tag.

```bash
pnpm version:set
pnpm version:check
git tag v26.11.2
git push origin v26.11.2
```

`version:check` exits 1 unless both packages, and the SDK dependency on `@caifrazier/atls-spec`, equal the weekly version for the packager's local date.

A build later in the same week is a hotfix. `pnpm version:set -- --hotfix` writes the next letter (`26.11.2-b`, then `26.11.2-c`). The first build of a new week is that week's release, so `--hotfix` refuses a week that has no release yet. Tag a hotfix `v26.11.2-b` when you want the tag in git. `version:check` expects the unsuffixed weekly version, so a hotfix prerelease fails it. Confirm the two `package.json` versions and the SDK dependency equal the lettered version before you push that tag.

Only a weekly release is published, on npm's `latest` tag. A hotfix tag matches the workflow trigger `v*.*.*` and is not published. Do not `npm publish` a hotfix from a laptop. That would put the prerelease on `latest`.

## Tag publish (provenance)

The workflow runs on a tag that matches `v*.*.*`, for example `v26.11.2` or `v26.11.2-b`.

1. Both `package.json` versions equal the tag without the leading `v`, and the SDK dependency on `@caifrazier/atls-spec` is that same version. The workflow exits if they differ.
2. A tag that contains a hyphen is a hotfix. The workflow stops after that check and does not publish.
3. A weekly tag installs with pnpm 9, builds, and tests on Node 22.
4. It publishes `@caifrazier/atls-spec`, then `@caifrazier/atls-sdk`, with `npm publish --access public --provenance`. That publish updates the `latest` tag.

Provenance needs a public GitHub repository and the workflow permission `id-token: write`. That permission is not a secret. The publish itself authenticates with the repository secret `NPM_TOKEN` (`NODE_AUTH_TOKEN` in the workflow).

`NPM_TOKEN` must be an npm granular access token, or a classic automation token, that can publish `@caifrazier/atls-spec` and `@caifrazier/atls-sdk`. It must not require an interactive one-time password. Actions cannot enter one. Store it under Settings, Secrets and variables, Actions, as `NPM_TOKEN`.

Create the tag from the commit you intend to release, then push the tag:

```bash
git tag v26.11.2
git push origin v26.11.2
```

Each package's `prepublishOnly` script builds and tests again before `npm publish` packs the tarball.

GitHub Actions billing can block this workflow. When it does, use the manual steps below. A manual publish does not attach npm provenance. Provenance is only minted from a supported CI run.

## Manual publish (no provenance)

Publish a weekly release only. From a clean checkout of the release commit, with Node 20 or newer and pnpm 9 or newer:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm version:check
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

Do not pass `--provenance` from a laptop. npm rejects that outside GitHub Actions or GitLab CI. Do not publish a version that contains a hyphen.

Confirm both versions on the registry before telling consumers to upgrade:

```bash
npm view @caifrazier/atls-spec version
npm view @caifrazier/atls-sdk version
npm view @caifrazier/atls-sdk dependencies
```

The SDK dependency on `@caifrazier/atls-spec` must be the version you just published.
