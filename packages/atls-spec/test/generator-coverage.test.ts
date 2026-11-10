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
 * Generator Coverage Check
 *
 * Fails if the number of registered Zod schemas in the index exceeds the
 * number of entries in the generator's schemaMap. This ensures new schemas
 * cannot be added without updating the generator.
 */

import { describe, test, expect } from 'vitest';
import { schemaMap } from '../src/schemas/generator.js';
import * as allExports from '../src/schemas/index.js';

/**
 * Every public Zod schema whose export name ends with "V1Schema" or "Schema"
 * (and represents a top-level record/archive type) should have a generator entry.
 *
 * Intentionally excluded:
 * - AuditResultRecordV1Schema — owned by Horizon, not emitted by crawl engine
 * - Sub-schemas (LandmarkSchema, TabOrderEntrySchema, DatasetMetadataSchema, etc.)
 * - Runtime-core schemas (PageRecordSchema, EdgeRecordSchema, etc.)
 * - Utility schemas (CompatibilitySchema, ProducerSchema, etc.)
 */
const INTENTIONALLY_EXCLUDED = new Set([
  // Horizon-owned, not a Cartographer dataset
  'AuditResultRecordV1Schema',
  // Sub-schemas and building blocks (not standalone datasets)
  'JsonValueSchema',
  'LandmarkSchema',
  // Embedded in page_metadata.media.screenshots and reconstruction_index refs.
  'ScreenshotTileSchema',
  'ScreenshotReferenceSchema',
  // B2: per-form sub-schema embedded in SecurityDatasetRecordV1Schema.forms[]
  'SecurityFormV1Schema',
  'TabOrderEntrySchema',
  'DatasetMetadataSchema',
  'BlobStorageMetadataSchema',
  'PrivacyPolicySchema',
  'RobotsPolicySchema',
  'CompatibilitySchema',
  'ProducerSchema',
  'InputReferenceSchema',
  'OutputMetadataSchema',
  // Field-level provenance tagging (sub-schema, not a standalone dataset)
  'RecordMetaSchema',
  // Capabilities seal sub-schemas (embedded in capabilities.v1.json, not standalone)
  'ExtractorManifestEntrySchema',
  'SealReconciliationSchema',
  'CapabilitiesSealSchema',
  // Runtime-core validation schemas (internal, not archive datasets)
  'PageRecordSchema',
  'EdgeRecordSchema',
  'AssetRecordSchema',
  'ErrorRecordSchema',
  'ResponseRecordSchema',
  'DOMSnapshotRecordSchema',
]);

/** Exported names that are Zod schemas (have a .safeParse method). */
function getExportedZodSchemaNames(): string[] {
  return Object.entries(allExports)
    .filter(([name, value]) =>
      name.endsWith('Schema') &&
      typeof value === 'object' &&
      value !== null &&
      'safeParse' in value
    )
    .map(([name]) => name);
}

describe('JSON Schema generator coverage', () => {
  test('schemaMap has entries for all non-excluded Zod schemas', () => {
    const allSchemaNames = getExportedZodSchemaNames();
    const generatorNames = new Set(schemaMap.map(entry => entry.name));

    const uncoveredSchemas = allSchemaNames.filter(
      name => !INTENTIONALLY_EXCLUDED.has(name)
    );

    // Each uncovered schema should have a matching Zod object in schemaMap
    const generatorZodObjects = new Set(schemaMap.map(entry => entry.schema));
    const missing = uncoveredSchemas.filter(name => {
      const schema = (allExports as Record<string, unknown>)[name];
      return !generatorZodObjects.has(schema);
    });

    expect(missing, `Zod schemas missing from generator schemaMap: ${missing.join(', ')}`).toEqual([]);
  });

  test('schemaMap generates at least 22 schemas', () => {
    expect(schemaMap.length).toBeGreaterThanOrEqual(22);
  });

  test('schemaMap has no duplicate names', () => {
    const names = schemaMap.map(entry => entry.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes, `Duplicate schema names: ${dupes.join(', ')}`).toEqual([]);
  });
});
