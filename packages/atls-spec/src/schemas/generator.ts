/**
 * Copyright © 2025 Cai Frazier.
 * JSON Schema Generator
 * 
 * Converts Zod schemas to JSON Schema format for validation and documentation.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as schemas from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SchemaMapping {
  name: string;
  schema: any;
}

export const schemaMap: SchemaMapping[] = [
  { name: 'manifest.v1', schema: schemas.AtlasManifestV1Schema },
  { name: 'capabilities.v1', schema: schemas.AtlasCapabilitiesV1Schema },
  { name: 'provenance.v1', schema: schemas.ProvenanceRecordV1Schema },
  { name: 'summary.v1', schema: schemas.AtlasSummarySchema },
  // Canonical Cartographer dataset schemas
  { name: 'page_metadata.v1', schema: schemas.PageMetadataRecordV1Schema },
  { name: 'navigation.v1', schema: schemas.NavigationDatasetRecordV1Schema },
  { name: 'content.v1', schema: schemas.ContentDatasetRecordV1Schema },
  { name: 'structured_data.v1', schema: schemas.StructuredDataDatasetRecordV1Schema },
  { name: 'technology.v1', schema: schemas.TechnologyDatasetRecordV1Schema },
  { name: 'render_state.v1', schema: schemas.RenderStateDatasetRecordV1Schema },
  { name: 'security.v1', schema: schemas.SecurityDatasetRecordV1Schema },
  { name: 'performance.v1', schema: schemas.PerformanceDatasetRecordV1Schema },
  { name: 'accessibility.v1', schema: schemas.AccessibilityDatasetRecordV1Schema },
  { name: 'responses.v1', schema: schemas.ResponseRecordV1Schema },
  { name: 'resources.v1', schema: schemas.ResourceRecordV1Schema },
  { name: 'dom_snapshot.v1', schema: schemas.DOMSnapshotRecordV1Schema },
  { name: 'acc_tree.v1', schema: schemas.AccTreeRecordV1Schema },
  { name: 'render.v1', schema: schemas.RenderRecordV1Schema },
  { name: 'pipeline_failures.v1', schema: schemas.PipelineFailureRecordV1Schema },
  { name: 'pipeline_alerts.v1', schema: schemas.PipelineAlertRecordV1Schema },
  { name: 'events.v1', schema: schemas.EventRecordV1Schema },
  { name: 'sitemaps.v1', schema: schemas.SitemapDatasetRecordV1Schema },
  { name: 'frontier_ledger.v1', schema: schemas.FrontierLedgerRecordV1Schema },
  { name: 'reconstruction_index.v1', schema: schemas.ReconstructionIndexRecordV1Schema },
  // NOTE: audit_results.v1 is intentionally excluded from Cartographer archives.
  // That schema is owned by Horizon (downstream analysis) and is not emitted by the crawl engine.
  // The schema remains available in @atls/spec for Horizon's use.
];

/**
 * Generate JSON Schema files from Zod schemas
 */
export async function generateJSONSchemas(): Promise<void> {
  const outputDir = join(__dirname, '../../dist/schemas');
  
  // Create output directory
  mkdirSync(outputDir, { recursive: true });
  
  console.log('Generating JSON Schemas...\n');
  
  for (const { name, schema } of schemaMap) {
    try {
      const jsonSchema = zodToJsonSchema(schema, {
        name,
        $refStrategy: 'none', // Inline all references
      });
      
      const outputPath = join(outputDir, `${name}.schema.json`);
      writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2));
      
      console.log(`✓ Generated: ${name}.schema.json`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error);
      process.exit(1);
    }
  }
  
  console.log(`\nSuccessfully generated ${schemaMap.length} JSON Schemas`);
}

// Run if called directly. Use path-normalized comparison so relative argv works.
const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  generateJSONSchemas().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
