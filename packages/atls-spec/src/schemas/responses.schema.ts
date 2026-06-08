/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 Responses Dataset Schema
 */

import { z } from 'zod';

/**
 * Response Record v1.0 Schema
 * 
 * Stores raw HTML response bodies in blob storage for offline replay.
 * Essential for recomputing SEO signals, accessibility audits, and diffs.
 */
export const ResponseRecordV1Schema = z.object({
  // ===== Identity =====
  page_id: z.string().uuid().describe('Foreign key to page_metadata page_id'),

  // ===== Request / Response Metadata =====
  url: z.string().describe('Requested URL'),
  final_url: z.string().describe('Final URL after redirects'),
  status_code: z.number().describe('HTTP status code'),
  status_text: z.string().optional().describe('HTTP status text'),
  request_method: z.string().optional().describe('HTTP method used for the request (e.g., GET)'),
  response_type: z.string().optional().describe('Response type (from fetch/render pipeline)'),
  from_cache: z.boolean().optional().describe('Whether the response was served from cache'),
  redirect_chain: z.array(z.string()).optional().describe('Redirect chain (if any)'),
  redirect_chain_length: z.number().optional().describe('Number of redirect hops'),
  content_type: z.string().optional().describe('Response Content-Type'),
  content_length: z.number().optional().describe('Response Content-Length'),
  headers: z.record(z.string()).optional().describe('Normalized response headers'),

  // ===== Timing =====
  fetch_started_at: z.string().datetime().optional().describe('Fetch start timestamp (ISO)'),
  fetch_completed_at: z.string().datetime().optional().describe('Fetch complete timestamp (ISO)'),
  render_started_at: z.string().datetime().optional().describe('Render start timestamp (ISO)'),
  render_completed_at: z.string().datetime().optional().describe('Render complete timestamp (ISO)'),
  fetch_ms: z.number().optional().describe('Fetch duration (ms)'),
  render_ms: z.number().optional().describe('Render duration (ms)'),
  render_mode: z.string().optional().describe('Render mode used (raw/prerender/full)'),
  nav_end_reason: z.string().optional().describe('Navigation end reason (load/networkidle/timeout/error/fetch)'),

  // ===== Encoding =====
  encoding: z.string().describe('Character encoding (e.g., "utf-8", "iso-8859-1")'),

  // ===== Blob Reference =====
  body_blob_ref: z.string().describe('Reference to HTML body in blob storage (e.g., "sha256/ab/cd/abcd...")'),

  // ===== Rendered DOM (full mode only) =====
  rendered_body_blob_ref: z.string().optional().describe('Reference to post-JavaScript rendered HTML body in blob storage (full mode only)'),
  rendered_dom_hash: z.string().optional().describe('SHA-256 hash of the rendered DOM outerHTML (full mode only)'),
});

export type ResponseRecordV1 = z.infer<typeof ResponseRecordV1Schema>;
