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
 * BUG-0114: archives that store part files only under the short alias folders
 * (`pages/`, `edges/`) must still yield through the long-name readers. Manifest
 * keys stay the long names. These fixtures force that fallback.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { openAtlas, select } from "../src/index.js";
import { openZipHandle } from "../src/reader.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let archive: FixtureArchive;

beforeAll(async () => {
  archive = await createFixtureArchive({ aliasFolders: true });
});

afterAll(async () => {
  await archive?.cleanup();
});

describe("alias dataset folders — BUG-0114", () => {
  test("fixture sanity: parts live ONLY under the alias folders", async () => {
    // Guards the guard: if the fixture silently reverted to canonical folder
    // names, every test below would pass without exercising the fallback.
    const handle = await openZipHandle(archive.path);
    try {
      expect(handle.listPartFiles("page_metadata" as never)).toHaveLength(0);
      expect(handle.listPartFiles("navigation" as never)).toHaveLength(0);
      expect(handle.listPartFiles("pages" as never)).toHaveLength(1);
      expect(handle.listPartFiles("edges" as never)).toHaveLength(1);
    } finally {
      handle.close();
    }
  });

  test("typed readers yield records via the alias-folder fallback (THE 0-records regression guard)", async () => {
    const atlas = await openAtlas(archive.path);
    try {
      let pageCount = 0;
      for await (const page of atlas.readers.pageMetadata()) {
        expect(page.url).toBe(archive.pageUrl);
        pageCount++;
      }
      expect(pageCount).toBeGreaterThan(0);

      let edgeRecordCount = 0;
      for await (const nav of atlas.readers.navigation()) {
        expect((nav as any).sourceUrl).toBe(archive.pageUrl);
        edgeRecordCount++;
      }
      expect(edgeRecordCount).toBeGreaterThan(0);
    } finally {
      atlas.close();
    }
  });

  test("select() resolves the alias folder too", async () => {
    let count = 0;
    for await (const page of select(archive.path, {
      dataset: "page_metadata",
      where: (record: any) => record.core?.title === "Fixture Page",
    })) {
      expect(page.url).toBe(archive.pageUrl);
      count++;
    }
    expect(count).toBe(1);
  });

  test("datasets set still advertises the canonical names", async () => {
    const atlas = await openAtlas(archive.path);
    try {
      expect(atlas.datasets.has("page_metadata" as never)).toBe(true);
      expect(atlas.datasets.has("navigation" as never)).toBe(true);
    } finally {
      atlas.close();
    }
  });
});
