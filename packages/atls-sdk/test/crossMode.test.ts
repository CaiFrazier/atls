/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { openAtlas, buildCrossModeIndex } from "../src/index.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let prerenderArchive: FixtureArchive;
let fullArchive: FixtureArchive;

beforeAll(async () => {
  prerenderArchive = await createFixtureArchive({ specLevel: 2, renderMode: "prerender" });
  fullArchive = await createFixtureArchive({ specLevel: 3, renderMode: "full" });
});

afterAll(async () => {
  await prerenderArchive?.cleanup();
  await fullArchive?.cleanup();
});

describe("buildCrossModeIndex", () => {
  test("links pages across modes by URL", async () => {
    const prerender = await openAtlas(prerenderArchive.path);
    const full = await openAtlas(fullArchive.path);

    const index = await buildCrossModeIndex([prerender, full]);

    expect(index.entries.size).toBe(1);
    expect(index.shared).toHaveLength(1);

    const entry = index.shared[0];
    expect(entry.url).toBe(prerenderArchive.pageUrl);
    expect(entry.prerender_page_id).toBeDefined();
    expect(entry.full_page_id).toBeDefined();
    expect(entry.mode_count).toBe(2);

    expect(index.sources).toHaveLength(2);
    expect(index.sources.map(s => s.mode).sort()).toEqual(["full", "prerender"]);

    prerender.close();
    full.close();
  });

  test("rejects fewer than 2 readers", async () => {
    const prerender = await openAtlas(prerenderArchive.path);
    await expect(buildCrossModeIndex([prerender])).rejects.toThrow("at least 2");
    prerender.close();
  });

  test("non-overlapping URLs produce empty shared list", async () => {
    const arch1 = await createFixtureArchive({ specLevel: 2, renderMode: "prerender", pageUrl: "https://a.com/" });
    const arch2 = await createFixtureArchive({ specLevel: 3, renderMode: "full", pageUrl: "https://b.com/" });

    const reader1 = await openAtlas(arch1.path);
    const reader2 = await openAtlas(arch2.path);

    const index = await buildCrossModeIndex([reader1, reader2]);

    expect(index.entries.size).toBe(2);
    expect(index.shared).toHaveLength(0);

    reader1.close();
    reader2.close();
    await arch1.cleanup();
    await arch2.cleanup();
  });
});
