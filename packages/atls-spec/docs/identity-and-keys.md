# Identity & Keys

How records identify themselves and how to join across datasets.

_Verified against `packages/atls-spec/src/schemas/` and the cartographer writer on 2026-06-04._

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

- A **UUID v7** (time-ordered) generated per page, per crawl.
- Stable **within an archive**: every dataset record for the same captured page carries the same
  `pageId`.
- **Not stable across crawls.** The same URL crawled twice gets two different `pageId`s. To align
  pages across archives (temporal diffs, cross-mode joins) match on `url`/normalized URL, not
  `pageId`. The SDK's cross-mode index does exactly this — see
  [reading-archives.md](./reading-archives.md).

In the `responses` schema `pageId` is documented as "Foreign key to page_metadata pageId"
(`responses.schema.ts:16`).

---

## `crawlId`

- Identifies the crawl run. Appears in `manifest.json` (`crawlId`, snake_case), `summary` context,
  and in operational datasets (`events.crawlId`, `sitemaps.crawlId`, `quarantine.crawlId`).
- Format is either a hex string or `crawl_<timestamp>_<random>` depending on how the run was
  started.

---

## `datasetId`

- A short (16-char hex) archive identity derived from the crawl id + origin hash
  (`manifest.json` → `datasetId`, camelCase).
- Used to identify the archive as a unit (e.g. for compare/diff compatibility).

---

## Datasets that are *not* page-keyed

A few datasets are operational or record-scoped and use their own primary key instead of (or in
addition to) `pageId`:

| Dataset | Primary key | Page link | Notes |
|---|---|---|---|
| `events` | `eventId` (UUID v7) | `pageId` (optional) | Operational telemetry; also carries `crawlId`. |
| `resources` | `resId` (UUID v4) | `ownerPageId` | Sub-resource network log; links to the owning page via `ownerPageId`. |
| `sitemaps` | `sitemapId` (UUID v7) | — | Discovery-phase; carries `crawlId`, not `pageId`. |
| `assets` | `assetId` (UUID v5) | `pageId` | `assetId` is deterministic (namespaced), so the same asset on the same page is stable. |
| `quarantine` | `quarantineId` | `pageId` (optional) | Forensic dataset for records that failed validation; carries `crawlId`. |
| `frontier_ledger` | `url` (natural key) | — | Discovery accounting; keyed by discovered URL. |
| `pipeline_failures` / `pipeline_alerts` | none | — | Operational ledgers keyed by `url` + `occurredAt`; no UUID. |

`resources` is the one to watch: its page link is **`ownerPageId`**, not `pageId`
(`resources.schema.ts`).

---

## UUID versions in use

| Version | Used for | Why |
|---|---|---|
| UUID v7 | `pageId`, `eventId`, `sitemapId` | Time-ordered — sorts roughly by creation time. |
| UUID v5 | `assetId` | Deterministic from a namespace + asset identity, so identical assets are stable. |
| UUID v4 | `resId` | Random per captured sub-resource. |

---

## URL keys

`manifest.hashing.urlKeyAlgo` is `sha1`: where the engine needs a compact URL key (for dedup and
some compare operations) it uses a SHA-1 of the normalized URL. This is distinct from the SHA-256
used for blob content addressing and integrity. The normalization rules applied before keying are
recorded under `manifest.url_normalization`.

---

_Last verified against codebase: 2026-06-04._
