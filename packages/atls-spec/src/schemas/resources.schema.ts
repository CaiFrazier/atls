/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 Resources Dataset Schema
 */

import { z } from 'zod';

/**
 * Resource type enumeration
 */
export const ResourceTypeEnum = z.enum(['css', 'js', 'font', 'image']);

/**
 * Resource Record v1.0 Schema
 * 
 * Stores captured subresources (CSS, JS, fonts, images) for offline replay.
 * Captured based on replay tier: html+css captures CSS/fonts, full captures all.
 */
export const ResourceRecordV1Schema = z.object({
  // ===== Identity =====
  res_id: z.string().uuid().describe('Unique identifier for this resource (UUID v4)'),
  owner_page_id: z.string().uuid().describe('Foreign key to page_metadata page_id that referenced this resource'),
  
  // ===== Resource Info =====
  url: z.string().url().describe('Absolute URL of the resource'),
  type: ResourceTypeEnum.describe('Resource type'),
  
  // ===== HTTP Response =====
  status: z.number().int().min(100).max(599).describe('HTTP status code'),
  content_type: z.string().describe('Content-Type header value'),
  
  // ===== Content Addressing =====
  hash_body_sha256: z.string().regex(/^[a-f0-9]{64}$/).describe('SHA-256 hash of resource body'),
  body_blob_ref: z.string().optional().describe('Reference to resource body in blob storage'),
  
  // ===== Metadata =====
  size_bytes: z.number().int().nonnegative().describe('Resource size in bytes'),
  critical: z.boolean().describe('Whether this resource is critical for initial render'),
});

export type ResourceRecordV1 = z.infer<typeof ResourceRecordV1Schema>;
