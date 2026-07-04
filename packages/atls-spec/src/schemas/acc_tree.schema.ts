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
 * Atlas Accessibility Tree Dataset Schema
 */

import { z } from 'zod';

/**
 * Landmark information
 */
export const LandmarkSchema = z.object({
  role: z.string().describe('ARIA role (e.g., "banner", "navigation", "main")'),
  name: z.string().optional().describe('Accessible name'),
  nodeId: z.string().describe('Internal node ID for reference'),
});

/**
 * Tab order entry
 */
export const TabOrderEntrySchema = z.object({
  index: z.number().int().nonnegative().describe('Tab order index'),
  nodeId: z.string().describe('Internal node ID for reference'),
  focusable: z.boolean().describe('Whether the node is focusable'),
});

/**
 * Accessibility Tree Record v1.0 Schema
 * 
 * Stores accessibility tree snapshots for offline WCAG audits.
 * Tree is serialized to JSON and compressed with Zstandard.
 */
export const AccTreeRecordV1Schema = z.object({
  // ===== Identity =====
  pageId: z.string().uuid().describe('Foreign key to page_metadata page_id'),
  
  // ===== Serialized Tree =====
  nodesZstd: z.string().describe('Zstandard-compressed JSON array of accessibility nodes (base64 encoded)'),
  nodeCount: z.number().int().nonnegative().describe('Total number of nodes in the accessibility tree before compression'),
  
  // ===== Extracted Features =====
  landmarks: z.array(LandmarkSchema).describe('ARIA landmarks for navigation'),
  tabOrder: z.array(TabOrderEntrySchema).describe('Keyboard navigation tab order'),
});

export type AccTreeRecordV1 = z.infer<typeof AccTreeRecordV1Schema>;
export type Landmark = z.infer<typeof LandmarkSchema>;
export type TabOrderEntry = z.infer<typeof TabOrderEntrySchema>;
