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
 * Atlas DOM Snapshot Dataset Schema
 */

import { z } from 'zod';

/**
 * DOM Snapshot Record v1.0 Schema
 * 
 * Stores post-render DOM snapshots for offline accessibility audits and analysis.
 * DOM is serialized to JSON and compressed with Zstandard.
 */
export const DOMSnapshotRecordV1Schema = z.object({
  // ===== Identity =====
  pageId: z.string().uuid().describe('Foreign key to page_metadata pageId'),

  // ===== Snapshot Metadata =====
  baseUrl: z.string().url().describe('Base URL for resolving relative URLs in the DOM'),

  // ===== Serialized DOM =====
  domJsonZstd: z.string().describe('Zstandard-compressed JSON serialization of DOM (base64 encoded)'),

  // ===== Render Context =====
  stylesApplied: z.boolean().describe('Whether CSS styles were applied'),
  scriptsExecuted: z.boolean().describe('Whether JavaScript was executed'),

  // ===== Statistics =====
  nodeCount: z.number().int().nonnegative().describe('Total number of DOM nodes'),
  textNodes: z.number().int().nonnegative().describe('Number of text nodes'),
  elementNodes: z.number().int().nonnegative().describe('Number of element nodes'),
});

export type DOMSnapshotRecordV1 = z.infer<typeof DOMSnapshotRecordV1Schema>;
