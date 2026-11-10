# Open questions

Decision record for the Atlas edition at schema tag `2026-09-04`. Spec 1.2 is contract
`1.2.0`. Spec 1.3 is contract `1.3.0` and does not mint a new schema tag. Each item below is
either resolved in spec 1.2 or explicitly deferred to spec 2.0, except the spec 1.3 note and
the spec 1.4 candidates at the end. The Zod schemas in `packages/atls-spec/src/schemas/` remain
the record contract.

---

## 1. Mixed casing

**Status.** Deferred to spec 2.0.

**Decision.** The casing target is camelCase. Spec 1.2 does not rename any on-disk key. 1.x
readers accept the snake_case keys this schema tag already stores, including `primary_origin`
and `seed_urls` beside the camelCase spellings, the snake_case inner keys on `scope`,
`crawlerSettings`, `urlNormalization`, `producer`, and `environment`, a legacy `row_count` when
`rowCount` is absent, and `page_metadata.capture_degraded` / `degraded_reason`.

Spec 2.0 publishes one camelCase spelling per field, including `captureDegraded` and
`degradedReason`, and keeps dual-read for one edition. Rejecting the old spellings waits until
the edition after that.

---

## 2. Archive digest field names, and hash algorithms

**Status.** Resolved in spec 1.2.

**Decision.** `integrity.contentSha256` is the single normative archive digest. It is the
SHA-256, lowercase hex, of the concatenated lowercase-hex part checksums of every dataset part
file, ordered by relative path in UTF-8 byte order. Each part checksum is the SHA-256 of the
stored ZIP entry payload. Readers do not recompress to verify. `archiveSha256` and `auditHash`
are deprecated: writers omit them, readers ignore them.

`contentSha256` does not cover blobs, schema files, the manifest, the summary, or provenance.
Blob integrity is per blob: decompress, hash, compare to the hash in the path.

A 1.1 archive may have been rolled up with `localeCompare`. Readers of 1.1 archives accept
UTF-8 byte order, `en-US` `localeCompare`, or `th` `localeCompare`. Readers of 1.2 archives
accept byte order only. `validate()` uses that same split, keyed by `atlasVersion`: 1.2 or
later accepts byte order only, and a digest that matches only `en-US` or `th` `localeCompare`
is `CONTENT_SHA256_LOCALE_ORDER`. A 1.2 or later archive must also omit `archiveSha256` and
`auditHash` (`INTEGRITY_DEPRECATED_FIELD`). Readers still do not treat those fields as a ZIP
hash. The algorithm, the `schemaHash` and provenance definitions, and the locale difference are in
[storage-and-encoding.md](../packages/atls-spec/docs/storage-and-encoding.md).

---

## 3. Unknown-field policy

**Status.** Resolved in spec 1.2.

**Decision.** Readers must ignore unknown fields. An unknown key is not an interchange error.
Schemas may be strict in validation tooling only. `RecordMetaSchema`, accessibility
`landmarks`, and events `metrics` stay `.strict()`, so `validate()` reports unknown keys on
those objects. That report is tooling. Spec 1.2 does not change the schemas. Spec 2.0 may
preserve unknown keys on every schema parse.

---

## 4. Short dataset directory aliases

**Status.** Resolved in spec 1.2.

**Decision.** Writers must use the long directory names (`page_metadata`, `navigation`,
`pipeline_failures`). Short names (`pages`, `edges`, `failed_pages`) are a reader fallback
only. When both exist, readers prefer the long directory. Manifest keys stay the long names.
Dropping the fallback is deferred until archives that used the short directories are out of
scope. Spec 1.2 does not rename directories.

---

## 5. Identifier formats the schema does not check

**Status.** Resolved in spec 1.2 as writer conventions. Schema tightening is deferred to spec 2.0.

**Decision.** New writers emit:

| Id | Spec 1.2 writer | Schema |
|---|---|---|
| `pageId` | UUID v7, crawl-local, not stable across crawls | `z.string().uuid()` (any version). Quarantine `pageId` is a plain string. |
| `assetId` | UUID v5 in the RFC 4122 URL namespace over `normalizeUrl(assetUrl)` | `z.string().min(1)`. Spec 1.1 hashed the raw URL. |
| `resId` | UUID v4 | `z.string().uuid()` (any version) |
| `crawlId` | opaque; UUID v7 recommended | optional string |
| `datasetId` | 16 hex of the digest in [identity-and-keys.md](../packages/atls-spec/docs/identity-and-keys.md) | optional string |

A 1.1 archive that used another version still validates. Readers do not recompute 1.1
`assetId` values. `validate()` does, when `atlasVersion` is 1.2 or later: `assetId` must be
`assetId(assetUrl)`, the UUID v5 of `normalizeUrl(assetUrl)`. A mismatch is `ASSET_ID_MISMATCH`.
Tightening the schemas to these versions is a spec 2.0 schema-tag change.

---

## 6. Several TypeScript shapes are not the on-disk record

**Status.** Deferred to spec 2.0.

**Decision.** Only the dataset Zod schemas are the interchange format. `PageRecord` /
`PageRecordSchema` (in-memory, snake_case `page_id`), `flattenPageMetadataRecord` (the flat view
`readers.pageMetadata()` yields), `EdgeRecordSchema`, and engine structs such as `CrawlEvent`
are not a second on-disk record. Spec 2.0 moves the in-memory and engine types off the package
root. Recasing them without moving them would break in-memory callers and would not change an
archive.

---

## 7. `dom_snapshot`, `acc_tree`, and `render` are not dataset records

**Status.** Deferred to spec 2.0.

**Decision.** `schemaMap` may publish `dom_snapshot.v1`, `acc_tree.v1`, and `render.v1`. None
of them is a directory in `ATLAS_DATASET_KEYS`. `render_state.domSnapshot`, `computedText`, and
`accessibilityTree` stay free JSON. `audit_results` stays exported and absent from `schemaMap`.
Typing those payloads, or dropping the unused schemas, waits until a producer archive shows the
embedded JSON matches.

---

## 8. Files the prose describes and the schema does not define

**Status.** Deferred to spec 2.0, except `output.hashSha256`, which spec 1.2 defines.

**Decision.** `summary.v2.json` and the combined `schema.json` are producer artifacts. A missing
file is not a non-conformant archive. `openAtlas` reads `manifest.json` and `summary.json`.
`provenance.v1.jsonl.zst` has a record schema. `output.hashSha256` is the SHA-256 of the
uncompressed JSONL part checksums concatenated in part-index order. It is not
`contentSha256`, and `validate()` does not recompute it. Adding schemas for `summary.v2.json`
and `schema.json` is spec 2.0 work.

---

## 9. Presence-by-mode is not a schema rule

**Status.** Resolved in spec 1.2.

**Decision.** The presence-by-mode matrix stays producer guidance, not a validity rule. A
dataset the matrix omits for a mode still validates if its records match the schema. The one
container rule is that the manifest declares `page_metadata` (`datasets.page_metadata`, or a
non-empty `parts.page_metadata`). The dataset may contain zero records. `specLevel` stays the
union `1 | 2 | 3` and does not imply a required dataset set.

---

## 10. Producer identity is not a format constant

**Status.** Resolved in spec 1.2.

**Decision.** Any producer string is valid. `owner.name`, `generator`, and `consumers` are the
schema's strings. The format does not require a particular name, a `cartographer-engine/`
prefix, or a default consumer list.

---

## 11. What the reference reader accepts beyond the producer conventions

**Status.** Resolved in spec 1.2.

**Decision.** Digest verification is normative. `validate()` checks part checksums,
`contentSha256`, and blob hashes. `skipBlobVerification` skips blob hashes. ZIP deflate and
uncompressed `.jsonl` parts remain reader tolerance: a part checksum is always the SHA-256 of
the stored ZIP payload after the ZIP method is undone, so a reader must not recompress to
verify. Both the canonical blob reference and the legacy `blobs/.../<hash>.zst` spelling are
legal for readers. `getBlob`, `readBlob`, and `statBlob` still resolve the legacy spelling.
`validate()` reports `LEGACY_BLOB_REF` when `atlasVersion` is 1.2 or later and a record uses
that spelling, including `page_metadata.media.screenshots`, `reconstruction_index` screenshot,
favicon, and body refs, tile `src` values, and `robots.bodyBlobRef`. A 1.1 archive still
validates with the legacy spelling. On that same 1.2 or later stamp, `validate()` also rejects
a trailing-slash declaration other than the single `urlNormalization.trailing_slash` value
`append-unless-file` (`TRAILING_SLASH_DECLARATION`). A missing schema file is not a
`validate()` failure. `schemaHash`, when present, is the SHA-256 of that file's bytes.

---

## 12. Spec 1.3 is additive

**Status.** Resolved in spec 1.3.

**Decision.** The schema tag stays `2026-09-04`. New fields and the `robots` dataset are
optional. A writer stamps 1.3 only when it emits a spec 1.3 field. `frontier_ledger.skipReason`
stays an open string, so `ROBOTS_DISALLOWED` and `ROBOTS_UNREACHABLE` do not widen an enum a
1.2 reader parses strictly. `manifest.robotsPolicy` already existed. The 1.3 keys are added
beside `respect` and `overridesUsed`, which stay valid. `capabilities.robots` is unchanged.
New counters use null when unmeasured and 0 when measured and zero. `responses429` and
`responses5xx` count page responses from the origin, not robots.txt fetches. The meanings of
`robotsPolicy.mode`, `modeSource`, and `failClosed`, and of the applied-body digest, stay
stable across 1.3.x. The applied-body digest is the `bodyBlobRef` hash when that ref stores
the applied body. When `bodySource` is `lastGood`, that stored body is the last-good copy.
`lastGoodBodySha256` is a last-good digest that is not the stored body. A null `bodyBlobRef`
means no body was stored, independent of `fetchStatus`.

---

## 13. Spec 1.4 candidates

**Status.** Deferred. Not part of spec 1.3.x.

**Candidates.** Spec 1.3 keeps one robots row per origin, a string `matchedRobotsRule`, and the
applied-body digest in the dataset chapter. The following are candidates for spec 1.4:

- Multiple `robots` rows per origin, with a `fetchSeq`, and a skip-row reference to the robots
  row the skip was judged against.
- A structured matched rule `{ matchedGroup, directive, pattern, lineNumber }` in place of the
  `frontier_ledger.matchedRobotsRule` string. Spec 1.3 recommends the string form
  `<Directive>: <pattern>`, for example `Disallow: /cart`.
- Keep `bodyBlobRef` whenever a rule is cited.
