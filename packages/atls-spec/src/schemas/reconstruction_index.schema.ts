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
 * Atlas Reconstruction Index Dataset Schema
 *
 * A per-page cross-reference generated at finalization time to enable
 * efficient frontend reconstruction from an Atlas archive. Each record
 * bundles all blob refs and navigation edges for a single page, eliminating
 * the need to scan multiple datasets to render a single view.
 */

import { z } from 'zod';

const SubresourceRefSchema = z.object({
  url: z.string().describe('Original absolute URL of the subresource'),
  blobRef: z.string().describe('Reference to body in blob storage'),
});

const InternalLinkSchema = z.object({
  url: z.string().describe('Target URL of the link'),
  anchorText: z.string().describe('Link anchor text'),
  targetPageId: z.string().uuid().optional().describe('Page ID of the target if crawled'),
});

export const ReconstructionIndexRecordV1Schema = z.object({
  // ===== Identity =====
  pageId: z.string().uuid().describe('Foreign key to page_metadata pageId'),
  url: z.string().describe('Canonical page URL'),
  finalUrl: z.string().describe('Final URL after redirects'),

  // ===== Page Metadata =====
  title: z.string().optional().describe('Page title'),
  faviconBlobRef: z.string().optional().describe('Reference to favicon in blob storage'),

  // ===== Document Sources =====
  sourceBodyBlobRef: z.string().describe('Blob ref to original server HTML'),
  renderedBodyBlobRef: z.string().optional().describe('Blob ref to post-JS rendered HTML (full mode only)'),
  domSnapshotPresent: z.boolean().describe('Whether render_state contains a DOM snapshot for this page'),

  // ===== Subresource Blob Refs =====
  stylesheets: z.array(SubresourceRefSchema).describe('CSS stylesheet blob references'),
  scripts: z.array(SubresourceRefSchema).describe('JavaScript file blob references'),
  fonts: z.array(SubresourceRefSchema).describe('Web font blob references'),
  images: z.array(SubresourceRefSchema).describe('Image blob references'),

  // ===== Navigation =====
  internalLinks: z.array(InternalLinkSchema).describe('Internal navigation links from this page'),

  // ===== Screenshots =====
  screenshotDesktopBlobRef: z.string().optional().describe('Desktop screenshot blob reference'),
  screenshotMobileBlobRef: z.string().optional().describe('Mobile screenshot blob reference'),
});

export type ReconstructionIndexRecordV1 = z.infer<typeof ReconstructionIndexRecordV1Schema>;
