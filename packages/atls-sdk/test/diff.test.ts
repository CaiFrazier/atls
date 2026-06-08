import { describe, test, expect } from "vitest";
import { diffManifests, formatManifestDiff } from "../src/diff.js";
import type { AtlasManifest } from "../src/types.js";

function stubManifest(overrides: Partial<AtlasManifest> = {}): AtlasManifest {
  return {
    atlasVersion: "1.0",
    formatVersion: "1.0.0",
    owner: { name: "test" },
    consumers: [],
    hashing: {
      algorithm: "sha256",
      urlKeyAlgo: "sha1",
      rawHtmlHash: "sha256",
      domHash: "sha256",
    },
    parts: {
      navigation: [],
      page_metadata: [],
      content: [],
      assets: [],
      structured_data: [],
      technology: [],
      security: [],
      accessibility: [],
    },
    schemas: {
      navigation: "schemas/navigation.v1.schema.json",
      page_metadata: "schemas/page_metadata.v1.schema.json",
      content: "schemas/content.v1.schema.json",
      assets: "schemas/assets.v1.schema.json",
      structured_data: "schemas/structured_data.v1.schema.json",
      technology: "schemas/technology.v1.schema.json",
      security: "schemas/security.v1.schema.json",
      accessibility: "schemas/accessibility.v1.schema.json",
    },
    configIncluded: false,
    redactionApplied: false,
    ...overrides,
  };
}

describe("diffManifests", () => {
  test("returns zero deltas for identical manifests", () => {
    const m = stubManifest({
      datasets: {
        navigation: { recordCount: 10, bytes: 500 },
        content: { recordCount: 5, bytes: 200 },
      },
    });
    const diff = diffManifests(m, m);
    for (const d of diff.datasets) {
      expect(d.countDelta).toBe(0);
      expect(d.bytesDelta).toBe(0);
    }
    expect(diff.totalBytesDelta).toBe(0);
  });

  test("computes positive deltas when B has more records", () => {
    const a = stubManifest({
      datasets: { navigation: { recordCount: 10, bytes: 500 } },
    });
    const b = stubManifest({
      datasets: { navigation: { recordCount: 25, bytes: 1200 } },
    });
    const diff = diffManifests(a, b);
    const nav = diff.datasets.find((d) => d.dataset === "navigation")!;
    expect(nav.countA).toBe(10);
    expect(nav.countB).toBe(25);
    expect(nav.countDelta).toBe(15);
    expect(nav.bytesA).toBe(500);
    expect(nav.bytesB).toBe(1200);
    expect(nav.bytesDelta).toBe(700);
  });

  test("computes negative deltas when B has fewer records", () => {
    const a = stubManifest({
      datasets: { assets: { recordCount: 50, bytes: 3000 } },
    });
    const b = stubManifest({
      datasets: { assets: { recordCount: 30, bytes: 1800 } },
    });
    const diff = diffManifests(a, b);
    const assets = diff.datasets.find((d) => d.dataset === "assets")!;
    expect(assets.countDelta).toBe(-20);
    expect(assets.bytesDelta).toBe(-1200);
  });

  test("handles missing datasets as zero", () => {
    const a = stubManifest(); // no datasets
    const b = stubManifest({
      datasets: { navigation: { recordCount: 5, bytes: 100 } },
    });
    const diff = diffManifests(a, b);
    const nav = diff.datasets.find((d) => d.dataset === "navigation")!;
    expect(nav.countA).toBe(0);
    expect(nav.bytesA).toBe(0);
    expect(nav.countB).toBe(5);
    expect(nav.bytesB).toBe(100);
  });

  test("tracks incomplete flag from both manifests", () => {
    const a = stubManifest({ incomplete: true });
    const b = stubManifest({ incomplete: false });
    const diff = diffManifests(a, b);
    expect(diff.incompleteA).toBe(true);
    expect(diff.incompleteB).toBe(false);
  });

  test("computes total bytes across all compared datasets", () => {
    const a = stubManifest({
      datasets: {
        navigation: { recordCount: 1, bytes: 100 },
        content: { recordCount: 1, bytes: 200 },
      },
    });
    const b = stubManifest({
      datasets: {
        navigation: { recordCount: 2, bytes: 150 },
        content: { recordCount: 2, bytes: 350 },
      },
    });
    const diff = diffManifests(a, b);
    expect(diff.totalBytesA).toBe(300);
    expect(diff.totalBytesB).toBe(500);
    expect(diff.totalBytesDelta).toBe(200);
  });

  test("accepts custom dataset list via options", () => {
    const a = stubManifest({
      datasets: {
        navigation: { recordCount: 10, bytes: 500 },
        content: { recordCount: 5, bytes: 200 },
      },
    });
    const b = stubManifest({
      datasets: {
        navigation: { recordCount: 20, bytes: 1000 },
        content: { recordCount: 8, bytes: 400 },
      },
    });
    const diff = diffManifests(a, b, { datasets: ["navigation"] });
    expect(diff.datasets).toHaveLength(1);
    expect(diff.datasets[0].dataset).toBe("navigation");
    // totalBytes should only reflect the single dataset
    expect(diff.totalBytesA).toBe(500);
    expect(diff.totalBytesB).toBe(1000);
  });

  test("covers all 14 default datasets", () => {
    const diff = diffManifests(stubManifest(), stubManifest());
    const names = diff.datasets.map((d) => d.dataset);
    expect(names).toContain("navigation");
    expect(names).toContain("page_metadata");
    expect(names).toContain("content");
    expect(names).toContain("assets");
    expect(names).toContain("structured_data");
    expect(names).toContain("technology");
    expect(names).toContain("security");
    expect(names).toContain("performance");
    expect(names).toContain("render_state");
    expect(names).toContain("accessibility");
    expect(names).toContain("responses");
    expect(names).toContain("resources");
    expect(names).toContain("events");
    expect(names).toContain("pipeline_failures");
    expect(names).toHaveLength(14);
  });
});

describe("formatManifestDiff", () => {
  test("produces human-readable table", () => {
    const a = stubManifest({
      incomplete: false,
      datasets: { navigation: { recordCount: 10, bytes: 500 } },
    });
    const b = stubManifest({
      incomplete: true,
      datasets: { navigation: { recordCount: 20, bytes: 1200 } },
    });
    const diff = diffManifests(a, b);
    const text = formatManifestDiff(diff);
    expect(text).toContain("Atlas Diff Table");
    expect(text).toContain("incomplete: false → true");
    expect(text).toContain("navigation");
    expect(text).toContain("10 → 20 (+10)");
    expect(text).toContain("500 → 1200 (+700)");
    expect(text).toContain("total bytes:");
  });

  test("formats negative deltas correctly", () => {
    const a = stubManifest({
      datasets: { content: { recordCount: 30, bytes: 2000 } },
    });
    const b = stubManifest({
      datasets: { content: { recordCount: 10, bytes: 800 } },
    });
    const text = formatManifestDiff(diffManifests(a, b));
    expect(text).toContain("30 → 10 (-20)");
    expect(text).toContain("2000 → 800 (-1200)");
  });
});
