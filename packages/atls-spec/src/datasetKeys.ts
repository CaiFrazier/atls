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
 * The Atlas dataset registry: every dataset name an archive producer writes,
 * keyed by itself, in snake_case as it appears in .atls archives.
 *
 * Producers (Cartographer) and readers (the SDK's manifest diff) both take
 * their dataset lists from here, so a dataset added to the registry is written
 * and compared everywhere without a second hand-kept list drifting out of step.
 *
 * Fifteen of the names are the SDK's `CanonicalDatasetName` datasets. The other
 * six (sitemaps, sitemap_urls, extraction, quarantine, reconstruction_index,
 * frontier_ledger) are producer extensions that archives may also declare.
 */
export const ATLAS_DATASET_KEYS = {
  navigation: "navigation",
  page_metadata: "page_metadata",
  content: "content",
  assets: "assets",
  structured_data: "structured_data",
  technology: "technology",
  render_state: "render_state",
  performance: "performance",
  accessibility: "accessibility",
  security: "security",
  responses: "responses",
  resources: "resources",
  sitemaps: "sitemaps",
  sitemap_urls: "sitemap_urls",
  extraction: "extraction",
  events: "events",
  pipeline_failures: "pipeline_failures",
  pipeline_alerts: "pipeline_alerts",
  quarantine: "quarantine",
  reconstruction_index: "reconstruction_index",
  frontier_ledger: "frontier_ledger",
} as const;

/** A dataset name from the Atlas dataset registry. */
export type AtlasDatasetKey = typeof ATLAS_DATASET_KEYS[keyof typeof ATLAS_DATASET_KEYS];
