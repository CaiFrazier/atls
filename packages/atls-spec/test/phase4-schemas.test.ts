/**
 * Copyright © 2025 Cai Frazier.
 * Tests for Phase 4 schemas
 */

import { describe, test, expect } from 'vitest';
import {
  RenderRecordV1Schema,
  NavigationRecordV1Schema,
  AuditResultRecordV1Schema,
} from '../src/schemas/index.js';

describe('Render Record Schema', () => {
  test('validates a valid render record', () => {
    const validRecord = {
      pageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      mode: 'full' as const,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0...',
      renderStartedAt: '2025-01-01T00:00:00.000Z',
      renderCompletedAt: '2025-01-01T00:00:01.500Z',
      renderDurationMs: 1500,
      domContentLoaded: true,
      loadEventFired: true,
      networkIdle: true,
      scriptsEnabled: true,
      stylesEnabled: true,
      imagesEnabled: true,
      consoleErrors: [],
      requestCount: 42,
      failedRequests: 2,
      firstPaintMs: 300,
      firstContentfulPaintMs: 350,
      domInteractiveMs: 800,
    };
    
    const result = RenderRecordV1Schema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });
  
  test('rejects invalid mode', () => {
    const invalidRecord = {
      pageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      mode: 'invalid',
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0...',
      renderStartedAt: '2025-01-01T00:00:00.000Z',
      renderCompletedAt: '2025-01-01T00:00:01.500Z',
      renderDurationMs: 1500,
      domContentLoaded: true,
      loadEventFired: true,
      networkIdle: true,
      scriptsEnabled: true,
      stylesEnabled: true,
      imagesEnabled: true,
      consoleErrors: [],
      requestCount: 42,
      failedRequests: 2,
    };
    
    const result = RenderRecordV1Schema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
  });
});

describe('Navigation Dataset Record Schema', () => {
  test('validates a nested navigation record', () => {
    const validRecord = {
      pageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      sourceUrl: 'https://example.com/page1',
      edges: [
        {
          sourceUrl: 'https://example.com/page1',
          targetUrl: 'https://example.com/page2',
          anchorText: 'Click here',
          nofollow: false,
          isExternal: false,
          location: 'main',
          linkType: 'content',
        },
      ],
      redirectChain: [],
      hreflang: [],
      pagination: { hasPrevNext: false },
      capturedAt: '2025-01-01T00:00:00.000Z',
    };

    const result = NavigationRecordV1Schema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });
  
  test('validates record with external edge', () => {
    const record = {
      pageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      sourceUrl: 'https://example.com/page1',
      edges: [
        {
          targetUrl: 'https://external.com',
          anchorText: 'External Link',
          nofollow: false,
          isExternal: true,
          location: 'other',
          linkType: 'external',
        },
      ],
      capturedAt: '2025-01-01T00:00:00.000Z',
    };

    const result = NavigationRecordV1Schema.safeParse(record);
    expect(result.success).toBe(true);
  });
});

describe('Audit Result Record Schema', () => {
  test('validates WCAG violation', () => {
    const validRecord = {
      auditId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      pageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
      auditedAt: '2025-01-01T00:00:00.000Z',
      auditorVersion: 'horizon-1.0.0',
      wcagLevel: 'AA' as const,
      ruleId: '1.4.3',
      ruleName: 'Contrast (Minimum)',
      severity: 'serious' as const,
      selector: 'div.content > p',
      xpath: '/html/body/div[1]/p',
      htmlSnippet: '<p style="color: #777; background: #fff">Text</p>',
      description: 'Text has insufficient contrast ratio',
      impact: 'Users with low vision may struggle to read this text',
      remediation: 'Increase contrast ratio to at least 4.5:1',
      nodeCount: 5,
      relatedRuleIds: ['1.4.6', '1.4.11'],
    };
    
    const result = AuditResultRecordV1Schema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });
});
