/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 DOM Snapshot Dataset Schema
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
  page_id: z.string().uuid().describe('Foreign key to page_metadata page_id'),
  
  // ===== Snapshot Metadata =====
  base_url: z.string().url().describe('Base URL for resolving relative URLs in the DOM'),
  
  // ===== Serialized DOM =====
  dom_json_zstd: z.string().describe('Zstandard-compressed JSON serialization of DOM (base64 encoded)'),
  
  // ===== Render Context =====
  styles_applied: z.boolean().describe('Whether CSS styles were applied'),
  scripts_executed: z.boolean().describe('Whether JavaScript was executed'),
  
  // ===== Statistics =====
  node_count: z.number().int().nonnegative().describe('Total number of DOM nodes'),
  text_nodes: z.number().int().nonnegative().describe('Number of text nodes'),
  element_nodes: z.number().int().nonnegative().describe('Number of element nodes'),
});

export type DOMSnapshotRecordV1 = z.infer<typeof DOMSnapshotRecordV1Schema>;
