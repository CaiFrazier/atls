# Identity & Keys

How records identify themselves and how to join across datasets.

_Verified against `packages/atls-spec/src/schemas/` and the cartographer writer on 2026-06-04._

---

## The join model

Atlas is a **multi-dataset, page-keyed** format. A single crawled page produces records spread
across many datasets (`page_metadata`, `navigation`, `content`, `responses`, `accessibility`, …).
Those records are tied together by a shared **`page_id`**, not by URL.

> Always join on `page_id`, never on `url`. A URL can appear in redirect chains, be normalized
> differently, or repeat; `page_id` is the stable identity for "this captured page."

```
page_metadata.page_id ─┬─ navigation.page_id
                       ├─ content.page_id
                       ├─ responses.page_id
                       ├─ accessibility.page_id
                       ├─ assets.page_id
                       └─ … (every page-scoped dataset)
```

---

## `page_id`

- A **UUID v7** (time-ordered) generated per page, per crawl.
- Stable **within an archive**: every dataset record for the same captured page carries the same
  `page_id`.
- **Not stable across crawls.** The same URL crawled twice gets two different `page_id`s. To align
  pages across archives (temporal diffs, cross-mode joins) match on `url`/normalized URL, not
  `page_id`. The SDK's cross-mode index does exactly this — see
  [reading-archives.md](./reading-archives.md).

In the `responses` schema `page_id` is documented as "Foreign key to page_metadata page_id"
(`responses.schema.ts:16`).

---

## `crawl_id`

- Identifies the crawl run. Appears in `manifest.json` (`crawl_id`, snake_case), `summary` context,
  and in operational datasets (`events.crawl_id`, `sitemaps.crawl_id`, `quarantine.crawl_id`).
- Format is either a hex string or `crawl_<timestamp>_<random>` depending on how the run was
  started.

---

## `dataset_id`

- A short (16-char hex) archive identity derived from the crawl id + origin hash
  (`manifest.json` → `dataset_id`, snake_case).
- Used to identify the archive as a unit (e.g. for compare/diff compatibility).

---

## Datasets that are *not* page-keyed

A few datasets are operational or record-scoped and use their own primary key instead of (or in
addition to) `page_id`:

| Dataset | Primary key | Page link | Notes |
|---|---|---|---|
| `events` | `event_id` (UUID v7) | `page_id` (optional) | Operational telemetry; also carries `crawl_id`. |
| `resources` | `res_id` (UUID v4) | `owner_page_id` | Sub-resource network log; links to the owning page via `owner_page_id`. |
| `sitemaps` | `sitemap_id` (UUID v7) | — | Discovery-phase; carries `crawl_id`, not `page_id`. |
| `assets` | `asset_id` (UUID v5) | `page_id` | `asset_id` is deterministic (namespaced), so the same asset on the same page is stable. |
| `quarantine` | `quarantine_id` | `page_id` (optional) | Forensic dataset for records that failed validation; carries `crawl_id`. |
| `frontier_ledger` | `url` (natural key) | — | Discovery accounting; keyed by discovered URL. |
| `pipeline_failures` / `pipeline_alerts` | none | — | Operational ledgers keyed by `url` + `occurredAt`; no UUID. |

`resources` is the one to watch: its page link is **`owner_page_id`**, not `page_id`
(`resources.schema.ts`).

---

## UUID versions in use

| Version | Used for | Why |
|---|---|---|
| UUID v7 | `page_id`, `event_id`, `sitemap_id` | Time-ordered — sorts roughly by creation time. |
| UUID v5 | `asset_id` | Deterministic from a namespace + asset identity, so identical assets are stable. |
| UUID v4 | `res_id` | Random per captured sub-resource. |

---

## URL keys

`manifest.hashing.urlKeyAlgo` is `sha1`: where the engine needs a compact URL key (for dedup and
some compare operations) it uses a SHA-1 of the normalized URL. This is distinct from the SHA-256
used for blob content addressing and integrity. The normalization rules applied before keying are
recorded under `manifest.url_normalization`.

---

_Last verified against codebase: 2026-06-04._
