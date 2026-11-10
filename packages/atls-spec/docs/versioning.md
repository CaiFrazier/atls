# Versioning & Compatibility

The Atlas format carries several version identifiers that move on independent cadences. Conflating
them is the most common source of reader bugs.

Current schema tag: `2026-09-04`.

That tag is `ATLAS_SCHEMA_VERSION` in `packages/atls-spec/src/edition.ts`. The manifest schema
does not enum-lock it.

---

## The version fields in `manifest.json`

| Field | Schema | Current edition value | Meaning |
|---|---|---|---|
| `atlasVersion` | required string matching `^v?\d+(\.\d+)?$` | `"1.2"` | Public Atlas product line. `"1.1"` remains valid. |
| `formatVersion` | required string | `"1.2.0"` | Archive container version. The reference reader accepts any major `1` and refuses other majors. |
| `specVersion` | optional string | `"1.2.0"` | Specification contract version. Strict validation is what requires it to be present. |
| `schemaVersion` | optional string | `"2026-09-04"` | Date-stamped dataset-schema tag. Any string validates. Spec 1.2 does not change this tag. |
| `generator` | required string | _(producer-defined)_ | Producer id and version. The schema does not constrain the spelling. |

The current-edition column is what this specification documents for archives stamped
`2026-09-04`. It is not a reject-list. Fixtures and older archives may legally carry `"1.0"` /
`"1.0.0"` and an older `schemaVersion`; the reference reader treats every `formatVersion` major
`1` the same.

---

## Two independent axes — do not conflate

1. **`schemaVersion`** (`"2026-09-04"`) is a **date-stamped tag a producer writes into the
   manifest**. It names the dataset-schema edition. The reference reader copies it onto
   `describeArchive().schemaVersion` and does not branch on it.

2. **The `@caifrazier/atls-spec` package version** (`1.2.0`, from `package.json`) is the npm
   semver of the schema package. It is **not** written into archives.

A reader must never use the spec package version to reason about an archive's layout — it isn't in
the archive. Read `manifest.schemaVersion`.

### Quick check

```bash
python3 -c "import zipfile,json; print(json.loads(zipfile.ZipFile('crawl.atls').read('manifest.json'))['schemaVersion'])"
# -> 2026-09-04
```

### `schemaVersion` history

- **`2026-09-04`** (Schema.org audit): adds stable structured-data item ids, typed capture/syntax
  diagnostics, diagnostic links, audit coverage/outcome, and pinned Schema.org vocabulary
  provenance. Adds the `seo.schema_org_audit` capability. The audit reports findings without
  changing captured markup, and remains distinct from Atlas archive integrity validation.
- **`2026-07-23`** (redirect evidence): response records may carry bodiless redirect evidence
  (`isRedirect`, `location`, `redirectType`) with optional encoding and body references.
- **`2026-07-17`** (custom extraction): adds the `extraction` dataset (one record per
  page × consumer-configured rule, with `ruleId`@`ruleVersion` provenance and an
  `ok`\|`empty`\|`error`\|`unavailable-source` status). Additive: archives without rules carry
  neither the dataset nor a rules capability flag.
- **`2026-07-16`** (sitemap completeness): adds the `sitemap_urls` dataset (per-URL entries),
  an optional `truncated` flag on `sitemaps` records, an optional `manifest.sitemapCoverage`
  (`absent`\|`failed`\|`partial`\|`complete`), and the `seo.sitemap_coverage` capability. Additive:
  a reader must treat a missing `sitemapCoverage` or `truncated` as *unknown*, never as
  `false` or `complete`.
- **`2026-07-01`** (camelCase cutover): dataset record fields moved to camelCase. A few names
  stayed snake_case; see [OPEN_QUESTIONS.md](https://github.com/CaiFrazier/atls/blob/main/docs/OPEN_QUESTIONS.md).

---

## `specLevel` and render mode

The manifest's `capabilities.specLevel` (and `summary.crawlContext.specLevel`) is a closed union
`1 | 2 | 3` on the manifest schema. The reference producer derives it from render mode:

| `specLevel` | Render mode | What the reference producer adds |
|---|---|---|
| 1 | `raw` | HTTP-only datasets. |
| 2 | `prerender` | `performance`, deeper `accessibility`, `security`, `structured_data`. |
| 3 | `full` | `render_state`, `resources`, full WCAG/axe in `accessibility`. |

That table is **producer presence policy**. A record set that does not match it still
schema-validates. The policy matrix is in [datasets.md](./datasets.md). The schema accepts any
`specLevel` of 1, 2, or 3 regardless of which dataset directories are present.

---

## What unknown fields do

Unknown-field behavior is per object, because that is how the Zod schemas are written:

- **Kept.** The manifest object itself uses `.passthrough()`, as do `identity`, `scope`,
  `crawlerSettings`, `urlNormalization`, `crawlContext`, `producer`, `environment`,
  `capabilities`, `coverage`, `integrity`, `storage`, `source`, dataset metadata, technology
  records, and navigation edges. Extra keys on those objects survive a successful parse.
- **Stripped.** Zod's default for `z.object` drops unknown keys on success and does not reject
  them. This is what most outer dataset records do, including `page_metadata`, `navigation`,
  `content`, `responses`, `security`, and `accessibility`. `hashing`, `privacyPolicy`, and
  `robotsPolicy` on the manifest also strip.
- **Rejected.** `RecordMetaSchema`, accessibility `landmarks`, and the events `metrics` object
  are `.strict()`. An unknown key there fails validation.

A consumer that only `JSON.parse`s a line sees every key. A consumer that parses with the Zod
schema sees the behavior above. The reference reader's `openAtlas` schema-checks `assets`,
`responses`, and `resources` on read; `validate()` parses a wider set and therefore strips or
rejects according to each schema.

Spec 1.2 decides the interchange rule: a reader ignores unknown fields and does not treat an
unknown key as a format error. The Zod schemas in this package may still be strict when a caller
uses them as validation tooling. `RecordMetaSchema`, accessibility `landmarks`, and events
`metrics` are `.strict()`, so `validate()` reports those unknown keys. That report is tooling.
It is not a requirement that every reader reject the archive. A consumer that only `JSON.parse`s
a line keeps every key. Spec 2.0 may preserve unknown keys on every schema parse. Spec 1.2 does
not change the schemas.

`generator` is a required string. This edition does not require a particular prefix.

---

## Spec 1.2

`ATLAS_SPEC_VERSION` is `1.2.0`. `ATLAS_FORMAT_VERSION` is `1.2.0`. `ATLAS_VERSION` is `1.2`.
`ATLAS_SCHEMA_VERSION` stays `2026-09-04`. The changelog is
[CHANGELOG.md](../CHANGELOG.md).

What 1.2 makes normative, without a new schema tag:

- `contentSha256`, part checksums, and per-blob hashes
- `normalizeUrl` and `urlKey` (SHA-256)
- `urlNormalization.trailing_slash` = `append-unless-file`, with older slash fields informational
- id conventions for new writers (`pageId`, `assetId`, `resId`, `crawlId`, `datasetId`)

No record field is renamed. No directory is renamed. 1.x readers keep accepting the snake_case
keys this schema tag already stores. Camel case for those keys is the spec 2.0 target.

## 1.1 to 1.2

1.1 archives remain valid. A reader accepts every `formatVersion` major 1.

| Topic | 1.1 archive | 1.2 reader |
|---|---|---|
| `contentSha256` path order | `localeCompare` in the process locale | Accept byte order, `en-US` `localeCompare`, or `th` `localeCompare`. For lowercase `part-NNN` paths in `en-US`, the first two are the same digest. |
| `contentSha256` on a 1.2 archive | | Byte order only. |
| `archiveSha256`, `auditHash` | May be absent, or copies of `contentSha256` | Ignore. |
| Blob reference | Canonical or `blobs/.../<hash>.zst` | Accept both. Verify by decompressing, then hashing. |
| `urlKey` | SHA-1, not stored | SHA-256 of `normalizeUrl`. Nothing in the archive changes because the key was not stored. |
| `assetId` | UUID v5 of the raw URL | UUID v5 of the normalized URL for ids minted by a 1.2 writer. Do not recompute 1.1 ids. |
| Slash fields | Three contradictory declarations | Read `trailing_slash` as the declaration. Ignore the old fields. The algorithm does not depend on the field being present. |
| Unknown fields | Kept, stripped, or rejected depending on the schema object | Readers ignore them. |
| Short directories | Some archives use `pages`, `edges`, `failed_pages` | Reader fallback only. 1.2 writers use the long names. |
| `schemaVersion` | `2026-09-04` or older | Still an open string. Do not reject an older tag. |

A 1.2 writer stamps `atlasVersion` `1.2`, `formatVersion` `1.2.0`, `specVersion` `1.2.0`, omits
`archiveSha256` and `auditHash`, sets `hashing.urlKeyAlgo` to `sha256`, and sets
`urlNormalization.trailing_slash` to `append-unless-file`.

---

_Last verified against `AtlasManifestV1Schema` and `src/edition.ts`: 2026-11-10._
