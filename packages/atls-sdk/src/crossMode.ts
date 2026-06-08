/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

/**
 * Cross-mode identity linkage utility.
 *
 * Builds a linkage table that joins pages from multiple Atlas archives
 * (different crawl modes of the same site) on their URL. This is a
 * post-processing / analysis utility — it does not modify archives.
 *
 * Philosophy: "capture, don't interpret." This utility surfaces factual
 * URL-based identity links across archives without making judgments
 * about equivalence beyond URL matching.
 */

import type { AtlasReader } from "./index.js";

/**
 * A single entry in the cross-mode index, keyed by URL.
 * Each field corresponds to a render mode and holds the page_id from that archive.
 */
export interface CrossModeEntry {
  /** The URL used as the join key (from page_metadata records) */
  url: string;
  /** page_id from a raw-mode archive, if present */
  raw_page_id?: string;
  /** page_id from a prerender-mode archive, if present */
  prerender_page_id?: string;
  /** page_id from a full-mode archive, if present */
  full_page_id?: string;
  /** Number of archives that contain this URL */
  mode_count: number;
}

/**
 * Result of building a cross-mode index.
 */
export interface CrossModeIndex {
  /** All entries keyed by URL */
  entries: Map<string, CrossModeEntry>;
  /** URLs present in multiple archives */
  shared: CrossModeEntry[];
  /** Summary of archives that contributed to the index */
  sources: Array<{
    mode: string;
    domain: string;
    totalPages: number;
  }>;
}

/**
 * Resolve the effective render mode label for an archive.
 *
 * Uses specLevel from the summary (1=raw, 2=prerender, 3=full),
 * falling back to the dominant renderModes counter, then to
 * configSnapshot.effective.mode if available.
 */
function resolveMode(reader: AtlasReader): "raw" | "prerender" | "full" {
  const specLevel = reader.summary?.crawlContext?.specLevel;
  if (specLevel === 1) return "raw";
  if (specLevel === 2) return "prerender";
  if (specLevel === 3) return "full";

  // Fallback: dominant mode from stats.renderModes
  const modes = reader.summary?.stats?.renderModes;
  if (modes) {
    let best: "raw" | "prerender" | "full" = "prerender";
    let bestCount = -1;
    for (const key of ["raw", "prerender", "full"] as const) {
      const count = modes[key] ?? 0;
      if (count > bestCount) {
        bestCount = count;
        best = key;
      }
    }
    if (bestCount > 0) return best;
  }

  // Fallback: configSnapshot
  const effective = reader.summary?.configSnapshot?.effective as Record<string, unknown> | undefined;
  if (effective?.mode === "raw" || effective?.mode === "prerender" || effective?.mode === "full") {
    return effective.mode;
  }

  return "prerender";
}

/**
 * Build a cross-mode identity index from multiple Atlas archives.
 *
 * Iterates page_metadata from each archive, extracts `page_id` and `url`,
 * and joins them into a single table keyed by URL. The result lets
 * consumers answer "which page_ids across archives represent the same URL?"
 *
 * @param readers - Two or more opened AtlasReader instances (different modes of the same site)
 * @returns CrossModeIndex with per-URL linkage
 *
 * @example
 * ```typescript
 * const prerender = await openAtlas("./site_prerender.atls");
 * const full = await openAtlas("./site_full.atls");
 * const index = await buildCrossModeIndex([prerender, full]);
 *
 * for (const entry of index.shared) {
 *   console.log(entry.url, entry.prerender_page_id, entry.full_page_id);
 * }
 *
 * prerender.close();
 * full.close();
 * ```
 */
export async function buildCrossModeIndex(readers: AtlasReader[]): Promise<CrossModeIndex> {
  if (readers.length < 2) {
    throw new Error("buildCrossModeIndex requires at least 2 AtlasReader instances");
  }

  const entries = new Map<string, CrossModeEntry>();
  const sources: CrossModeIndex["sources"] = [];

  for (const reader of readers) {
    const mode = resolveMode(reader);
    const pageIdField = `${mode}_page_id` as keyof CrossModeEntry;

    sources.push({
      mode,
      domain: reader.summary?.identity?.domain ?? "unknown",
      totalPages: reader.summary?.stats?.totalPages ?? 0,
    });

    for await (const record of reader.readers.pageMetadata()) {
      const url = record.url;
      const pageId = record.page_id;
      if (!url || !pageId) continue;

      let entry = entries.get(url);
      if (!entry) {
        entry = { url, mode_count: 0 };
        entries.set(url, entry);
      }

      // Only set if not already claimed by this mode
      if (!entry[pageIdField]) {
        (entry as any)[pageIdField] = pageId;
        entry.mode_count++;
      }
    }
  }

  const shared = Array.from(entries.values()).filter(e => e.mode_count > 1);

  return { entries, shared, sources };
}
