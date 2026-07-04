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
 * Atlas page_metadata Dataset Schema
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
