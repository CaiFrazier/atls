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
| `atlasVersion` | required string matching `^v?\d+(\.\d+)?$` | `"1.3"` | Public Atlas line. `"1.1"` and `"1.2"` remain valid. A writer stamps `"1.3"` only when the archive emits a spec 1.3 field. |
| `formatVersion` | required string | `"1.3.0"` | Archive container version. The reference reader accepts any major `1` and refuses other majors. |
| `specVersion` | optional string | `"1.3.0"` | Specification contract version. Strict validation is what requires it to be present. |
| `schemaVersion` | optional string | `"2026-09-04"` | Date-stamped dataset-schema tag. Any string validates. Spec 1.2 does not change this tag. |
| `generator` | required string | _(producer-defined)_ | Producer id and version. The schema does not constrain the spelling. |

The current-edition column is what this specification documents for archives stamped
`2026-09-04`. It is not a reject-list. Fixtures and older archives may legally carry `"1.0"` /
`"1.0.0"` and an older `schemaVersion`; the reference reader treats every `formatVersion` major
`1` the same.

---

## Separate the archive stamps from the package release

These identifiers move on their own:

1. **`schemaVersion`** (`"2026-09-04"`) is a **date-stamped tag a producer writes into the
   manifest**. It names the dataset-schema edition. The reference reader copies it onto
   `describeArchive().schemaVersion` and does not branch on it.

2. **The format version** is what an archive may contain. The current stamps are `atlasVersion`
   `"1.3"`, `formatVersion` `"1.3.0"`, and `specVersion` `"1.3.0"` (`ATLAS_VERSION`,
   `ATLAS_FORMAT_VERSION`, `ATLAS_SPEC_VERSION`). A writer stamps 1.3 only when the archive emits
   a spec 1.3 field. Readers accept every `formatVersion` major 1. Within 1.x the format changes
   by addition.

3. **The package release** (`26.11.2` on `@caifrazier/atls-spec` and `@caifrazier/atls-sdk`) says
   when that tooling shipped. It is a date-based `YY.M.W` version. An archive does not store it.
   `1.2.0` and the `1.3.x` package versions were the last counter-based ones. See
   [Package versioning](https://github.com/CaiFrazier/atls/blob/main/docs/VERSIONING.md).

A reader uses the manifest stamps to reason about an archive. Read `manifest.schemaVersion`,
`manifest.atlasVersion`, `manifest.formatVersion`, and `manifest.specVersion`.

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

Spec 1.2 set `ATLAS_SPEC_VERSION` to `1.2.0`, `ATLAS_FORMAT_VERSION` to `1.2.0`, and
`ATLAS_VERSION` to `1.2`. `ATLAS_SCHEMA_VERSION` stays `2026-09-04`. The current constants are
spec 1.3. The changelog is [CHANGELOG.md](../CHANGELOG.md).

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

## Spec 1.3

`ATLAS_SPEC_VERSION` is `1.3.0`. `ATLAS_FORMAT_VERSION` is `1.3.0`. `ATLAS_VERSION` is `1.3`.
`ATLAS_SCHEMA_VERSION` stays `2026-09-04`. Spec 1.3 adds optional fields and one optional
dataset. It does not rename a 1.2 field and it does not add a value to an enum that a 1.2
reader parses strictly.

A writer stamps `atlasVersion` `1.3`, `formatVersion` `1.3.0`, and `specVersion` `1.3.0` only
when the archive emits a spec 1.3 field. Those fields are:

- the `robots` dataset
- `manifest.robotsPolicy` keys `mode`, `modeSource`, `failClosed`, `retryAttempts`, and `keepLastGood`
- `frontier_ledger.skipSource` and `frontier_ledger.matchedRobotsRule`
- `summary.crawlContext.endReason` and `summary.crawlContext.skippedByReason`

`frontier_ledger.skipReason` is already an open string. `ROBOTS_DISALLOWED` and
`ROBOTS_UNREACHABLE` are spellings a 1.3 writer uses. They are not new fields, and they are
not new enum values. A 1.2 reader that accepts any string accepts them. A writer that emits
only those strings, and none of the fields in the list above, does not have to stamp 1.3.

`contentSha256` for spec 1.3 is the spec 1.2 rule: UTF-8 byte order. `integrityEdition` returns
the label `"1.2"` for every minor of 2 or higher. That label names the byte-order rule.

New 1.3 counters use null when the producer did not measure the count and 0 when it measured
zero. A missing key is not a zero. `skippedByReason` on the summary follows that rule. On a
robots row, `responses429` and `responses5xx` follow it too, and they count the page responses
received from that origin during the crawl. They do not count fetches of robots.txt.

A writer that emits the `robots` dataset settles each origin's robots outcome, retries included,
before fetching that origin's first page, and uses that copy for the rest of the crawl. The
dataset has one row per origin. `frontier_ledger.matchedRobotsRule` stays a string. The
recommended form is `<Directive>: <pattern>`, for example `Disallow: /cart`.

The meanings of `robotsPolicy.mode`, `robotsPolicy.modeSource`, and `robotsPolicy.failClosed`
stay stable across 1.3.x. The applied-body digest stays stable across 1.3.x. It is the hash in
`robots.bodyBlobRef` when that ref stores the applied body. When `bodySource` is `lastGood`,
that stored body is the last-good copy, so the digest is the `bodyBlobRef` hash.
`lastGoodBodySha256` is a last-good digest that is not the stored body. A null `bodyBlobRef`
means no body was stored, and that null does not depend on `fetchStatus`.

`validate()` enforces the spec 1.2 writer rules when `atlasVersion` is 1.2 or later, including
1.3. Those rules are: omit `integrity.archiveSha256` and `integrity.auditHash`; accept
`contentSha256` only in UTF-8 byte order; reject the legacy `blobs/sha256/<2>/<2>/<hash>.zst`
spelling in records; allow only `urlNormalization.trailing_slash` set to `append-unless-file`;
and require `assetId` to be the UUID v5 of `normalizeUrl(assetUrl)`. An archive stamped 1.1 or
earlier keeps the lenient checks. Blob readers still resolve the legacy spelling.

## 1.2 to 1.3

1.1 archives and 1.2 archives remain valid. A reader accepts every `formatVersion` major 1.
A 1.2 reader ignores unknown fields and unknown datasets. The conformance archive
`minimal-valid-1.3.atls` is the case a 1.2 reader reads.

| Topic | 1.3 archive | 1.2 reader |
|---|---|---|
| `robots/` | Optional dataset, one row per origin | Ignore the directory. `page_metadata` still reads. |
| `robotsPolicy` | May add `mode`, `modeSource`, `failClosed`, `retryAttempts`, `keepLastGood` | The 1.2 schema strips unknown keys and still requires `respect` and `overridesUsed` when the object is present. A 1.3 writer that wants that parse to succeed keeps those two booleans. A 1.3-only object is valid in 1.3 and fails that 1.2 schema. |
| `capabilities.robots` | Unchanged (`respectsRobotsTxt`, `overrideUsed`) | Unchanged. |
| `summary.crawlContext.endReason` | Optional. Maps onto the existing `completionReason` when both are present | Strip the key. `completionReason` is unchanged and still required. |
| `summary.crawlContext.skippedByReason` | Optional record, or null when not measured | Strip the key. |
| `frontier_ledger.skipReason` | Open string. New spellings `ROBOTS_DISALLOWED` and `ROBOTS_UNREACHABLE` | Accept any string. The field was not a closed enum, so it was not widened. |
| `frontier_ledger.skipSource`, `matchedRobotsRule` | Optional | Strip the keys. |
| `contentSha256` | UTF-8 byte order, same as 1.2 | Byte order only, because the minor is 2 or higher. |

---

_Last verified against `AtlasManifestV1Schema` and `src/edition.ts`: 2026-11-10._
