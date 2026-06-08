> [DOC_UNTRUSTWORTHY] WARNING: This document may be stale or incorrect during ongoing migration work. Treat code and tests as the source of truth.

# @atls/spec

Shared TypeScript type definitions for the Atlas v1.0 format and Cartographer Engine.

**Part of the Cartographer monorepo** - See [main README](../../README.md) for full documentation.

## Purpose

This package contains:
- TypeScript type definitions used across all Cartographer packages
- Shared interfaces for Atlas archive records
- Event type definitions for the crawl event bus
- Common types for configuration and metadata

## Usage

### Within Monorepo

All workspace packages automatically have access to `@atls/spec` via the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@atls/spec": "workspace:*"
  }
}
```

### Importing Types

```typescript
import type {
  // Archive Records
  PageRecord,
  EdgeRecord,
  AssetRecord,
  ErrorRecord,
  AccessibilityRecord,
  
  // Metadata
  AtlasManifest,
  AtlasSummary,
  
  // Events
  CrawlEvent,
  
  // Config
  EngineConfig,
  RenderMode
} from '@atls/spec';
```

## Key Types

### Archive Records

#### `PageRecord`
Represents a crawled web page with all extracted data:
```typescript
{
  url: string;
  statusCode: number;
  contentType: string;
  title?: string;
  metaDescription?: string;
  depth: number;
  discoveryMethod: string;
  crawledAt: string;
  renderMode: 'raw' | 'prerender' | 'full';
  // ... and many more fields
}
```

#### `EdgeRecord`
Represents a link between two pages:
```typescript
{
  source: string;
  target: string;
  anchorText?: string;
  rel?: string;
  // ...
}
```

#### `AccessibilityRecord`
WCAG audit data for a page:
```typescript
{
  url: string;
  wcagData: {
    headings: Array<{ level: number; text: string }>;
    imagesWithoutAlt: number;
    formsWithoutLabels: number;
    // ...
  };
  // ...
}
```

### Metadata Types

#### `AtlasManifest`
Archive metadata and configuration:
```typescript
{
  version: string;
  createdAt: string;
  engineVersion: string;
  owner: string;
  datasets: {
    pages: { present: boolean; count?: number };
    edges: { present: boolean; count?: number };
    // ...
  };
  // ...
}
```

#### `AtlasSummary`
Crawl statistics:
```typescript
{
  totalPages: number;
  totalEdges: number;
  totalAssets: number;
  totalErrors: number;
  startTime: string;
  endTime: string;
  duration: number;
  // ...
}
```

### Event Types

#### `CrawlEvent`
Union type for all event bus events:
```typescript
type CrawlEvent =
  | { type: 'crawl.started'; crawlId: string; ... }
  | { type: 'crawl.finished'; crawlId: string; manifestPath: string; summary?: {...}; ... }
  | { type: 'page.queued'; url: string; depth: number; ... }
  | { type: 'page.visited'; url: string; statusCode: number; ... }
  | { type: 'page.failed'; url: string; error: string; ... }
  | { type: 'checkpoint.saved'; pageCount: number; ... };
```

## Development

### Building

```bash
# From monorepo root
pnpm build --filter @atls/spec

# Or from this package
cd packages/atls-spec
pnpm build
```

### Type Checking

```bash
pnpm typecheck
```

## File Structure

```
packages/atls-spec/
├── src/
│   └── types.ts         # All type definitions
├── dist/                # Compiled .d.ts files
├── package.json
├── tsconfig.json
└── README.md
```

## Version History

- **1.0.0** - Initial monorepo release
  - Extracted from `@cf/cartographer`
  - Shared across engine, SDK, and tooling
  - Support for enhanced crawl events with summary/perf/notes

## Related Packages

- **@cf/cartographer** - Main crawler engine (uses these types)
- **@atls/sdk** - Archive reader SDK (uses record types)
- **@cf/url-tools** - URL utilities

---

**Maintainer:** Cai Frazier  
**License:** Proprietary - All Rights Reserved
