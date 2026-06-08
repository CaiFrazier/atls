/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import type { AtlasManifest } from "./types.js";

/**
 * Canonical dataset names compared by default when diffing manifests.
 */
const DEFAULT_DIFF_DATASETS: readonly string[] = [
  "navigation",
  "page_metadata",
  "content",
  "assets",
  "structured_data",
  "technology",
  "security",
  "performance",
  "render_state",
  "accessibility",
  "responses",
  "resources",
  "events",
  "pipeline_failures",
] as const;

/** Per-dataset delta in a manifest diff. */
export interface DatasetDelta {
  dataset: string;
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
  /** Override the list of dataset names to compare. Defaults to the 14 canonical datasets. */
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
