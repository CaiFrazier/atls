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
    expect(entry.prerenderPageId).toBeDefined();
    expect(entry.fullPageId).toBeDefined();
    expect(entry.modeCount).toBe(2);

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

  test("BUG-0094(d) (fixed): two same-mode archives sharing a URL both count toward modeCount", async () => {
    const arch1 = await createFixtureArchive({ specLevel: 2, renderMode: "prerender", pageUrl: "https://same-mode.example.com/" });
    const arch2 = await createFixtureArchive({ specLevel: 2, renderMode: "prerender", pageUrl: "https://same-mode.example.com/" });

    const reader1 = await openAtlas(arch1.path);
    const reader2 = await openAtlas(arch2.path);

    const index = await buildCrossModeIndex([reader1, reader2]);

    expect(index.entries.size).toBe(1);
    expect(index.shared).toHaveLength(1);
    const entry = index.shared[0];
    expect(entry.modeCount).toBe(2);
    // Last-write-wins: the second (later-read) archive's pageId is retained.
    expect(entry.prerenderPageId).toBeDefined();

    reader1.close();
    reader2.close();
    await arch1.cleanup();
    await arch2.cleanup();
  });
});
