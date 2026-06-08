/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 Reconstruction Index Dataset Schema
 *
 * A per-page cross-reference generated at finalization time to enable
 * efficient frontend reconstruction from an Atlas archive. Each record
 * bundles all blob refs and navigation edges for a single page, eliminating
 * the need to scan multiple datasets to render a single view.
 */

import { z } from 'zod';

const SubresourceRefSchema = z.object({
  url: z.string().describe('Original absolute URL of the subresource'),
  blob_ref: z.string().describe('Reference to body in blob storage'),
});

const InternalLinkSchema = z.object({
  url: z.string().describe('Target URL of the link'),
  anchor_text: z.string().describe('Link anchor text'),
  target_page_id: z.string().uuid().optional().describe('Page ID of the target if crawled'),
});

export const ReconstructionIndexRecordV1Schema = z.object({
  // ===== Identity =====
  page_id: z.string().uuid().describe('Foreign key to page_metadata page_id'),
  url: z.string().describe('Canonical page URL'),
  final_url: z.string().describe('Final URL after redirects'),

  // ===== Page Metadata =====
  title: z.string().optional().describe('Page title'),
  favicon_blob_ref: z.string().optional().describe('Reference to favicon in blob storage'),

  // ===== Document Sources =====
  source_body_blob_ref: z.string().describe('Blob ref to original server HTML'),
  rendered_body_blob_ref: z.string().optional().describe('Blob ref to post-JS rendered HTML (full mode only)'),
  dom_snapshot_present: z.boolean().describe('Whether render_state contains a DOM snapshot for this page'),

  // ===== Subresource Blob Refs =====
  stylesheets: z.array(SubresourceRefSchema).describe('CSS stylesheet blob references'),
  scripts: z.array(SubresourceRefSchema).describe('JavaScript file blob references'),
  fonts: z.array(SubresourceRefSchema).describe('Web font blob references'),
  images: z.array(SubresourceRefSchema).describe('Image blob references'),

  // ===== Navigation =====
  internal_links: z.array(InternalLinkSchema).describe('Internal navigation links from this page'),

  // ===== Screenshots =====
  screenshot_desktop_blob_ref: z.string().optional().describe('Desktop screenshot blob reference'),
  screenshot_mobile_blob_ref: z.string().optional().describe('Mobile screenshot blob reference'),
});

export type ReconstructionIndexRecordV1 = z.infer<typeof ReconstructionIndexRecordV1Schema>;
