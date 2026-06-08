> [DOC_UNTRUSTWORTHY] WARNING: This document may be stale or incorrect during ongoing migration work. Treat code and tests as the source of truth.

# Atlas SDK Quick Reference

## Installation
```bash
pnpm add @atls/sdk
```

## Basic Usage

### Open Archive
```typescript
import { openAtlas } from '@atls/sdk';

const atlas = await openAtlas('./crawl.atls');
```

### Check Datasets
```typescript
console.log([...atlas.datasets]); // ['page_metadata', 'navigation', 'assets', 'responses', ...]

if (atlas.datasets.has('accessibility')) {
  // Accessibility data is present
}

if (atlas.hasDataset('responses')) {
  // HTML bodies are stored as blobs referenced by body_blob_ref
}
```

### Canonical Datasets (Atlas v1.0)

- `page_metadata`, `navigation`, `content`, `structured_data`, `technology`
- `render_state`, `performance`, `security`
- `assets`, `responses`, `resources`, `events`, `accessibility`, `pipeline_failures`

### Inspect Packs
```typescript
console.log(atlas.packs.all.map((pack) => `${pack.name}:${pack.state}`));

if (atlas.packs.hasEmbedded('Visual')) {
  console.log('Screenshots are embedded in the archive');
} else if (atlas.packs.state('Visual') === 'sidecar') {
  console.log(`Screenshots stored in sidecar: ${atlas.packs.sidecarUri('Visual')}`);
}
```

### Iterate Pages
```typescript
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url, page.statusCode);
}
```

### Iterate Accessibility
```typescript
for await (const record of atlas.readers.accessibility()) {
  console.log(record.pageUrl, record.missingAltCount);
}

for await (const response of atlas.readers.responses()) {
  console.log(response.page_id, response.body_blob_ref);
}

// Read the response body from blob storage
for await (const response of atlas.readers.responses()) {
  const html = await atlas.getBlob(response.body_blob_ref);
  console.log(response.page_id, html.length);
}

// Fallback for any dataset name
for await (const record of atlas.readers.dataset('render_state')) {
  console.log(record.page_id, record.node_count);
}
```

## Advanced Queries

### Filter Pages
```typescript
import { select } from '@atls/sdk';

// Get all 404 pages
for await (const page of select('./crawl.atls', {
  dataset: 'page_metadata',
  where: (p) => p.statusCode === 404
})) {
  console.log(page.url);
}
```

### Project Fields
```typescript
// Only get specific fields
for await (const page of select('./crawl.atls', {
  dataset: 'page_metadata',
  fields: ['url', 'statusCode', 'title']
})) {
  console.log(page); // { url, statusCode, title }
}
```

### Limit Results
```typescript
// Get first 100 records
for await (const page of select('./crawl.atls', {
  dataset: 'page_metadata',
  limit: 100
})) {
  // Process page
}
```

### Combine Options
```typescript
// Complex query: 404s with projection and limit
for await (const page of select('./crawl.atls', {
  dataset: 'page_metadata',
  where: (p) => p.statusCode === 404,
  fields: ['url', 'discoveredFrom'],
  limit: 50
})) {
  console.log(`Broken: ${page.url} (from ${page.discoveredFrom})`);
}
```

## Archive Validation

### Validate Archive
```typescript
import { validate } from '@caifrazier/atlas-sdk';

const result = await validate('./crawl.atls', {
  checkIntegrity: true,      // Check edges reference valid pages (default: true)
  checkBrokenLinks: true,    // Check for internal 404s (default: true)
  checkManifest: true,       // Verify manifest counts (default: true)
  maxIssues: 1000,           // Stop after N issues (default: 1000)
  errorsOnly: false,         // Only report errors, skip warnings (default: false)
});

console.log(`Valid: ${result.valid}`);
console.log(`Errors: ${result.stats.errorsFound}`);
console.log(`Warnings: ${result.stats.warningsFound}`);

// Review issues
for (const issue of result.issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}
```

### Validation Checks

**Schema Compliance:**
- ✅ All required fields present
- ✅ Field types correct
- ✅ Values within valid ranges

Note: `accessibility` is schema-validated when present in the archive.

**Referential Integrity:**
- ✅ Edges reference existing pages
- ✅ Assets reference existing pages
- ✅ All URLs are well-formed

**Manifest Consistency:**
- ✅ Record counts match actual data
- ✅ Required manifest fields present
- ✅ Format version valid

**Link Quality:**
- ⚠️ Internal links to 404 pages (warning)
- ⚠️ Internal links to 5xx errors (warning)

### Exit Codes
```typescript
if (!result.valid) {
  process.exit(1); // Exit with error if validation failed
}
```

## Common Patterns

### Count by Status Code
```typescript
const codes = new Map();
for await (const page of atlas.readers.pageMetadata()) {
  codes.set(page.statusCode, (codes.get(page.statusCode) || 0) + 1);
}
```

### Find Missing Alt Text
```typescript
for await (const record of atlas.readers.accessibility()) {
  if (record.missingAltCount > 0) {
    console.log(`${record.pageUrl}: ${record.missingAltCount} missing`);
  }
}
```

### Analyze Sections
```typescript
const sections = new Map();
for await (const page of atlas.readers.pageMetadata()) {
  const section = page.section || '/';
  sections.set(section, (sections.get(section) || 0) + 1);
}
```

### External Links
```typescript
for await (const edge of atlas.readers.navigation()) {
  if (Array.isArray(edge.edges)) {
    for (const link of edge.edges) {
      if (link.isExternal) {
        console.log(`${edge.sourceUrl} -> ${link.targetUrl}`);
      }
    }
  }
}
```

## Metadata Access

```typescript
// Manifest
console.log(atlas.manifest.atlasVersion);
console.log(atlas.manifest.createdAt);
console.log(atlas.manifest.capabilities);

// Summary
console.log(atlas.summary.stats.totalPages);
console.log(atlas.summary.stats.statusCodes);
console.log(atlas.summary.timestamps.crawlDurationMs);
```

## Performance Tips

✅ **DO**: Use streaming iterators for large archives
```typescript
// Memory efficient - processes one record at a time
for await (const page of atlas.readers.pageMetadata()) {
  // Process incrementally
}
```

❌ **DON'T**: Load everything into memory
```typescript
// Bad - loads entire dataset into RAM
const pages = [];
for await (const page of atlas.readers.pageMetadata()) {
  pages.push(page);
}
```

✅ **DO**: Use `select()` for filtering
```typescript
// Efficient - filters while streaming
for await (const page of select('./crawl.atls', {
  dataset: 'page_metadata',
  where: (p) => p.statusCode === 404
})) {
  // Already filtered
}
```

## Examples

See `examples/` directory for complete working code:
- `top-sections.mjs` - Section analysis
- `missing-alt.mjs` - Accessibility audit
- `status-report.mjs` - Status code breakdown
- `validate-archive.ts` - Archive validation with detailed reporting
- `test.mjs` - API test suite
