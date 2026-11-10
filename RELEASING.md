# Releasing

`@caifrazier/atls-spec` and `@caifrazier/atls-sdk` ship together at the same version. That version is the date-based package release `YY.M.W` in [docs/VERSIONING.md](./docs/VERSIONING.md). The current release is `26.11.2`. The spec contract stays `1.3.0`. `atlasVersion` stays `1.3`. `formatVersion` stays `1.3.0`. The schema tag stays `2026-09-04`. When a run also publishes to npm, publish the spec package first. The SDK depends on that exact spec version.

`.npmrc` sets `link-workspace-packages=true`, so a local install uses this repo's spec package. `npm pack` still records the dependency as the version in `packages/atls-sdk/package.json` (`26.11.2`). The packed file names are `caifrazier-atls-spec-26.11.2.tgz` and `caifrazier-atls-sdk-26.11.2.tgz`.

Nothing in this repository publishes on its own. A tag push runs `.github/workflows/publish.yml`. A weekly tag packs both packages and creates a GitHub Release with those two tarballs. Install the current version with:

```bash
npm install https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-spec-26.11.2.tgz https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-sdk-26.11.2.tgz
```

npm currently has only the old 1.0.0-rc.1 release candidate. Use the GitHub release.

`npm install` of both tarballs resolves the SDK dependency `@caifrazier/atls-spec@26.11.2` to the spec tarball. `pnpm add` of the same two files still requests that version from the registry and fails. For pnpm, depend on both tarball URLs and set `pnpm.overrides` so `@caifrazier/atls-spec` is the spec tarball URL. The [README](./README.md) has that `package.json`. You can also clone this repository and build it with `pnpm install` and `pnpm build`.

A laptop publish is the fallback when Actions cannot run. The steps are in this file and in [docs/VERSIONING.md](./docs/VERSIONING.md).

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

Only a weekly release gets a GitHub Release. A hotfix tag matches the workflow trigger `v*.*.*` and does not. Do not `npm publish` a hotfix from a laptop. That would put the prerelease on `latest`. Do not attach a hotfix tarball to a GitHub Release.

## Tag publish (provenance)

The workflow runs on a tag that matches `v*.*.*`, for example `v26.11.2` or `v26.11.2-b`.

1. Both `package.json` versions equal the tag without the leading `v`, and the SDK dependency on `@caifrazier/atls-spec` is that same version. The workflow exits if they differ.
2. A tag that contains a hyphen is a hotfix. The workflow stops after that check. It does not create a GitHub Release and it does not publish to npm.
3. A weekly tag installs with pnpm 9, builds, and tests on Node 22.
4. It runs `npm pack ./packages/atls-spec` and `npm pack ./packages/atls-sdk` from the repository root. The root `package.json` has no npm `workspaces` field, so `npm pack --workspace` does not see these packages. The tarballs land in the repository root as `caifrazier-atls-spec-<version>.tgz` and `caifrazier-atls-sdk-<version>.tgz`.
5. It creates the GitHub Release for that tag with `gh release create` and `GITHUB_TOKEN`, and attaches both tarballs. The release job has `contents: write`.
6. If `NPM_TOKEN` is set, it publishes from `packages/atls-spec`, then `packages/atls-sdk`, with `npm publish --access public --provenance`. That publish updates the `latest` tag. If `NPM_TOKEN` is absent, the step prints a skip message and exits 0. The GitHub Release is still created.

Provenance needs a public GitHub repository and the workflow permission `id-token: write`. That permission is not a secret. The publish itself authenticates with the repository secret `NPM_TOKEN` (`NODE_AUTH_TOKEN` in the workflow).

`NPM_TOKEN` must be an npm granular access token, or a classic automation token, that can publish `@caifrazier/atls-spec` and `@caifrazier/atls-sdk`. It must not require an interactive one-time password. Actions cannot enter one. Store it under Settings, Secrets and variables, Actions, as `NPM_TOKEN`.

Create the tag from the commit you intend to release, then push the tag:

```bash
git tag v26.11.2
git push origin v26.11.2
```

Each package's `prepublishOnly` script builds and tests again before `npm publish` packs the tarball.

GitHub Actions billing can block this workflow. When it does, use the manual steps below. A manual publish does not attach npm provenance. Provenance is only minted from a supported CI run.

## Manual release (no provenance)

Use this when Actions cannot run. Create the GitHub Release for a weekly tag only. From a clean checkout of the release commit, with Node 20 or newer and pnpm 9 or newer:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm version:check
```

Inspect both tarballs. They should contain `dist` (JavaScript, `.d.ts`, and for the spec package the generated JSON Schemas), `README.md`, `LICENSE`, `NOTICE`, and `CHANGELOG.md`. They should not contain tests, fixtures, `src/`, or `*.map` files.

```bash
npm pack --dry-run ./packages/atls-spec
npm pack --dry-run ./packages/atls-sdk
npm pack ./packages/atls-spec
npm pack ./packages/atls-sdk
```

Create the GitHub Release and attach the tarballs `npm pack` just wrote:

```bash
gh release create v26.11.2 \
  caifrazier-atls-spec-26.11.2.tgz \
  caifrazier-atls-sdk-26.11.2.tgz \
  --title v26.11.2 \
  --notes "Weekly release v26.11.2"
```

npm publish is optional. Skip it when you do not have a token. Log in, or export `NODE_AUTH_TOKEN` / `NPM_TOKEN`, then publish in this order:

```bash
(cd packages/atls-spec && npm publish --access public)
(cd packages/atls-sdk && npm publish --access public)
```

Do not pass `--provenance` from a laptop. npm rejects that outside GitHub Actions or GitLab CI. Do not publish a version that contains a hyphen.

Confirm the release assets before telling consumers to upgrade:

```bash
gh release view v26.11.2
```

If you also published to npm, confirm the registry versions. The SDK dependency on `@caifrazier/atls-spec` must be the version you just published.

```bash
npm view @caifrazier/atls-spec version
npm view @caifrazier/atls-sdk version
npm view @caifrazier/atls-sdk dependencies
```
