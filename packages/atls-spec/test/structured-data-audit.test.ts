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

import { describe, expect, test } from 'vitest';
import { StructuredDataDatasetRecordV1Schema } from '../src/schemas/index.js';

function record() {
  return {
    pageId: '550e8400-e29b-41d4-a716-446655440000',
    url: 'https://example.com/product',
    jsonLd: [{
      id: 'item-1',
      type: 'Product',
      payload: { '@context': 'https://schema.org', '@type': 'Product', name: { '@type': 'Person' } },
      source: 'head',
      diagnosticIds: ['item-1:VALUE_TYPE_MISMATCH:/name:name'],
    }],
    microdata: [],
    rdfa: [],
    openGraph: [],
    twitterCard: [],
    schemaTypes: ['Product'],
    schemaTypeTree: [],
    summary: {
      hasJsonLd: true,
      hasMicrodata: false,
      hasRdfa: false,
      hasOpenGraph: false,
      hasTwitterCard: false,
      itemCount: 1,
      bytesTotal: 100,
      truncated: false,
    },
    captureIssues: [],
    schemaOrgAudit: {
      engineVersion: 1,
      vocabularyVersion: '30.0',
      vocabularySourceUrl: 'https://schema.org/version/latest/schemaorg-current-https.jsonld',
      vocabularyReleasedAt: '2026-06-08',
      vocabularySha256: 'a'.repeat(64),
      outcome: 'findings',
      coverage: 'complete',
      diagnosticCounts: { error: 0, warning: 1, info: 0 },
      diagnostics: [{
        id: 'item-1:VALUE_TYPE_MISMATCH:/name:name',
        itemId: 'item-1',
        plane: 'schema_org',
        code: 'VALUE_TYPE_MISMATCH',
        level: 'warning',
        certainty: 'heuristic',
        path: '/name',
        property: 'name',
        expectedTypes: ['Text'],
        actualKind: 'object',
        actualTypes: ['Person'],
        message: 'name expects Text.',
      }],
    },
    validationIssues: [],
    capturedAt: '2026-09-04T17:00:00.000Z',
  };
}

describe('StructuredDataDatasetRecordV1Schema audit evidence', () => {
  test('accepts typed Schema.org audit evidence linked to captured items', () => {
    expect(StructuredDataDatasetRecordV1Schema.safeParse(record()).success).toBe(true);
  });

  test('rejects a diagnostic count that disagrees with the evidence', () => {
    const invalid = record();
    invalid.schemaOrgAudit.diagnosticCounts.warning = 0;
    expect(StructuredDataDatasetRecordV1Schema.safeParse(invalid).success).toBe(false);
  });

  test('rejects an outcome that contradicts the diagnostic evidence', () => {
    const invalid = record();
    invalid.schemaOrgAudit.outcome = 'no_findings';
    expect(StructuredDataDatasetRecordV1Schema.safeParse(invalid).success).toBe(false);
  });

  test('rejects duplicate diagnostic IDs', () => {
    const invalid = record();
    invalid.schemaOrgAudit.diagnostics.push({ ...invalid.schemaOrgAudit.diagnostics[0] });
    invalid.schemaOrgAudit.diagnosticCounts.warning = 2;
    expect(StructuredDataDatasetRecordV1Schema.safeParse(invalid).success).toBe(false);
  });

  test('rejects a diagnostic linked from the wrong item', () => {
    const invalid = record();
    invalid.jsonLd.push({
      id: 'item-2',
      type: 'Article',
      payload: { '@context': 'https://schema.org', '@type': 'Article' },
      source: 'head',
      diagnosticIds: [invalid.schemaOrgAudit.diagnostics[0].id],
    });
    invalid.jsonLd[0].diagnosticIds = [];
    expect(StructuredDataDatasetRecordV1Schema.safeParse(invalid).success).toBe(false);
  });

  test('rejects complete coverage when evidence records capture loss', () => {
    const invalid = record();
    invalid.schemaOrgAudit.diagnostics[0] = {
      ...invalid.schemaOrgAudit.diagnostics[0],
      plane: 'capture',
      code: 'CAPTURE_TRUNCATED',
      path: '',
      message: 'Capture was truncated.',
    };
    expect(StructuredDataDatasetRecordV1Schema.safeParse(invalid).success).toBe(false);
  });
});
