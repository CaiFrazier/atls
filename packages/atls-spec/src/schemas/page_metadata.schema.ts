/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 page_metadata Dataset Schema
 *
 * This schema describes the on-disk format of page_metadata dataset records.
 * It matches the nested shape written by the Cartographer engine (ArtifactWriter).
 *
 * NOTE: This was previously aliased to PageRecordSchema (flat, ~20 required fields),
 * which did not match the actual storage format. It now correctly points to
 * PageMetadataDatasetRecordV1Schema (nested: core, indexing, social, resourceHints).
 *
 * For the flat consumer-facing shape, use `flattenPageMetadataRecord()` from
 * `pageMetadataMapping.ts`.
 *
 * For runtime composite validation of the full in-memory PageRecord (~200 fields
 * spanning multiple datasets), use PageRecordSchema from runtime-core.schema.ts.
 */

import { z } from 'zod';
import { PageMetadataDatasetRecordV1Schema } from './cartographer-datasets.schema.js';

export const PageMetadataRecordV1Schema = PageMetadataDatasetRecordV1Schema;

export type PageMetadataRecordV1 = z.infer<typeof PageMetadataRecordV1Schema>;
