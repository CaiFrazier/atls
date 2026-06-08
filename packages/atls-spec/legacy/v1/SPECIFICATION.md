> [DOC_UNTRUSTWORTHY] WARNING: This document may be stale or incorrect during ongoing migration work. Treat code and tests as the source of truth.

# Atlas v1.0 Archive Format Specification

**Version:** 1.0  
**Status:** Release Candidate  
**Date:** October 2025  
**Owner:** Cai Frazier  
**Copyright:** © 2025 Cai Frazier. All rights reserved.

> Note: This document tracks Atlas v1.0 semantics at a high level. For current producer-on-disk details, align with `packages/cartographer/docs/ATLAS_SPEC.md`.

---

## 1. Introduction

The **Atlas v1.0** format is a structured, compressed archive format for web crawl data. It packages page content, navigation graphs, assets, pipeline failure records, and accessibility audits into a single `.atls` file optimized for downstream analysis.

### 1.1 Design Goals

- **Structured:** JSONL (newline-delimited JSON) for streaming and parallel processing
- **Compressed:** Zstandard compression for efficient storage (typical 10:1 ratio)
- **Self-contained:** Single-file distribution with embedded schemas and manifest
- **Verifiable:** SHA-256 integrity hashes for all parts
- **Extensible:** Versioned format with clear upgrade paths

### 1.2 Consumers

- **Continuum SEO** - Technical SEO analysis platform
- **Horizon Accessibility** - WCAG compliance auditing
- **Data pipelines** - CSV export, database import, analytics

---

## 2. Archive Structure

An Atlas archive is a **ZIP file** with the `.atls` extension. Current (v1.0) archives use **per-dataset directories**, optional media/blobs packs, and a small set of metadata files:

```
example.atls/
├── manifest.json                  # Archive metadata and inventory
├── summary.json                   # Crawl statistics
├── schemas/                       # JSON Schemas bundled with the archive
│   ├── page_metadata.v1.schema.json
│   ├── navigation.v1.schema.json
│   ├── assets.v1.schema.json
│   ├── pipeline_failures.v1.schema.json
│   ├── responses.v1.schema.json
│   ├── accessibility.v1.schema.json
│   └── ...other dataset schemas...
├── page_metadata/                 # Dataset shards (compressed NDJSON)
│   └── part-001.jsonl.zst
├── navigation/
│   └── part-001.jsonl.zst
├── content/
│   └── part-001.jsonl.zst
├── structured_data/
│   └── part-001.jsonl.zst
├── technology/
│   └── part-001.jsonl.zst
├── assets/
│   └── part-001.jsonl.zst
├── responses/
│   └── part-001.jsonl.zst
├── pipeline_failures/
│   └── part-001.jsonl.zst
├── events/                        # Present if event logging enabled
│   └── part-001.jsonl.zst
├── accessibility/                 # Present in prerender/full modes
│   └── part-001.jsonl.zst
├── security/
│   └── part-001.jsonl.zst
├── performance/                   # Present in prerender/full modes
│   └── part-001.jsonl.zst
├── render_state/                  # Present in full mode
│   └── part-001.jsonl.zst
├── resources/                     # Present in full mode (when captured)
│   └── part-001.jsonl.zst
├── media/                         # Screenshots/favicons (full/prerender)
│   ├── favicons/
│   └── screenshots/
├── blobs/                         # Content-addressed blob storage (zstd)
│   └── sha256/<prefix>/<hash>.zst
├── provenance.v1.jsonl.zst        # Extractor provenance records
├── capabilities.v1.json           # Declared capabilities for this archive
└── meta/                          # Crawler state artifacts (non-dataset)
    ├── state.json
    ├── frontier.json
    └── visited.idx
```

### 2.1 File Naming Convention

- Dataset shards: `{dataset}/part-XXX.jsonl.zst` (1-based, zero-padded).
- Media: `media/screenshots/{desktop,mobile,...}/*.webp|*.png` (when enabled).
- Blob storage: `blobs/sha256/aa/bb/<sha256>.zst`.
- Canonical in-record blob references (for `*_blob_ref` fields): `sha256/aa/bb/<sha256>` (no `blobs/` prefix, no `.zst` suffix).
- Archives follow the pattern `{domain}_{YYYYMMDD}_{HHMMSS}_{mode}.atls` when auto-generated.

---

## 3. Manifest Format

The `manifest.json` file describes the archive contents and provenance.

### 3.1 Schema

```json
{
  "atlasVersion": "1.0",
  "formatVersion": "1.0.0",
  "specVersion": "1.0.0",
  "schemaVersion": "2025-10-22",
  "incomplete": false,
  
  "owner": {
    "name": "Cai Frazier"
  },
  
  "consumers": [
    "Continuum SEO",
    "Horizon Accessibility"
  ],
  
  "hashing": {
    "algorithm": "sha256",
    "urlKeyAlgo": "sha1",
    "rawHtmlHash": "sha256 of raw HTTP body",
    "domHash": "sha256 of document.documentElement.outerHTML"
  },
  
  "crawl_id": "crawl_1698765432000_1234",
  "mode": "prerender",
  
  "stats": {
    "totalPages": 142,
    "totalEdges": 1247,
    "totalAssets": 318,
    "totalErrors": 3,
    "totalAccessibilityIssues": 0
  },
  
  "parts": {
    "page_metadata": ["page_metadata/part-001.jsonl.zst"],
    "navigation": ["navigation/part-001.jsonl.zst"],
    "assets": ["assets/part-001.jsonl.zst"],
    "pipeline_failures": ["pipeline_failures/part-001.jsonl.zst"]
  },
  
  "provenance": {
    "cartographerVersion": "1.0.0-rc.1",
    "nodeVersion": "v20.11.0",
    "playwrightVersion": "1.40.0",
    "hostname": "crawler-prod-01",
    "resumeOf": null,
    "checkpointInterval": 500,
    "gracefulShutdown": false
  }
}
```

### 3.2 Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `atlasVersion` | string | ✅ | Major format version (e.g., "1.0") |
| `formatVersion` | string | ✅ | Semantic version for compatibility (e.g., "1.0.0") |
| `specVersion` | string | ✅ | Specification document version |
| `incomplete` | boolean | ❌ | True if crawl was interrupted |
| `owner.name` | string | ✅ | Archive owner attribution |
| `consumers` | string[] | ✅ | Intended consumer applications |
| `hashing.algorithm` | string | ✅ | Hash algorithm for integrity |
| `crawl_id` | string | ✅ | Unique crawl identifier |
| `mode` | string | ✅ | One of: `raw`, `prerender`, `full`, `import` |
| `stats.*` | number | ✅ | Record counts per dataset |
| `parts.<dataset>[]` | string[] | ✅ | Relative paths to compressed part files |
| `integrity.files` | object | ✅ | Per-file sha256 checksums |

### 3.3 Field Semantics (Normative)

This section defines behavior that is required for producer/consumer interoperability.

| Area | Normative Semantics |
|------|----------------------|
| `url` vs `finalUrl` | `url` is the requested URL after crawl policy application (parameter policy + blocklist + fragment removal). `finalUrl` is the terminal URL after redirects. If no redirect occurs, `finalUrl == url`. |
| URL canonicalization (`normalizedUrl` / `normalized_url`) | Producers MUST compute normalized URL as follows: (1) apply parameter policy and blocklist, (2) remove fragment, (3) lowercase scheme + hostname, (4) collapse duplicate slashes in path, (5) canonicalize trailing slash (directory paths end with `/`, file-like paths do not; root remains `/`; if `preserveTrailingSlash=true`, preserve), (6) sort query params by key, (7) serialize as absolute URL string. |
| Hash verification (`rawHtmlHash` / `hash_body_sha256`) | Hash is SHA-256 over response-body bytes before Atlas blob compression (`.zst`) and before UTF-8 string conversion. Consumers MUST verify against that pre-compression byte stream. |
| Partial archive (`manifest.incomplete=true`) | Archive is intentionally incomplete. Guarantees that still hold: `manifest.json`, `summary.json`, and all listed parts MUST be readable; each listed part hash MUST verify; records in listed parts MUST validate against bundled schemas. Not guaranteed: full crawl coverage, complete referential closure across datasets, or presence of all optional datasets. |
| `null` vs omitted (`undefined`) | Producers MUST omit optional fields when value is unknown or not captured. Producers MUST emit `null` only where schema explicitly allows `null` and only to represent intentional tri-state/known-empty semantics. Consumers SHOULD treat omitted as "unknown/not captured" and `null` as "explicitly empty/not applicable". |
| Blob reference format | Producers MUST emit exactly `sha256/aa/bb/<64-hex>` in record fields such as `body_blob_ref`. This maps to archive path `blobs/sha256/aa/bb/<64-hex>.zst`. Consumers MAY accept legacy variants (`blobs/sha256/...(.zst)` or bare `<64-hex>`) for backward compatibility, but those are non-canonical. |

---

## 4. Data Parts

### 4.1 Page Metadata (`page_metadata/part-*.jsonl.zst`)

Each line is a **PageRecord** representing a crawled URL.

#### Schema

```typescript
interface PageRecord {
  url: string;                    // Canonical URL
  finalUrl: string;               // After redirects
  statusCode: number;             // HTTP status
  depth: number;                  // Crawl depth from seeds
  discoveredFrom: string | null;  // Parent URL
  fetchedAt: string;              // ISO 8601 timestamp
  renderMode: "raw" | "prerender" | "full";
  
  // Content
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  lang: string | null;
  textSample: string;             // First 500 chars
  
  // Hashes
  rawHtmlHash: string;            // SHA-256 of HTTP body
  domHash: string;                // SHA-256 of rendered DOM
  
  // Metrics
  loadTimeMs: number;
  renderTimeMs: number;
  contentBytes: number;
  
  // Structured data
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  jsonLd: any[];
  
  // Screenshots (full mode only)
  screenshotDesktop?: string;     // Path in archive
  screenshotMobile?: string;      // Path in archive
}
```

#### Example

```json
{
  "url": "https://example.com/about",
  "finalUrl": "https://example.com/about",
  "statusCode": 200,
  "depth": 1,
  "discoveredFrom": "https://example.com/",
  "fetchedAt": "2025-10-25T14:31:05Z",
  "renderMode": "prerender",
  "title": "About Us - Example Company",
  "metaDescription": "Learn more about our mission and team.",
  "h1": "About Our Company",
  "canonicalUrl": "https://example.com/about",
  "lang": "en",
  "textSample": "Welcome to our about page. We are a team of...",
  "rawHtmlHash": "a3f5e8d9c2b1f4e6d7c8a9b0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0",
  "domHash": "b4e6d8c0a2f1e3d5c7b9a1f0e2d4c6b8a0f1e3d5c7b9a1f0e2d4c6b8a0f1e3d5",
  "loadTimeMs": 342,
  "renderTimeMs": 1205,
  "contentBytes": 47821,
  "openGraph": {
    "og:title": "About Us",
    "og:type": "website"
  },
  "twitterCard": {},
  "jsonLd": []
}
```

### 4.2 Edges (`edges.jsonl.zst`)

Each line is an **EdgeRecord** representing a link between pages.

#### Schema

```typescript
interface EdgeRecord {
  from: string;           // Source URL
  to: string;             // Target URL
  toResolved: string;     // After normalization
  anchor: string | null;  // Link text
  location: "nav" | "header" | "footer" | "main" | "aside" | "unknown";
  rel: string[];          // rel attributes
  discoveredInMode: "raw" | "prerender" | "full";
  isExternal: boolean;
  isCanonical: boolean;
}
```

#### Example

```json
{
  "from": "https://example.com/",
  "to": "https://example.com/about",
  "toResolved": "https://example.com/about",
  "anchor": "About Us",
  "location": "nav",
  "rel": [],
  "discoveredInMode": "prerender",
  "isExternal": false,
  "isCanonical": false
}
```

### 4.3 Assets (`assets.jsonl.zst`)

Each line is an **AssetRecord** representing a referenced resource.

#### Schema

```typescript
interface AssetRecord {
  url: string;              // Asset URL
  type: "image" | "script" | "stylesheet" | "font" | "other";
  referrer: string;         // Page that referenced it
  statusCode: number | null;
  contentType: string | null;
  sizeBytes: number | null;
  loadTimeMs: number | null;
}
```

#### Example

```json
{
  "url": "https://example.com/assets/logo.png",
  "type": "image",
  "referrer": "https://example.com/",
  "statusCode": 200,
  "contentType": "image/png",
  "sizeBytes": 14728,
  "loadTimeMs": 142
}
```

### 4.4 Pipeline Failures (`pipeline_failures/part-XXX.jsonl.zst`)

Each line is an **ErrorRecord** representing a crawl error.

#### Schema

```typescript
interface ErrorRecord {
  url: string;
  origin: string;
  hostname: string;
  occurredAt: string;       // ISO 8601
  phase: "fetch" | "render" | "extract" | "write";
  code: string;             // Error code
  message: string;
  stack?: string;
}
```

#### Example

```json
{
  "url": "https://example.com/broken",
  "origin": "https://example.com",
  "hostname": "example.com",
  "occurredAt": "2025-10-25T14:32:15Z",
  "phase": "fetch",
  "code": "HTTP_404",
  "message": "Not Found",
  "stack": null
}
```

### 4.5 Accessibility (`accessibility.jsonl.zst`)

Only present in **full mode** crawls. Each line is an accessibility audit result.

#### Schema

```typescript
interface AccessibilityRecord {
  url: string;
  auditedAt: string;
  violations: {
    id: string;
    impact: "critical" | "serious" | "moderate" | "minor";
    description: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string[];
    }>;
  }[];
  passes: number;
  incomplete: number;
}
```

---

## 5. Compression

All `.jsonl.zst` files use **Zstandard** compression with default compression level (3).

### 5.1 Compression Ratio

Typical compression ratios:

- **Pages:** 8-12:1 (HTML and metadata compress well)
- **Edges:** 5-8:1 (shorter records, less repetition)
- **Assets:** 6-10:1
- **Pipeline failures:** 4-6:1 (typically few records)

### 5.2 Decompression

```bash
# Command-line
zstd -d pages/part-001.jsonl.zst

# Node.js
import { createReadStream } from 'fs';
import { createDecompressor } from 'zstd-codec';

const stream = createReadStream('pages/part-001.jsonl.zst')
  .pipe(createDecompressor());
```

---

## 6. Integrity Verification

Each part includes a SHA-256 hash in the manifest for verification.

### 6.1 Verification Process

```typescript
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function verifyPart(partPath: string, expectedHash: string): boolean {
  const data = readFileSync(partPath);
  const actualHash = createHash('sha256').update(data).digest('hex');
  return actualHash === expectedHash;
}
```

### 6.2 Manifest Integrity

The manifest itself should be verified by consumers using the archive's external checksum (if provided) or digital signature.

---

## 7. Versioning

### 7.1 Format Version (`atlasVersion`)

Major version changes indicate breaking format changes:
- `1.0` → `2.0`: Non-backward-compatible changes

Minor version changes are backward-compatible:
- `1.0` → `1.1`: New optional fields

### 7.2 Schema Version (`schemaVersion`)

JSON schema version for validation tools. Follows semver.

### 7.3 Specification Version (`specVersion`)

This document's version. Follows semver.

---

## 8. Reference Implementation

See `@atls/sdk` for reading Atlas archives:

```typescript
import { openAtlas } from '@atls/sdk';

const atlas = await openAtlas('./example.atls');

console.log('Manifest:', atlas.manifest);
console.log('Summary:', atlas.summary);

// Stream page metadata
for await (const page of atlas.readers.pageMetadata()) {
  console.log(`Page: ${page.url} (${page.statusCode})`);
}

// Stream navigation graph records
for await (const nav of atlas.readers.navigation()) {
  console.log(`Source: ${nav.sourceUrl} (edges=${nav.edges?.length ?? 0})`);
}
```

---

## 9. Example Archive

A minimal valid `.atls` archive contains:

```
minimal.atls (ZIP)
├── manifest.json         # Required
├── summary.json          # Required
├── schemas/              # Optional but recommended
│   └── page_metadata.v1.schema.json
├── page_metadata/
│   └── part-001.jsonl.zst   # At least 1 record
└── navigation/
    └── part-001.jsonl.zst   # Can be empty
```

**Manifest checksum (SHA-256):**
```
a3f5e8d9c2b1f4e6d7c8a9b0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0
```

---

## 10. Appendices

### Appendix A: MIME Type

Recommended MIME type: `application/vnd.atlas+zip`

### Appendix B: File Extension

Standard extension: `.atls`

### Appendix C: Magic Bytes

Atlas archives are ZIP files and begin with:
```
50 4B 03 04  (PK..)
```

### Appendix D: Compatibility

- **Node.js:** ≥20.0.0
- **Zstandard:** ≥1.5.0
- **JSON Schema:** Draft-07

---

## 11. Security Considerations

### 11.1 Archive Validation

Always validate:
1. ZIP structure integrity
2. Manifest schema compliance
3. Part file SHA-256 hashes
4. JSONL record count vs manifest

### 11.2 Content Safety

Archives may contain:
- User-generated content
- Malicious HTML/scripts
- Large files (DoS risk)

**Mitigations:**
- Sandbox archive processing
- Limit decompressed size
- Validate before rendering HTML

### 11.3 Privacy

Archives contain crawled web content and may include:
- Personal data
- Authentication tokens in URLs
- Private information

**Handling:**
- Apply data retention policies
- Anonymize if needed
- Respect robots.txt and terms of service

---

## 12. Change Log

### Version 1.0.0 (October 2025)
- Initial specification
- Core parts: page_metadata, navigation, assets, pipeline_failures, accessibility
- Zstandard compression
- SHA-256 integrity
- Manifest v1.0

---

**Document Version:** 1.0.0  
**Last Updated:** October 25, 2025  
**Author:** Cai Frazier  
**License:** MIT
