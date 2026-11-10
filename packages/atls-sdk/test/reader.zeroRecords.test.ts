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
 * Zero-record datasets had no fixture coverage. A dataset that
 * is PRESENT (listed in manifest.parts, part file on disk) but genuinely
 * empty (e.g. a crawl that discovered no assets) exercises the streaming
 * path's blank-line handling rather than the presence early-return, and must
 * read as empty rather than throwing or being reported invalid.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { openAtlas, select, validate } from "../src/index.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let archive: FixtureArchive;

beforeAll(async () => {
  archive = await createFixtureArchive({ emptyDatasets: ["assets"] });
});

afterAll(async () => {
  await archive?.cleanup();
});

describe("zero-record datasets (BUG-0123c)", () => {
  test("typed reader yields zero records without throwing", async () => {
    const atlas = await openAtlas(archive.path);
    try {
      // The dataset is still PRESENT (parts listed) — reads must route
      // through the streaming path, not the presence early-return.
      expect(atlas.datasets.has("assets" as never)).toBe(true);

      let count = 0;
      for await (const _asset of atlas.readers.assets()) {
        count++;
      }
      expect(count).toBe(0);
    } finally {
      atlas.close();
    }
  });

  test("select() yields zero records without throwing", async () => {
    let count = 0;
    for await (const _record of select(archive.path, { dataset: "assets" })) {
      count++;
    }
    expect(count).toBe(0);
  });

  test("the other datasets still read normally alongside the empty one", async () => {
    const atlas = await openAtlas(archive.path);
    try {
      let pages = 0;
      for await (const page of atlas.readers.pageMetadata()) {
        expect(page.url).toBe(archive.pageUrl);
        pages++;
      }
      expect(pages).toBe(1);
    } finally {
      atlas.close();
    }
  });

  test("validate() stays clean on an archive with an empty dataset", async () => {
    const result = await validate(archive.path);
    expect(result.valid).toBe(true);
  });
});
