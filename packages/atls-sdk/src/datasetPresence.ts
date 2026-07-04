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

import type { AtlasManifest, CanonicalDatasetName } from "./types.js";

/**
 * Canonical dataset names, derived from the `CanonicalDatasetName` union via
 * a `Record` so TypeScript enforces exhaustiveness (adding/removing a union
 * member without updating this list is a compile error).
 */
const CANONICAL_DATASET_NAME_MEMBERSHIP: Record<CanonicalDatasetName, true> = {
  navigation: true,
  page_metadata: true,
  content: true,
  structured_data: true,
  technology: true,
  render_state: true,
  security: true,
  pipeline_failures: true,
  pipeline_alerts: true,
  assets: true,
  responses: true,
  events: true,
  accessibility: true,
  performance: true,
  resources: true,
};
const CANONICAL_DATASET_NAMES: ReadonlySet<string> = new Set(Object.keys(CANONICAL_DATASET_NAME_MEMBERSHIP));

/**
 * Whether `canonicalName` (already resolved via toCanonicalDatasetName) is a
 * dataset name the SDK recognizes — either one of the statically-known
 * canonical names, or a name the manifest itself references (covering
 * forward-compatible/custom datasets). A name that is neither is almost
 * certainly a typo, not a legitimately-absent-in-this-archive dataset.
 */
export function isKnownDatasetName(manifest: AtlasManifest, canonicalName: string): boolean {
  if (CANONICAL_DATASET_NAMES.has(canonicalName)) {
    return true;
  }
  return collectDatasetNames(manifest).has(canonicalName);
}

/** Thrown when a dataset name requested via select() isn't present in the manifest. */
export class AtlasUnknownDatasetError extends Error {
  readonly code = "ATLAS_UNKNOWN_DATASET";

  constructor(readonly datasetName: string) {
    super(`Unknown Atlas dataset: "${datasetName}" is not present in this archive's manifest`);
    this.name = "AtlasUnknownDatasetError";
  }
}

/**
 * Shared dataset-presence detection, kept in its own module so both
 * index.ts and diff.ts can import it without creating an import cycle
 * (index.ts re-exports diff.ts's public API).
 */
export function datasetPresent(manifest: AtlasManifest, datasetName: string): boolean {
  const datasets = manifest.datasets ?? {};
  const meta = datasets[datasetName as keyof typeof datasets] as Record<string, any> | undefined;

  if (meta) {
    if (typeof meta.recordCount === "number" && meta.recordCount > 0) {
      return true;
    }
    if (typeof meta.present === "boolean") {
      return meta.present;
    }
    if (typeof meta.partCount === "number" && meta.partCount > 0) {
      return true;
    }
    if (typeof meta.parts === "number" && meta.parts > 0) {
      return true;
    }
    if (Array.isArray(meta.files) && meta.files.length > 0) {
      return true;
    }
  }

  const partsByDataset = manifest.parts as Record<string, string[]> | undefined;
  if (partsByDataset && Array.isArray(partsByDataset[datasetName]) && partsByDataset[datasetName].length > 0) {
    return true;
  }

  const coverageEntry = manifest.coverage?.matrix?.find(entry => entry.part === datasetName);
  if (coverageEntry) {
    if (coverageEntry.present) {
      return true;
    }
    if (typeof coverageEntry.row_count === "number" && coverageEntry.row_count > 0) {
      return true;
    }
  }

  return false;
}

export function collectDatasetNames(manifest: AtlasManifest): Set<string> {
  const names = new Set<string>();
  const datasets = manifest.datasets ?? {};
  for (const key of Object.keys(datasets)) {
    names.add(key);
  }

  const partsByDataset = manifest.parts as Record<string, string[]> | undefined;
  if (partsByDataset) {
    for (const key of Object.keys(partsByDataset)) {
      names.add(key);
    }
  }

  const coverage = manifest.coverage?.matrix ?? [];
  for (const entry of coverage) {
    names.add(entry.part);
  }

  return names;
}
