# Open questions

Problems in the current Atlas edition (`schemaVersion` `2026-09-04`) that this repository does
not change. The Zod schemas in `packages/atls-spec/src/schemas/` are the behavior. The notes
below are for a later, versioned decision. None of them is a conformance rule.

---

## 1. Mixed casing

**Problem.** One manifest mixes casings, and one dataset record does too.

- `identity` accepts both `primary_origin` and `primaryOrigin`, and both `seed_urls` and `seedUrls`. `domain` and `publicSuffix` are camelCase only.
- `scope`, `crawlerSettings`, `urlNormalization`, `producer`, and `environment` use camelCase (or a camelCase parent) with snake_case inner keys (`block_params`, `render_mode`, `lowercase_host`, `git_hash`, `user_agent`, `download_kbps`).
- `coverage` was recased to camelCase (`rowCount`, `totalPages`). The reference reader still also reads a legacy `row_count` when `rowCount` is absent.
- `page_metadata.capture_degraded` and `page_metadata.degraded_reason` are snake_case on a record whose other fields are camelCase.

**Options.**

1. Leave every current spelling valid forever and document them as the wire format.
2. In a new `schemaVersion`, accept only camelCase, and keep dual-read for one edition.
3. In a new `schemaVersion`, accept only camelCase and reject the old spellings.

**Recommendation.** Option 2. Publish one camelCase spelling per field, including `captureDegraded` and `degradedReason`, and keep readers able to accept the spellings this edition already accepts until the following tag. Do not do it inside `2026-09-04`: existing archives and the current schemas would stop round-tripping.

---

## 2. Archive digest field names, and unspecified hash algorithms

**Problem.** `manifest.integrity` has three optional digests: `contentSha256`, `archiveSha256`, and `auditHash`. The schema does not say which bytes each one covers, or how `contentSha256` differs from `archiveSha256`. The same gap exists for:

- `manifest.datasets.<name>.integrity.checksums` (part digests)
- `manifest.datasets.<name>.schemaHash`
- `manifest.hashing.urlKeyAlgo` (the field records a name, conventionally `sha1`; the normalization steps are not in this repository)
- `provenance` `output.hashSha256`
- blob paths, which are laid out as SHA-256 of uncompressed bytes, while the reference reader does not recompute that hash

The hand-written `AtlasManifest` type previously spelled two of the archive fields `content_sha256` and `audit_hash`. The type now uses the schema's names. That was a documentation mismatch, not a second on-disk spelling the schema requires.

**Options.**

1. Leave the three integrity fields optional and unspecified.
2. Specify the byte range for each field that already exists, without renaming them.
3. Keep one archive digest, deprecate the other names, and publish the algorithm with test vectors.

**Recommendation.** Option 3, as its own schema tag, after the algorithm is written down next to vectors. This edition does not specify those algorithms. Until then, treat the fields as opaque strings a producer may set and a reader must not invent.

---

## 3. Unknown-field policy is three different policies

**Problem.** Some objects `.passthrough()` (extra keys kept), most dataset records use Zod's default strip (extra keys dropped on success, not rejected), and `RecordMetaSchema`, accessibility `landmarks`, and events `metrics` are `.strict()` (extra keys fail). A non-TypeScript implementation cannot infer one rule from the phrase "ignore unknown fields."

**Options.**

1. Document the per-object behavior and leave the schemas as they are (this edition).
2. Preserve unknown keys on every object, and ignore them.
3. Reject unknown keys on every object.

**Recommendation.** Option 2 for archive records and the manifest, so an additive field is forward compatible in every language. Strict objects can stay strict if they are closed on purpose, and that has to be called out per object. Changing strip to passthrough changes what a Zod parse returns, so it belongs in a new schema tag, not in a documentation pass.

---

## 4. Short dataset directory aliases

**Problem.** `ATLAS_DATASET_KEYS` and manifest keys use the long directory names (`page_metadata`, `navigation`, `pipeline_failures`). The reference reader also accepts `pages`, `edges`, and `failed_pages`, and prefers the long directory when both exist. Older prose called the short names removed. Older SDK comments called them the layout of archives with `schemaVersion >= 2025-10-22`. That date is not in the schema-tag history. This edition states the long names as what producers write, and keeps the reader's alias fallback unchanged.

**Options.**

1. Long names are the only legal producer layout; readers may keep accepting the three aliases.
2. Both layouts are legal producer output.
3. Drop alias support in a later reader.

**Recommendation.** Option 1. The registry is the producer contract. Alias reads stay so archives that used the short directories still open. A later edition can drop the fallback once those archives are out of scope. Do not rename directories inside `2026-09-04`.

---

## 5. Identifier formats the schema does not check

**Problem.** Prose has required UUID versions and id shapes the schemas do not enforce.

| Id | Prose convention | What the schema checks |
|---|---|---|
| `pageId` | UUID v7 | `z.string().uuid()` where it is a page id (any version). Quarantine `pageId` is a plain string. |
| `eventId`, `sitemapId` | UUID v7 | `z.string()` |
| `assetId` | UUID v5 | `z.string().min(1)` |
| `resId` | UUID v4 | `z.string().uuid()` (any version) |
| `datasetId` | 16 hex characters | optional string |
| `crawlId` | hex, or `crawl_<timestamp>_<random>` | optional string |

**Options.**

1. Document the schema checks as the format, and leave the versions as a producer convention.
2. Tighten the schemas to the versions and shapes in a new tag.
3. Drop the version conventions entirely.

**Recommendation.** Option 1 for this edition (already applied in the spec). Option 2 only if an independent implementation needs to reproduce ids the same way. Random UUID v4 page ids validate today; rejecting them would be a breaking schema change.

---

## 6. Several TypeScript shapes are not the on-disk record

**Problem.** `@caifrazier/atls-spec` exports more than one page and edge shape:

- On-disk `page_metadata` is the nested camelCase `PageMetadataDatasetRecordV1Schema`.
- `PageRecord` / `PageRecordSchema` is an in-memory crawl composite and still requires snake_case `page_id`.
- `flattenPageMetadataRecord` is the flat object `readers.pageMetadata()` yields.
- `EdgeRecordSchema` is a flat snake_case edge. The on-disk navigation record is a camelCase envelope of edges.
- Engine structs such as `CrawlEvent` and `ConsoleRecord` are exported from the same package and are not archive datasets.

**Options.**

1. Keep the exports, and state in the spec that only the dataset Zod schemas are the interchange format (this edition).
2. Move the in-memory and engine types to a separate entry point so the package root is the archive format.
3. Recase `PageRecord` and `EdgeRecord` to match the datasets.

**Recommendation.** Option 2 in a later release of the package. Option 3 would break in-memory callers without changing an archive. The interchange format is the dataset Zod schema. `readers.pageMetadata()` remaining a flat view is a reader API, not a second on-disk record.

---

## 7. `dom_snapshot`, `acc_tree`, and `render` are not dataset records

**Problem.** `schemaMap` publishes `dom_snapshot.v1`, `acc_tree.v1`, and `render.v1`. None of them is a directory in `ATLAS_DATASET_KEYS`. `render_state.domSnapshot`, `computedText`, and `accessibilityTree` are free `z.record` JSON, not those schemas. `render.v1` is an older renderer-capture schema. `audit_results` is exported and deliberately absent from `schemaMap`.

**Options.**

1. Say so, and leave the extra schemas published (this edition).
2. Type `render_state`'s embedded payloads with `dom_snapshot` and `acc_tree`, if those schemas actually match what producers store.
3. Stop publishing the unused schemas in `schemaMap`.

**Recommendation.** Option 1 until a producer archive shows that the embedded payloads match `dom_snapshot` / `acc_tree`. Option 2 is a schema change if the shapes differ. Option 3 is a package-surface change and should wait for the same check.

---

## 8. Files the prose describes and the schema does not define

**Problem.** `summary.v2.json` (an `aggregates` block on top of `summary.json`) and the combined `schema.json` dictionary have no Zod schema. `AtlasSummarySchema` is a plain `z.object`, so an `aggregates` key would be stripped on parse. `openAtlas` reads `manifest.json` and `summary.json` only. `provenance.v1.jsonl.zst` has a record schema; the byte range of `output.hashSha256` does not (see question 2).

**Options.**

1. Describe `summary.v2.json` and `schema.json` as producer artifacts this edition does not validate.
2. Add schemas for them, and decide whether `aggregates` is part of `summary.json` or only of `summary.v2.json`.

**Recommendation.** Option 1 now. Option 2 when those files are part of the interchange contract rather than a producer convenience. Do not treat a missing `summary.v2.json` as a non-conformant archive: the reference reader does not require it.

---

## 9. Presence-by-mode is not a schema rule

**Problem.** [datasets.md](../packages/atls-spec/docs/datasets.md) says which datasets the reference producer writes in `raw`, `prerender`, and `full`. `capabilities.specLevel` is only the union `1 | 2 | 3`. A full-mode archive with no `render_state` directory still validates.

**Options.**

1. Keep the matrix as producer policy (this edition).
2. Make `specLevel` imply a required dataset set and reject mismatches.

**Recommendation.** Option 1. Dataset presence is a crawl outcome (empty sites, pruned datasets, imports), not a container invariant. A conformance suite can check a producer's own policy later without baking that policy into the schema.

---

## 10. Producer identity is not a format constant

**Problem.** Older prose required `owner.name` to be the literal `"Cai Frazier"`, `generator` to start with `cartographer-engine/`, and `consumers` to default to a product list. The schema requires `owner.name` (any string), `generator` (any string), and `consumers` (an array of strings, with no default).

**Options.**

1. Any producer string is valid (this edition).
2. Require a registered generator prefix.

**Recommendation.** Option 1. An open format cannot require one person's name or one engine's prefix. Examples in comments may keep showing a Cartographer string; they are examples.

---

## 11. The reference reader accepts more than the producer conventions

**Problem.** Documented producer conventions include a stored (ZIP method 0) container, `part-NNN.jsonl.zst` at zstd level 3, and canonical blob paths. The reference reader also accepts deflated ZIP entries, uncompressed `.jsonl` parts, and several blob-path spellings. `validate()` does not hash parts, files, or blobs. Its `checkIntegrity` option checks references, not digests.

**Options.**

1. Call the schemas the record contract, the reader a tolerant implementation, and the producer conventions non-normative where the schema does not check them (this edition).
2. Tighten the reader to reject anything outside the producer conventions.
3. Publish a separate strict conformance profile.

**Recommendation.** Option 3, later, with fixtures. Option 2 would reject archives the reader accepts today. This edition documents the difference and does not change the reader.
