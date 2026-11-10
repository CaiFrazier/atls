# Identity & Keys

How records identify themselves and how to join across datasets. Identifier checks below are what
the Zod schemas enforce. Producer conventions that the schemas do not check are noted as
conventions, not as format rules. See [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).

_Verified against the Zod schemas on 2026-11-10._

---

## The join model

Atlas is a **multi-dataset, page-keyed** format. A single crawled page produces records spread
across many datasets (`page_metadata`, `navigation`, `content`, `responses`, `accessibility`, …).
Those records are tied together by a shared **`pageId`**, not by URL.

> Always join on `pageId`, never on `url`. A URL can appear in redirect chains, be normalized
> differently, or repeat; `pageId` is the stable identity for "this captured page."
>
> Concretely: on a redirected page, `page_metadata.url` is the **final** URL while
> `responses.url` is the **request** URL (`responses.finalUrl` holds the final one). A
> `page_metadata.url → responses.url` join silently drops every redirected page. If you must
> key by URL (e.g. joining archives from different crawls), index responses by *both* `url`
> and `finalUrl`.

```
page_metadata.pageId ─┬─ navigation.pageId
                       ├─ content.pageId
                       ├─ responses.pageId
                       ├─ accessibility.pageId
                       ├─ assets.pageId
                       └─ … (every page-scoped dataset)
```

---

## `pageId`

- A UUID generated per page, per crawl. Schemas that require it use `z.string().uuid()`, which
  accepts any UUID version. A UUID v7 producer convention is not a schema constraint.
- Stable **within an archive**: every dataset record for the same captured page carries the same
  `pageId`.
- **Not stable across crawls.** The same URL crawled twice gets two different `pageId`s. To align
  pages across archives (temporal diffs, cross-mode joins) match on `url`/normalized URL, not
  `pageId`. The SDK's cross-mode index does exactly this — see
  [reading-archives.md](./reading-archives.md).
- `quarantine.pageId` is a plain string, because the quarantined record may already be malformed.

---

## `crawlId`

- Identifies the crawl run. The manifest field is `crawlId` (camelCase, optional string).
  Operational datasets that carry it include `events`, `sitemaps`, `sitemap_urls`, `extraction`,
  and `quarantine`.
- The schema does not constrain the spelling. A hex string or `crawl_<timestamp>_<random>` is a
  producer convention, not a format rule.

---

## `datasetId`

- Optional string on `manifest.json` (`datasetId`, camelCase). The schema does not require 16 hex
  characters.
- Used to identify the archive as a unit (for example compare/diff compatibility). A 16-hex
  derivation is a producer convention, not a format rule.

---

## Datasets that are *not* page-keyed

A few datasets are operational or record-scoped and use their own primary key instead of (or in
addition to) `pageId`:

| Dataset | Primary key (what the schema checks) | Page link | Notes |
|---|---|---|---|
| `events` | `eventId` (`z.string()`) | `pageId` (optional UUID) | Operational telemetry; also carries `crawlId`. |
| `resources` | `resId` (`z.string().uuid()`, any version) | `ownerPageId` | Sub-resource network log. There is no `pageId` on this record. |
| `sitemaps` | `sitemapId` (`z.string()`) | — | Discovery-phase; carries `crawlId`, not `pageId`. |
| `assets` | `assetId` (`z.string().min(1)`) | `pageId` (UUID) | A UUID v5 producer convention is not a schema constraint. |
| `quarantine` | `quarantineId` (UUID) | `pageId` (optional string) | Forensic dataset for records that failed validation; carries `crawlId`. |
| `frontier_ledger` | `url` | `pageId` (optional UUID) | URL-keyed discovery accounting. `pageId` is set when the URL was visited. |
| `pipeline_failures` / `pipeline_alerts` | `url` + `occurredAt` | `pageId` (optional UUID) | `pageId` is absent when the failure happened before a page id existed. |

`resources` is the one to watch: its page link is **`ownerPageId`**, not `pageId`
(`resources.schema.ts`).

---

## UUID versions

The schemas do not pin a UUID version. `z.string().uuid()` accepts any version. `eventId` and
`sitemapId` are plain strings. `assetId` is a non-empty string.

A producer may still emit UUID v7 for `pageId`, UUID v5 for `assetId`, and UUID v4 for `resId`.
That is a convention. Archives that use another version remain schema-valid. See
[OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).

---

## URL keys

`manifest.hashing.urlKeyAlgo` is a required string. The current edition's documented value is
`sha1`. The normalization steps that feed that digest are not specified in this edition. The
manifest block that records normalization flags is `manifest.urlNormalization` (camelCase block,
snake_case inner keys). See [root-files.md](./root-files.md) and
[OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).

---

_Last verified against the Zod schemas: 2026-11-10._
