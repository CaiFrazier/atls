# Versioning & Compatibility

The Atlas format carries several version identifiers that move on independent cadences. Conflating
them is the most common source of reader bugs.

_Verified against `packages/cartographer/src/io/atlas/manifest.ts` and
`packages/atls-spec/package.json` on 2026-06-04._

---

## The version fields in `manifest.json`

| Field | Casing | Current value | Meaning |
|---|---|---|---|
| `atlasVersion` | camelCase | `"1.0"` | Public Atlas product line. |
| `formatVersion` | camelCase | `"1.0.0"` | Archive container/format version. Breaking container changes bump the major. |
| `specVersion` | camelCase | `"1.0.0"` | Specification contract version. |
| `schemaVersion` | camelCase | `"2025-10-22"` | **Date-stamped** dataset-schema release tag. |
| `generator` | camelCase | `"cartographer-engine/1.0.0-rc.1"` | Producer id + version; reflects the engine package version. |

These literals are set in `manifest.ts:355-357` and emitted at `manifest.ts:962-965`. `generator`
is built from `CARTOGRAPHER_VERSION` (`manifest.ts:1126`).

---

## Two independent axes — do not conflate

1. **`schemaVersion`** (`"2025-10-22"`) is a **date-stamped tag the writer stamps into every
   archive**. It identifies the on-disk dataset layout and is what a reader should branch on to
   decide "which archive layout is this."

2. **The `@cf/atlas-spec` package version** (`1.0.0-rc.1`, from `package.json`) is the npm semver
   of the schema *definitions*. It is **not** written into archives and evolves on its own cadence.

A reader must never use the spec package version to reason about an archive's layout — it isn't in
the archive. Read `manifest.schemaVersion`.

### Quick check

```bash
python3 -c "import zipfile,json; print(json.loads(zipfile.ZipFile('crawl.atls').read('manifest.json'))['schemaVersion'])"
# -> 2025-10-22
```

---

## `specLevel` and render mode

The manifest's `capabilities.specLevel` (and `summary.crawlContext.specLevel`) encodes how rich
the archive is, derived from the render mode:

| `specLevel` | Render mode | Adds |
|---|---|---|
| 1 | `raw` | HTTP-only datasets. |
| 2 | `prerender` | `performance`, deeper `accessibility`, `security`, `structured_data`. |
| 3 | `full` | `render_state`, `resources`, full WCAG/axe in `accessibility`. |

Readers can use `specLevel` to know which datasets to expect without opening every directory. The
authoritative presence map is in [datasets.md](./datasets.md).

---

## Forward-compatibility rules

- Breaking the archive container requires a new `formatVersion` major; readers should refuse or
  warn on an unknown major.
- Schema-breaking changes require a `schemaVersion` bump and coordinated reader updates.
- Additive, non-breaking fields are allowed within the same `formatVersion` major — readers must
  tolerate unknown fields (the writer's nested objects use Zod `passthrough`, so extra keys can
  appear).
- `generator` must reflect the real engine version, never a hardcoded placeholder.

---

_Last verified against codebase: 2026-07-01._
