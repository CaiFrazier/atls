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
 * Atlas Resources Dataset Schema
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
  resId: z.string().uuid().describe('Unique identifier for this resource (UUID v4)'),
  ownerPageId: z.string().uuid().describe('Foreign key to page_metadata pageId that referenced this resource'),

  // ===== Resource Info =====
  url: z.string().url().describe('Absolute URL of the resource'),
  type: ResourceTypeEnum.describe('Resource type'),

  // ===== HTTP Response =====
  status: z.number().int().min(100).max(599).describe('HTTP status code'),
  contentType: z.string().describe('Content-Type header value'),

  // ===== Content Addressing =====
  // Optional: the 'dimensions' image-capture policy doesn't fetch/hash the body,
  // so no hash is available. Required+regex here previously quarantined every
  // dimensions-only image resource record as schema-invalid.
  hashBodySha256: z.string().regex(/^[a-f0-9]{64}$/).optional().describe('SHA-256 hash of resource body, when the body was fetched and hashed'),
  bodyBlobRef: z.string().optional().describe('Reference to resource body in blob storage'),

  // ===== Metadata =====
  sizeBytes: z.number().int().nonnegative().describe('Resource size in bytes'),
  critical: z.boolean().describe('Whether this resource is critical for initial render'),
});

export type ResourceRecordV1 = z.infer<typeof ResourceRecordV1Schema>;
