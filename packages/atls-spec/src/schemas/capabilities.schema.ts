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
 * Atlas Capabilities Schema
 */

import { z } from 'zod';

/**
 * Compatibility information
 */
export const CompatibilitySchema = z.object({
  minSdkVersion: z.string().describe('Minimum SDK version required to read this archive'),
  breakingChanges: z.array(z.string()).describe('List of breaking changes from previous versions'),
});

/**
 * Extractor manifest entry — self-declaration embedded in the seal block.
 */
export const ExtractorManifestEntrySchema = z.object({
  id: z.string().describe('Unique extractor identifier'),
  capabilities: z.array(z.string()).describe('Capability strings this extractor contributes to'),
  datasets: z.array(z.string()).describe('Dataset keys this extractor writes to'),
});

/**
 * Seal reconciliation — computed diff between declared and actual.
 */
export const SealReconciliationSchema = z.object({
  declaredCapabilities: z.array(z.string()).describe('Union of all extractor-declared capabilities'),
  activeCapabilities: z.array(z.string()).describe('Capabilities from extractors that actually ran'),
  datasetsWithRecords: z.array(z.string()).describe('Datasets that received at least one record'),
  orphanedCapabilities: z.array(z.string()).describe('Active capabilities whose datasets received no records'),
  undeclaredDatasets: z.array(z.string()).describe('Datasets with records not declared by any extractor'),
});

/**
 * Seal block — provenance link between extractor declarations and dataset outcomes.
 */
export const CapabilitiesSealSchema = z.object({
  extractors: z.array(ExtractorManifestEntrySchema).describe('Extractor manifests that participated'),
  reconciliation: SealReconciliationSchema.describe('Computed reconciliation of declared vs actual'),
  sealedAt: z.string().datetime().describe('ISO timestamp of seal computation'),
});

/**
 * Atlas Capabilities v1.0 Schema
 * 
 * Declares what operations are supported by this archive. Consumers can
 * check capabilities before attempting operations to fail fast.
 * 
 * Standard capabilities:
 * - seo.core: Basic SEO signals (title, meta, headers)
 * - seo.enhanced: Advanced SEO (structured data, OG, Twitter Card)
 * - a11y.core: Accessibility data (WCAG violations, color contrast)
 * - render.dom: Post-render DOM snapshots
 * - render.netlog: Network performance logs
 * - replay.html: HTML bodies stored for offline replay
 * - replay.css: CSS files stored for offline replay
 * - replay.js: JavaScript files stored for offline replay
 * - replay.fonts: Web fonts stored for offline replay
 * - replay.images: Images stored for offline replay
 */
export const AtlasCapabilitiesV1Schema = z.object({
  version: z.literal('v1').describe('Capabilities schema version'),
  capabilities: z.array(z.string()).describe('List of capability strings (e.g., ["seo.core", "a11y.core"])'),
  compatibility: CompatibilitySchema.describe('SDK compatibility requirements'),
  seal: CapabilitiesSealSchema.optional().describe('Reconciliation seal linking extractor declarations to dataset outcomes'),
});

export type AtlasCapabilitiesV1 = z.infer<typeof AtlasCapabilitiesV1Schema>;
export type CapabilitiesSeal = z.infer<typeof CapabilitiesSealSchema>;
export type ExtractorManifestEntry = z.infer<typeof ExtractorManifestEntrySchema>;
