# Versioning

Atlas keeps two version kinds. They answer different questions.

## Package release

`@caifrazier/atls-spec` and `@caifrazier/atls-sdk` share one package version. It says when the tooling shipped. An archive does not store it.

The version is `YY.M.W`.

- `YY` is the two-digit year.
- `M` is the month, with no zero padding. January is `1`.
- `W` is the week of the month, `ceil(dayOfMonth / 7)`. Days 1–7 are week 1, days 8–14 are week 2, days 15–21 are week 3, days 22–28 are week 4, and days 29–31 are week 5.

`26.11.2` is the release for November 10, 2026: year 26, November, week 2. The packager uses its local calendar day. Pass `--date=YYYY-MM-DD` to use another day.

At most one release each week is published. A build between weekly releases is a lettered hotfix of that week's release. The weekly release is implicitly `a` and is written `26.11.2`. The next build that week is the semver prerelease `26.11.2-b`, then `26.11.2-c`. `version:set --hotfix` writes the next letter. The first build of a new week is that week's release. It is never a hotfix of the previous week.

Only the weekly release is published, on npm's `latest` tag. A hotfix is not published. A tag such as `v26.11.2-b` still matches the publish workflow's `v*.*.*` trigger. The workflow checks that the tag matches both package versions, then stops without publishing.

`node scripts/version.mjs label 26.11.2-b` prints `26.11.2b`.

`1.2.0` and the `1.3.x` package versions (`1.3.0` and `1.3.1`) were the last counter-based package versions. Those numbers were the same as the spec contract. A package release no longer tracks that contract. `1.2.0` is the last of those versions on npm. `1.3.0` and `1.3.1` were not published.

## Format version

The format version says what an archive may contain. It is stamped in the manifest. It moves only when the format changes. Within 1.x those changes are additive: a later 1.x reader still reads an earlier 1.x archive, and a 1.x reader ignores fields and datasets it does not know.

| Stamp | Current value | Constant |
|---|---|---|
| `atlasVersion` | `1.3` | `ATLAS_VERSION` |
| `formatVersion` | `1.3.0` | `ATLAS_FORMAT_VERSION` |
| `specVersion` | `1.3.0` | `ATLAS_SPEC_VERSION` |

A writer stamps `1.3` / `1.3.0` only when the archive emits a spec 1.3 field. Archives stamped 1.0, 1.1, and 1.2 stay valid. The reference reader accepts every `formatVersion` major 1 and refuses other majors. The field rules are in [the format versioning chapter](../packages/atls-spec/docs/versioning.md).

`schemaVersion` is a third identifier. The current schema tag is `2026-09-04` (`ATLAS_SCHEMA_VERSION`). It names the dataset-schema edition a producer writes into the manifest. The manifest schema accepts any string there. The tag is independent of the package release and of the format version.

## Compatibility promise

Shipping a package release leaves the archive stamps where they are. `26.11.2` keeps `atlasVersion` at `1.3`, `formatVersion` and `specVersion` at `1.3.0`, and the schema tag at `2026-09-04`. Readers keep accepting every archive whose `formatVersion` major is 1. A format change is a change to those stamps. Within 1.x it adds optional fields and datasets.

An archive's `compatibility.minSdkVersion` is a request about the reader package, compared as `major.minor.patch`. A date-based SDK version such as `26.11.2` still satisfies a `1.x` minimum. The prerelease letter on a hotfix is ignored in that comparison.

## Commands

From the repository root:

| Command | What it does |
|---|---|
| `pnpm version:next` | Print the weekly version for the local date. |
| `pnpm version:next -- --date=YYYY-MM-DD` | Print the weekly version for that calendar day. |
| `pnpm version:check` | Exit 1 unless both packages, and the SDK dependency on `@caifrazier/atls-spec`, equal that weekly version. A hotfix prerelease fails this check. |
| `pnpm version:set` | Write that weekly version into both `packages/*/package.json` files and the SDK dependency, in one step. |
| `pnpm version:set -- --hotfix` | Write the next hotfix letter for that week. |
| `pnpm version:set -- --force` | Write the version even when the git tag `v<version>` already exists. |
| `node scripts/version.mjs label 26.11.2-b` | Print `26.11.2b`. |

`version:set` refuses to write a version that already exists as the git tag `v<version>`, unless `--force` is set. `--force` does not turn the first build of a week into a hotfix.

How to cut a release is in [RELEASING.md](../RELEASING.md).
