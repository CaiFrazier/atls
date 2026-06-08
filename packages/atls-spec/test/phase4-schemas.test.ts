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
      page_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      mode: 'full' as const,
      viewport: { width: 1920, height: 1080 },
      user_agent: 'Mozilla/5.0...',
      render_started_at: '2025-01-01T00:00:00.000Z',
      render_completed_at: '2025-01-01T00:00:01.500Z',
      render_duration_ms: 1500,
      dom_content_loaded: true,
      load_event_fired: true,
      network_idle: true,
      scripts_enabled: true,
      styles_enabled: true,
      images_enabled: true,
      console_errors: [],
      request_count: 42,
      failed_requests: 2,
      first_paint_ms: 300,
      first_contentful_paint_ms: 350,
      dom_interactive_ms: 800,
    };
    
    const result = RenderRecordV1Schema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });
  
  test('rejects invalid mode', () => {
    const invalidRecord = {
      page_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      mode: 'invalid',
      viewport: { width: 1920, height: 1080 },
      user_agent: 'Mozilla/5.0...',
      render_started_at: '2025-01-01T00:00:00.000Z',
      render_completed_at: '2025-01-01T00:00:01.500Z',
      render_duration_ms: 1500,
      dom_content_loaded: true,
      load_event_fired: true,
      network_idle: true,
      scripts_enabled: true,
      styles_enabled: true,
      images_enabled: true,
      console_errors: [],
      request_count: 42,
      failed_requests: 2,
    };
    
    const result = RenderRecordV1Schema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
  });
});

describe('Navigation Dataset Record Schema', () => {
  test('validates a nested navigation record', () => {
    const validRecord = {
      page_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      sourceUrl: 'https://example.com/page1',
      edges: [
        {
          sourceUrl: 'https://example.com/page1',
          targetUrl: 'https://example.com/page2',
          anchorText: 'Click here',
          nofollow: false,
          isExternal: false,
          location: 'main',
          link_type: 'content',
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
      page_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      sourceUrl: 'https://example.com/page1',
      edges: [
        {
          targetUrl: 'https://external.com',
          anchorText: 'External Link',
          nofollow: false,
          isExternal: true,
          location: 'other',
          link_type: 'external',
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
      audit_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      page_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
      audited_at: '2025-01-01T00:00:00.000Z',
      auditor_version: 'horizon-1.0.0',
      wcag_level: 'AA' as const,
      rule_id: '1.4.3',
      rule_name: 'Contrast (Minimum)',
      severity: 'serious' as const,
      selector: 'div.content > p',
      xpath: '/html/body/div[1]/p',
      html_snippet: '<p style="color: #777; background: #fff">Text</p>',
      description: 'Text has insufficient contrast ratio',
      impact: 'Users with low vision may struggle to read this text',
      remediation: 'Increase contrast ratio to at least 4.5:1',
      node_count: 5,
      related_rule_ids: ['1.4.6', '1.4.11'],
    };
    
    const result = AuditResultRecordV1Schema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });
});
