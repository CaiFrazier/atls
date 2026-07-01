/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 Accessibility Tree Dataset Schema
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
