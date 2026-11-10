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
| `atlasVersion` | required string matching `^v?\d+(\.\d+)?$` | `"1.1"` | Public Atlas product line. |
| `formatVersion` | required string | `"1.1.0"` | Archive container version. The reference reader accepts any major `1` and refuses other majors. |
| `specVersion` | optional string | `"1.1.0"` | Specification contract version. Strict validation is what requires it to be present. |
| `schemaVersion` | optional string | `"2026-09-04"` | Date-stamped dataset-schema tag. Any string validates. |
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

2. **The `@caifrazier/atls-spec` package version** (`1.0.0-rc.1`, from `package.json`) is the npm
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
  stayed snake_case; see [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).

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

Whether a future edition should preserve unknown keys everywhere, strip them, or reject them is
an open question. This edition does not change the schemas.

`generator` is a required string. This edition does not require a particular prefix.

---

_Last verified against `AtlasManifestV1Schema` and `src/edition.ts`: 2026-11-10._
