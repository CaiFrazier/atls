/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 Provenance Schema
 */

import { z } from 'zod';
import { JsonValueSchema } from './json-value.schema.js';

/**
 * Producer information
 */
export const ProducerSchema = z.object({
  app: z.string().describe('Application that produced this dataset (e.g., "cartographer")'),
  version: z.string().describe('Version of the application (e.g., "1.0.0")'),
  module: z.string().optional().describe('Specific module or extractor (e.g., "extractor-pages")'),
});

/**
 * Input dataset reference
 */
export const InputReferenceSchema = z.object({
  dataset: z.string().describe('Name of input dataset (e.g., "page_metadata.v1")'),
  hash_sha256: z.string().regex(/^[a-f0-9]{64}$/).describe('SHA-256 hash of input dataset'),
});

/**
 * Output metadata
 */
export const OutputMetadataSchema = z.object({
  record_count: z.number().int().nonnegative().describe('Number of records produced'),
  hash_sha256: z.string().regex(/^[a-f0-9]{64}$/).describe('SHA-256 hash of output dataset'),
});

/**
 * Provenance Record v1.0 Schema
 * 
 * Tracks the lineage of each dataset: what produced it, from what inputs,
 * with what parameters, and when. Essential for reproducibility and auditing.
 */
export const ProvenanceRecordV1Schema = z.object({
  dataset_name: z.string().describe('Name of the dataset produced (e.g., "page_metadata.v1")'),
  producer: ProducerSchema.describe('Information about the producer application/module'),
  created_at: z.string().datetime().describe('ISO 8601 timestamp when dataset was created'),
  inputs: z.array(InputReferenceSchema).describe('Input datasets used (empty for initial extraction)'),
  parameters: z.record(JsonValueSchema).describe('Parameters used for production (e.g., {"mode": "full"})'),
  output: OutputMetadataSchema.describe('Metadata about the produced output'),
});

export type ProvenanceRecordV1 = z.infer<typeof ProvenanceRecordV1Schema>;
