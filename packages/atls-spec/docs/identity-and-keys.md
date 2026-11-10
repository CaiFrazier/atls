# Identity & Keys

How records identify themselves and how to join across datasets. Identifier versions below are
what spec 1.2 writers emit. The Zod schemas still accept other UUID versions so spec 1.1 archives
validate. See [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md).

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

- A UUID version 7 (RFC 9562), generated per page, per crawl. It is time-ordered and not derived
  from the URL. The same URL crawled twice gets two different `pageId`s. Schemas that require a
  page id use `z.string().uuid()`, which accepts any version, so a 1.1 archive that used another
  version still validates. Spec 1.2 writers emit version 7.
- Stable within an archive: every dataset record for the same captured page carries the same
  `pageId`.
- Not stable across crawls. To align pages across archives, match on the normalized URL
  (`normalizeUrl` in [url-identity.md](./url-identity.md)), not on `pageId`.
- `quarantine.pageId` is a plain string, because the quarantined record may already be malformed.

---

## `crawlId`

- Identifies the crawl run. The manifest field is `crawlId` (camelCase, optional string).
  Operational datasets that carry it include `events`, `sitemaps`, `sitemap_urls`, `extraction`,
  and `quarantine`.
- The value is opaque. Spec 1.2 writers should use a UUID version 7. Spec 1.1 often used
  `crawl_<timestamp>_<random>`. Readers do not parse the spelling. Resume may reuse an existing id.

---

## `datasetId`

- Optional string on `manifest.json` (`datasetId`, camelCase).
- Spec 1.2 definition: the first 16 lowercase hex characters of SHA-256 of `JSON.stringify` of
  `{ crawlId, crawlStartedAt, origin, seeds }`, with keys in that order. `seeds` are sorted by
  UTF-16 code unit and are not passed through `normalizeUrl`. `origin` is the first seed's
  `URL.origin`. Readers do not recompute the id as a validity check. The schema does not require
  16 hex characters, so older ids still validate.
- For seeds `https://Example.com/about` and `https://example.com/`, crawl id `crawl_vector`,
  start `2026-01-02T03:04:05.000Z`, and origin `https://example.com`, the id is
  `765c90de198faa64`.

---

## Datasets that are *not* page-keyed

A few datasets are operational or record-scoped and use their own primary key instead of (or in
addition to) `pageId`:

| Dataset | Primary key (what the schema checks) | Page link | Notes |
|---|---|---|---|
| `events` | `eventId` (string; writers use UUID v7) | `pageId` (optional UUID) | Operational telemetry; also carries `crawlId`. |
| `resources` | `resId` (UUID v4; the schema accepts any UUID version) | `ownerPageId` | Sub-resource network log. There is no `pageId` on this record. |
| `sitemaps` | `sitemapId` (string; writers use UUID v7) | none | Discovery-phase; carries `crawlId`, not `pageId`. |
| `assets` | `assetId` (UUID v5 of the normalized asset URL; see below) | `pageId` (UUID) | Spec 1.1 hashed the raw URL. The schema accepts any non-empty string. |
| `quarantine` | `quarantineId` (UUID; writers use UUID v7) | `pageId` (optional string) | Forensic dataset for records that failed validation; carries `crawlId`. |
| `frontier_ledger` | `url` | `pageId` (optional UUID) | URL-keyed discovery accounting. `pageId` is set when the URL was visited. |
| `pipeline_failures` / `pipeline_alerts` | `url` + `occurredAt` | `pageId` (optional UUID) | `pageId` is absent when the failure happened before a page id existed. |

`resources` is the one to watch: its page link is **`ownerPageId`**, not `pageId`
(`resources.schema.ts`).

---

## UUID versions

Spec 1.2 writers use these versions. The schemas do not reject other versions, so a 1.1 archive
stays valid. Readers do not fail an archive solely because a UUID version nibble differs.

| Version | Used for | Rule |
|---|---|---|
| UUID v7 | `pageId`, `eventId`, `sitemapId`, `quarantineId`, and new `crawlId` values | `pageId` is crawl-local. It is not stable across crawls. |
| UUID v5 | `assetId` | RFC 4122 URL namespace over `normalizeUrl(assetUrl)`, from spec 1.2. Spec 1.1 hashed the raw URL. |
| UUID v4 | `resId` | Random per captured sub-resource. |

`eventId` and `sitemapId` are plain strings in the schema. `assetId` is a non-empty string.
`resId` is `z.string().uuid()`.

---

## URL keys

`urlKey` is the lowercase SHA-256 hex of `normalizeUrl(url)`. It is derived, not stored on
`page_metadata`. The algorithm, the file-extension allowlist, the single
`urlNormalization.trailing_slash` field, and the `page_metadata.url` / `responses.url` redirect
rules are in [url-identity.md](./url-identity.md).

`manifest.hashing.urlKeyAlgo` is `sha256` for a spec 1.2 writer. A 1.1 archive may say `sha1`.
That field names the algorithm. It is not the key. Spec 1.1 used SHA-1 and did not store the
digest, so the move to SHA-256 does not change bytes already in archives.

---

_Last verified against the Zod schemas and `src/urlIdentity.ts`: 2026-11-10._
