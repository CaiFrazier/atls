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
 * Atlas Responses Dataset Schema
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
  pageId: z.string().uuid().describe('Foreign key to page_metadata pageId'),

  // ===== Request / Response Metadata =====
  url: z.string().describe('Requested URL'),
  finalUrl: z.string().describe('Final URL after redirects'),
  statusCode: z.number().describe('HTTP status code'),
  statusText: z.string().optional().describe('HTTP status text'),
  requestMethod: z.string().optional().describe('HTTP method used for the request (e.g., GET)'),
  responseType: z.string().optional().describe('Response type (from fetch/render pipeline)'),
  fromCache: z.boolean().optional().describe('Whether the response was served from cache'),
  redirectChain: z.array(z.string()).optional().describe('Redirect chain (if any)'),
  redirectChainLength: z.number().optional().describe('Number of redirect hops'),
  contentType: z.string().optional().describe('Response Content-Type'),
  contentLength: z.number().optional().describe('Response Content-Length'),
  headers: z.record(z.string()).optional().describe('Normalized response headers'),
  // RFC 6265 forbids comma-folding Set-Cookie; `headers['set-cookie']` above
  // (like every other header) is collapsed to its first value only. This field
  // is the authoritative, uncollapsed list of every Set-Cookie value observed.
  setCookie: z.array(z.string()).optional().describe('All Set-Cookie header values, uncollapsed'),

  // ===== Timing =====
  fetchStartedAt: z.string().datetime().optional().describe('Fetch start timestamp (ISO)'),
  fetchCompletedAt: z.string().datetime().optional().describe('Fetch complete timestamp (ISO)'),
  renderStartedAt: z.string().datetime().optional().describe('Render start timestamp (ISO)'),
  renderCompletedAt: z.string().datetime().optional().describe('Render complete timestamp (ISO)'),
  fetchMs: z.number().optional().describe('Fetch duration (ms)'),
  renderMs: z.number().optional().describe('Render duration (ms)'),
  renderMode: z.string().optional().describe('Render mode used (raw/prerender/full)'),
  navEndReason: z.string().optional().describe('Navigation end reason (load/networkidle/timeout/error/fetch)'),

  // ===== Encoding =====
  encoding: z.string().describe('Character encoding (e.g., "utf-8", "iso-8859-1")'),

  // ===== Blob Reference =====
  bodyBlobRef: z.string().describe('Reference to HTML body in blob storage (e.g., "sha256/ab/cd/abcd...")'),

  // ===== Rendered DOM (full mode only) =====
  renderedBodyBlobRef: z.string().optional().describe('Reference to post-JavaScript rendered HTML body in blob storage (full mode only)'),
  renderedDomHash: z.string().optional().describe('SHA-256 hash of the rendered DOM outerHTML (full mode only)'),
});

export type ResponseRecordV1 = z.infer<typeof ResponseRecordV1Schema>;
