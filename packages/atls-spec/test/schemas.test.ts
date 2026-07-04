/*
 * Copyright 2026 Cai Frazier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Schema Validation Tests
 */

import { describe, test, expect } from 'vitest';
import {
  PageMetadataRecordV1Schema,
  AtlasManifestV1Schema,
  AtlasCapabilitiesV1Schema,
  ProvenanceRecordV1Schema,
} from '../src/schemas/index.js';
import { flattenPageMetadataRecord } from '../src/pageMetadataMapping.js';
import type { PageMetadataDatasetRecordV1 } from '../src/schemas/cartographer-datasets.schema.js';

describe('Atlas v1.0 Schema Validation', () => {
  describe('PageMetadataRecordV1Schema', () => {
    test('validates a complete page_metadata dataset record (nested shape)', () => {
      const validRecord = {
        pageId: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://example.com/page',
        core: {
          title: 'Example Page',
          titleLength: 12,
          metaDescription: 'An example page',
          descriptionLength: 15,
          h1: 'Example',
          canonicalTag: 'https://example.com/page',
          language: 'en',
          charset: 'utf-8',
        },
        indexing: {
          robotsMeta: 'index, follow',
          xRobotsTag: 'index',
        },
        social: {
          openGraph: { 'og:title': 'Example' },
          twitterCard: { 'twitter:card': 'summary' },
        },
        capturedAt: '2025-10-26T14:00:00Z',
      };

      const result = PageMetadataRecordV1Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    test('rejects invalid pageId format', () => {
      const invalidRecord = {
        pageId: '',
        url: 'https://example.com/page',
        core: { title: 'Test' },
        indexing: { robotsMeta: 'index' },
        social: { openGraph: {}, twitterCard: {} },
        capturedAt: '2025-10-26T14:00:00Z',
      };

      const result = PageMetadataRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    test('rejects missing required nested objects', () => {
      const invalidRecord = {
        pageId: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://example.com/page',
        // Missing: core, indexing, social, capturedAt
      };

      const result = PageMetadataRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });
  });

  describe('AtlasManifestV1Schema', () => {
    test('validates a complete manifest', () => {
      const validManifest = {
        atlasVersion: '1.0',
        formatVersion: '1.0.0',
        owner: { name: 'Cai Frazier' },
        consumers: ['Continuum SEO'],
        mode: 'full',
        hashing: {
          algorithm: 'sha256',
          urlKeyAlgo: 'sha1',
          rawHtmlHash: 'sha256 of raw HTTP body',
          domHash: 'sha256 of document.documentElement.outerHTML',
        },
        parts: {
          page_metadata: ['page_metadata/part-001.jsonl.zst'],
          navigation: ['navigation/part-001.jsonl.zst'],
          assets: ['assets/part-001.jsonl.zst'],
          pipeline_failures: ['pipeline_failures/part-001.jsonl.zst'],
        },
        schemas: {
          page_metadata: 'schemas/page_metadata.v1.schema.json#1',
          navigation: 'schemas/navigation.v1.schema.json#1',
          assets: 'schemas/assets.v1.schema.json#1',
          pipeline_failures: 'schemas/pipeline_failures.v1.schema.json#1',
        },
        datasets: {
          page_metadata: {
            name: 'page_metadata',
            recordCount: 100,
            bytes: 50000,
            schema: 'schemas/page_metadata.v1.schema.json#1',
          },
        },
        configIncluded: true,
        redactionApplied: false,
        storage: {
          compression: {
            algorithm: 'zstd',
            level: 3,
          },
        },
        notes: ['manifest generated'],
        integrity: {
          algorithm: 'sha256',
          contentSha256: 'a'.repeat(64),
          files: { 'page_metadata/part-001.jsonl.zst': 'b'.repeat(64) },
        },
        createdAt: '2025-10-26T14:00:00Z',
        generator: 'cartographer-engine/1.0.0',
      };

      const result = AtlasManifestV1Schema.safeParse(validManifest);
      expect(result.success).toBe(true);
    });

    test('rejects invalid mode', () => {
      const invalidManifest = {
        atlasVersion: '1.0',
        formatVersion: '1.0.0',
        owner: { name: 'Cai Frazier' },
        consumers: ['Continuum SEO'],
        mode: 'invalid_mode',
        hashing: {
          algorithm: 'sha256',
          urlKeyAlgo: 'sha1',
          rawHtmlHash: 'sha256 of raw HTTP body',
          domHash: 'sha256 of document.documentElement.outerHTML',
        },
        parts: {
          page_metadata: ['page_metadata/part-001.jsonl.zst'],
        },
        schemas: {
          page_metadata: 'schemas/page_metadata.v1.schema.json#1',
        },
        datasets: {},
        configIncluded: false,
        redactionApplied: false,
        notes: [],
        integrity: { files: {} },
        createdAt: '2025-10-26T14:00:00Z',
        generator: 'cartographer-engine/1.0.0',
      };

      const result = AtlasManifestV1Schema.safeParse(invalidManifest);
      expect(result.success).toBe(false);
    });
  });

  describe('AtlasCapabilitiesV1Schema', () => {
    test('validates capabilities', () => {
      const validCapabilities = {
        version: 'v1',
        capabilities: ['seo.core', 'a11y.core', 'replay.html'],
        compatibility: {
          minSdkVersion: '1.0.0',
          breakingChanges: [],
        },
      };

      const result = AtlasCapabilitiesV1Schema.safeParse(validCapabilities);
      expect(result.success).toBe(true);
    });

    test('rejects invalid version', () => {
      const invalidCapabilities = {
        version: 'v2',
        capabilities: ['seo.core'],
        compatibility: {
          minSdkVersion: '1.0.0',
          breakingChanges: [],
        },
      };

      const result = AtlasCapabilitiesV1Schema.safeParse(invalidCapabilities);
      expect(result.success).toBe(false);
    });
  });

  describe('ProvenanceRecordV1Schema', () => {
    test('validates provenance record', () => {
      const validProvenance = {
        datasetName: 'page_metadata.v1',
        producer: {
          app: 'cartographer',
          version: '1.0.0',
          module: 'extractor-page-metadata',
        },
        createdAt: '2025-10-26T14:00:00Z',
        inputs: [],
        parameters: {
          mode: 'full',
        },
        output: {
          recordCount: 100,
          hashSha256: 'a'.repeat(64),
        },
      };

      const result = ProvenanceRecordV1Schema.safeParse(validProvenance);
      expect(result.success).toBe(true);
    });

    test('validates provenance with inputs', () => {
      const validProvenance = {
        datasetName: 'page_metadata.v1',
        producer: {
          app: 'cartographer',
          version: '1.0.0',
          module: 'extractor-page-metadata',
        },
        createdAt: '2025-10-26T14:00:00Z',
        inputs: [
          {
            dataset: 'page_metadata.v1',
            hashSha256: 'a'.repeat(64),
          },
        ],
        parameters: {
          mode: 'full',
        },
        output: {
          recordCount: 100,
          hashSha256: 'b'.repeat(64),
        },
      };

      const result = ProvenanceRecordV1Schema.safeParse(validProvenance);
      expect(result.success).toBe(true);
    });
  });
});

describe('flattenPageMetadataRecord', () => {
  const nestedRecord: PageMetadataDatasetRecordV1 = {
    pageId: '550e8400-e29b-41d4-a716-446655440000',
    url: 'https://example.com/page',
    core: {
      title: 'Example Page',
      titleLength: 12,
      metaDescription: 'An example page',
      descriptionLength: 15,
      h1: 'Example',
      canonicalTag: 'https://example.com/page',
      language: 'en',
      charset: 'utf-8',
      favicon: 'https://example.com/favicon.ico',
      viewport: 'width=device-width, initial-scale=1',
      themeColor: '#ffffff',
      generator: 'Next.js',
    },
    indexing: {
      robotsMeta: 'index, follow',
      xRobotsTag: 'noarchive',
      robotsDirectives: {
        noindex: false,
        nofollow: false,
        noarchive: true,
      },
    },
    social: {
      openGraph: { 'og:title': 'Example', 'og:type': 'website' },
      twitterCard: { 'twitter:card': 'summary' },
    },
    resourceHints: {
      preload: ['https://example.com/font.woff2'],
      prefetch: [],
    },
    capturedAt: '2025-10-26T14:00:00Z',
  };

  test('flattens nested record to top-level fields', () => {
    const flat = flattenPageMetadataRecord(nestedRecord);

    expect(flat.pageId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(flat.url).toBe('https://example.com/page');
    expect(flat.capturedAt).toBe('2025-10-26T14:00:00Z');

    // Core fields promoted to top level
    expect(flat.title).toBe('Example Page');
    expect(flat.titleLength).toBe(12);
    expect(flat.metaDescription).toBe('An example page');
    expect(flat.h1).toBe('Example');
    expect(flat.canonicalTag).toBe('https://example.com/page');
    expect(flat.language).toBe('en');
    expect(flat.charset).toBe('utf-8');
    expect(flat.favicon).toBe('https://example.com/favicon.ico');
    expect(flat.themeColor).toBe('#ffffff');
    expect(flat.generator).toBe('Next.js');

    // Indexing fields promoted to top level
    expect(flat.robotsMeta).toBe('index, follow');
    expect(flat.xRobotsTag).toBe('noarchive');
    expect(flat.robotsDirectives).toEqual({ noindex: false, nofollow: false, noarchive: true });

    // Social fields promoted to top level
    expect(flat.openGraph).toEqual({ 'og:title': 'Example', 'og:type': 'website' });
    expect(flat.twitterCard).toEqual({ 'twitter:card': 'summary' });

    // Resource hints preserved as sub-object
    expect(flat.resourceHints).toEqual({ preload: ['https://example.com/font.woff2'], prefetch: [] });
  });

  test('nested groups are not present in flat output', () => {
    const flat = flattenPageMetadataRecord(nestedRecord);

    // Nested containers should not appear
    expect((flat as any).core).toBeUndefined();
    expect((flat as any).indexing).toBeUndefined();
    expect((flat as any).social).toBeUndefined();
  });

  test('handles optional resourceHints being undefined', () => {
    const { resourceHints, ...withoutHints } = nestedRecord;
    const flat = flattenPageMetadataRecord(withoutHints as PageMetadataDatasetRecordV1);

    expect(flat.resourceHints).toBeUndefined();
    expect(flat.title).toBe('Example Page');
  });

  test('preserves passthrough extra fields from core', () => {
    const recordWithExtras = {
      ...nestedRecord,
      core: { ...nestedRecord.core, customField: 'extra-value' },
    };
    const flat = flattenPageMetadataRecord(recordWithExtras as PageMetadataDatasetRecordV1);

    expect(flat.title).toBe('Example Page');
    expect((flat as any).customField).toBe('extra-value');
  });
});
