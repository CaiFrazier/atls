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
 *
 * Two kinds of row share this schema:
 *  - Terminal rows — the crawled request's final response (2xx/4xx/5xx, or the
 *    statusCode-0 "no response" sentinel). These always carry a body: `encoding`
 *    and `bodyBlobRef` are present. The producer guarantees this at the write
 *    gate; the schema keeps them optional only so the redirect-row shape below
 *    can share this schema without a discriminated union (V1 must remain a plain
 *    ZodObject — runtime-core.schema.ts calls `.passthrough()` on it).
 *  - Redirect rows — one row per intermediate 3xx hop of a redirect chain,
 *    keyed by that hop's requested `url`, with `isRedirect: true`, the 3xx
 *    `statusCode`, and the resolved `location`. These have no body, so
 *    `encoding`/`bodyBlobRef` are absent. Redirect auditing (Screaming Frog
 *    parity) and `export --report redirects` read these rows.
 */
export const ResponseRecordV1Schema = z.object({
  // ===== Identity =====
  pageId: z.string().uuid().describe('Foreign key to page_metadata pageId'),

  // ===== Request / Response Metadata =====
  url: z.string().describe('Requested URL'),
  finalUrl: z.string().describe('Final URL after redirects'),
  // Bounded. min(0), not min(100). The producer legitimately emits
  // statusCode 0 as a "no HTTP response" sentinel (BlobStore.ts writeResponseBody
  // `metadata?.statusCode ?? 0`; WARC import falls back to 0 for unparseable
  // status lines). Real HTTP statuses are 100-599; 0 means none was received.
  statusCode: z.number().int().min(0).max(599).describe('HTTP status code (0 = no HTTP response received)'),
  statusText: z.string().optional().describe('HTTP status text'),
  requestMethod: z.string().optional().describe('HTTP method used for the request (e.g., GET)'),
  responseType: z.string().optional().describe('Response type (from fetch/render pipeline)'),
  fromCache: z.boolean().optional().describe('Whether the response was served from cache'),
  redirectChain: z.array(z.string()).optional().describe('Redirect chain (if any)'),
  redirectChainLength: z.number().optional().describe('Number of redirect hops'),
  // ===== Redirect rows =====
  // Present on rows that represent a single 3xx hop of a redirect chain, keyed
  // by the hop's requested `url`. Terminal (non-redirect) rows omit these.
  isRedirect: z.boolean().optional().describe('True when this row is a single 3xx redirect hop (no body captured)'),
  location: z.string().optional().describe('Resolved Location target of a 3xx response (the next hop URL)'),
  redirectType: z.string().optional().describe('Classified redirect type (e.g. "permanent", "temporary", "meta-refresh")'),
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
  // Optional so redirect (3xx hop) rows, which capture no body, can omit it.
  // The producer sets it on every terminal row.
  encoding: z.string().optional().describe('Character encoding (e.g., "utf-8", "iso-8859-1"); absent on redirect hop rows'),

  // ===== Blob Reference =====
  // Optional so redirect (3xx hop) rows, which capture no body, can omit it.
  // The producer sets it on every terminal row.
  bodyBlobRef: z.string().optional().describe('Reference to HTML body in blob storage (e.g., "sha256/ab/cd/abcd..."); absent on redirect hop rows'),

  // ===== Rendered DOM (full mode only) =====
  renderedBodyBlobRef: z.string().optional().describe('Reference to post-JavaScript rendered HTML body in blob storage (full mode only)'),
  renderedDomHash: z.string().optional().describe('SHA-256 hash of the rendered DOM outerHTML (full mode only)'),
});

export type ResponseRecordV1 = z.infer<typeof ResponseRecordV1Schema>;
