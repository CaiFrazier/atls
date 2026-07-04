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
import { datasetPresent } from "./datasetPresence.js";

/**
 * Canonical dataset names compared by default when diffing manifests.
 *
 * Keyed as a `Record<CanonicalDatasetName, true>` rather than a plain array
 * literal so TypeScript enforces exhaustiveness: adding a new value to
 * `CanonicalDatasetName` without adding it here is a compile error, and vice
 * versa. This is the second hardcoded-dataset-list-drift bug found in this
 * codebase (see validate.ts's DATASET_ZOD_SCHEMAS) — worth the structural fix.
 */
const DEFAULT_DIFF_DATASET_MEMBERSHIP: Record<CanonicalDatasetName, true> = {
  navigation: true,
  page_metadata: true,
  content: true,
  assets: true,
  structured_data: true,
  technology: true,
  security: true,
  performance: true,
  render_state: true,
  accessibility: true,
  responses: true,
  resources: true,
  events: true,
  pipeline_failures: true,
  pipeline_alerts: true,
};
const DEFAULT_DIFF_DATASETS: readonly string[] = Object.keys(DEFAULT_DIFF_DATASET_MEMBERSHIP);

/** Per-dataset delta in a manifest diff. */
export interface DatasetDelta {
  dataset: string;
  /** Whether the dataset is present in manifest A (distinguishes "absent" from "present with count 0"). */
  presentA: boolean;
  /** Whether the dataset is present in manifest B (distinguishes "absent" from "present with count 0"). */
  presentB: boolean;
  countA: number;
  countB: number;
  countDelta: number;
  bytesA: number;
  bytesB: number;
  bytesDelta: number;
}

/** Result of comparing two Atlas manifests. */
export interface ManifestDiff {
  incompleteA: boolean;
  incompleteB: boolean;
  datasets: DatasetDelta[];
  totalBytesA: number;
  totalBytesB: number;
  totalBytesDelta: number;
}

function getDatasetCount(manifest: AtlasManifest, dataset: string): number {
  const meta = manifest.datasets?.[dataset];
  if (meta && typeof meta.recordCount === "number") {
    return meta.recordCount;
  }
  return 0;
}

function getDatasetBytes(manifest: AtlasManifest, dataset: string): number {
  const meta = manifest.datasets?.[dataset];
  if (meta && typeof meta.bytes === "number") {
    return meta.bytes;
  }
  return 0;
}

export interface DiffManifestsOptions {
  /** Override the list of dataset names to compare. Defaults to all 15 canonical datasets. */
  datasets?: readonly string[];
}

/**
 * Compare two Atlas manifests and return a structured delta.
 *
 * This is a pure-data comparison — it takes already-parsed manifests
 * and returns a structured result with no I/O or console output.
 */
export function diffManifests(
  a: AtlasManifest,
  b: AtlasManifest,
  options?: DiffManifestsOptions,
): ManifestDiff {
  const datasetNames = options?.datasets ?? DEFAULT_DIFF_DATASETS;

  const datasets: DatasetDelta[] = datasetNames.map((ds) => {
    const countA = getDatasetCount(a, ds);
    const countB = getDatasetCount(b, ds);
    const bytesA = getDatasetBytes(a, ds);
    const bytesB = getDatasetBytes(b, ds);
    return {
      dataset: ds,
      presentA: datasetPresent(a, ds),
      presentB: datasetPresent(b, ds),
      countA,
      countB,
      countDelta: countB - countA,
      bytesA,
      bytesB,
      bytesDelta: bytesB - bytesA,
    };
  });

  const totalBytesA = datasets.reduce((sum, d) => sum + d.bytesA, 0);
  const totalBytesB = datasets.reduce((sum, d) => sum + d.bytesB, 0);

  return {
    incompleteA: !!a.incomplete,
    incompleteB: !!b.incomplete,
    datasets,
    totalBytesA,
    totalBytesB,
    totalBytesDelta: totalBytesB - totalBytesA,
  };
}

/**
 * Format a ManifestDiff as a human-readable table string.
 */
export function formatManifestDiff(diff: ManifestDiff): string {
  const lines: string[] = [];
  lines.push("Atlas Diff Table");
  lines.push("----------------");
  lines.push(
    `incomplete: ${diff.incompleteA} → ${diff.incompleteB}`,
  );
  for (const d of diff.datasets) {
    const countStr = formatDelta(d.countA, d.countB);
    const bytesStr = formatDelta(d.bytesA, d.bytesB);
    lines.push(`${d.dataset.padEnd(18)} count: ${countStr}  bytes: ${bytesStr}`);
  }
  lines.push(
    `total bytes: ${formatDelta(diff.totalBytesA, diff.totalBytesB)}`,
  );
  return lines.join("\n");
}

function formatDelta(a: number, b: number): string {
  const delta = b - a;
  return `${a} → ${b} (${delta >= 0 ? "+" : ""}${delta})`;
}
