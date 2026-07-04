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

import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { openAtlas, select, MalformedRecordError } from "../src/index.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let archive: FixtureArchive;
let unsupportedVersionArchive: FixtureArchive;
let prereleaseVersionArchive: FixtureArchive;
let corruptJsonArchive: FixtureArchive;
let multiRecordArchive: FixtureArchive;

beforeAll(async () => {
  archive = await createFixtureArchive();
  unsupportedVersionArchive = await createFixtureArchive({ formatVersionValue: "2.0.0" });
  prereleaseVersionArchive = await createFixtureArchive({ formatVersionValue: "1.0.0-rc.1" });
  corruptJsonArchive = await createFixtureArchive({
    corruptLines: { dataset: "navigation", lines: ["NOT_VALID_JSON", "{also broken"] },
  });
  multiRecordArchive = await createFixtureArchive({
    corruptLines: {
      dataset: "navigation",
      lines: [
        JSON.stringify({ pageId: "extra-1", sourceUrl: "https://example.com/extra1", edges: [], capturedAt: new Date().toISOString() }),
        JSON.stringify({ pageId: "extra-2", sourceUrl: "https://example.com/extra2", edges: [], capturedAt: new Date().toISOString() }),
      ],
    },
  });
});

afterAll(async () => {
  await archive?.cleanup();
  await unsupportedVersionArchive?.cleanup();
  await prereleaseVersionArchive?.cleanup();
  await corruptJsonArchive?.cleanup();
  await multiRecordArchive?.cleanup();
});

describe("Atlas reader", () => {
  test("openAtlas exposes datasets and page metadata", async () => {
    const atlas = await openAtlas(archive.path);

    expect(atlas.manifest).toBeDefined();
    expect(atlas.summary).toBeDefined();
    expect(atlas.datasets.has("page_metadata")).toBe(true);
    expect(atlas.datasets.has("navigation")).toBe(true);
    expect(atlas.datasets.has("responses")).toBe(true);

    let count = 0;
    for await (const page of atlas.readers.pageMetadata()) {
      expect((page as any).url).toBe(archive.pageUrl);
      expect((page as any).title).toBe("Fixture Page");
      count++;
    }

    expect(count).toBe(1);
  });

  test("getBlob resolves response bodies", async () => {
    const atlas = await openAtlas(archive.path);
    const responses: Array<{ body_blob_ref: string }> = [];

    for await (const response of atlas.readers.responses()) {
      responses.push(response as { body_blob_ref: string });
    }

    expect(responses.length).toBe(1);
    const getBlob = typeof atlas.getBlob === "function"
      ? atlas.getBlob
      : async (ref: string) => {
          const reader = await import("../dist/reader.js");
          return reader.readBlob(archive.path, ref);
        };
    const payload = await getBlob(responses[0].bodyBlobRef);
    expect(Buffer.isBuffer(payload)).toBe(true);
    expect(payload.toString("utf-8")).toBe(archive.blobBody.toString("utf-8"));
  });

  test("select filters datasets", async () => {
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

  test("select projects flat fields", async () => {
    const results: any[] = [];
    for await (const page of select(archive.path, {
      dataset: "page_metadata",
      fields: ["url", "capturedAt"],
    })) {
      results.push(page);
    }

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe(archive.pageUrl);
    expect(results[0].capturedAt).toBeDefined();
    expect(results[0].pageId).toBeUndefined();
  });

  test("select projects one-level nested fields via dot notation", async () => {
    const results: any[] = [];
    for await (const page of select(archive.path, {
      dataset: "page_metadata",
      fields: ["url", "core.title"],
    })) {
      results.push(page);
    }

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe(archive.pageUrl);
    expect(results[0].core.title).toBe("Fixture Page");
    expect(results[0].core.meta).toBeUndefined();
  });

  test("select projects two-level nested fields via dot notation", async () => {
    const results: any[] = [];
    for await (const page of select(archive.path, {
      dataset: "page_metadata",
      fields: ["core.meta.description"],
    })) {
      results.push(page);
    }

    expect(results).toHaveLength(1);
    expect(results[0].core.meta.description).toBe("A fixture description");
  });

  test("select returns undefined for missing intermediate paths", async () => {
    const results: any[] = [];
    for await (const page of select(archive.path, {
      dataset: "page_metadata",
      fields: ["url", "nonexistent.nested.field"],
    })) {
      results.push(page);
    }

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe(archive.pageUrl);
    expect(results[0].nonexistent).toBeUndefined();
  });

  test("BUG-0056 (fixed): select() on an unknown dataset name throws instead of silently returning nothing", async () => {
    await expect(async () => {
      for await (const _ of select(archive.path, { dataset: "page_metdata" as any })) {
        /* should never yield */
      }
    }).rejects.toThrow(/Unknown Atlas dataset/);
  });

  test("select() on a legitimate-but-absent dataset still returns zero records without throwing", async () => {
    // "render_state" is a real canonical dataset name; this fixture (raw mode)
    // simply doesn't have one. That must stay a silent empty iteration, not
    // an AtlasUnknownDatasetError — only unrecognized names should throw.
    const results: unknown[] = [];
    for await (const record of select(archive.path, { dataset: "render_state" })) {
      results.push(record);
    }
    expect(results).toHaveLength(0);
  });

  test("BUG-0228 (fixed): select() on a corrupt JSON line throws MalformedRecordError", async () => {
    await expect(async () => {
      for await (const _ of select(corruptJsonArchive.path, { dataset: "navigation" })) {
        /* should throw before completing */
      }
    }).rejects.toThrow(MalformedRecordError);
  });

  test("rejects unsupported archive format versions on open", async () => {
    await expect(openAtlas(unsupportedVersionArchive.path)).rejects.toThrow(
      'Unsupported Atlas archive formatVersion "2.0.0". SDK supports 1.x.x archives only.'
    );
  });

  test("warns when opening deprecated pre-release format versions", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const atlas = await openAtlas(prereleaseVersionArchive.path);
      expect(atlas).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        '[Atlas SDK] Deprecated pre-release formatVersion "1.0.0-rc.1" detected.'
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("stats.corruptedRecordCount starts at zero for a clean archive", async () => {
    const atlas = await openAtlas(archive.path);
    expect(atlas.stats.corruptedRecordCount).toBe(0);
    // Iterate to confirm it stays at zero
    for await (const _ of atlas.readers.navigation()) { /* drain */ }
    expect(atlas.stats.corruptedRecordCount).toBe(0);
    atlas.close();
  });
});

describe("Malformed record error policy", () => {
  test("strict mode (default) throws MalformedRecordError on corrupt records", async () => {
    const atlas = await openAtlas(corruptJsonArchive.path);
    const records: unknown[] = [];
    await expect(async () => {
      for await (const record of atlas.readers.navigation()) {
        records.push(record);
      }
    }).rejects.toThrow(MalformedRecordError);
    atlas.close();
  });

  test("strict: true explicitly throws MalformedRecordError", async () => {
    const atlas = await openAtlas(corruptJsonArchive.path, { strict: true });
    await expect(async () => {
      for await (const _ of atlas.readers.navigation()) { /* drain */ }
    }).rejects.toThrow(MalformedRecordError);
    atlas.close();
  });

  test("strict: false skips corrupt records and increments corruptedRecordCount", async () => {
    const atlas = await openAtlas(corruptJsonArchive.path, { strict: false });
    const records: unknown[] = [];
    for await (const record of atlas.readers.navigation()) {
      records.push(record);
    }
    // The fixture contains 1 valid navigation record + 2 corrupt lines
    expect(records.length).toBe(1);
    expect(atlas.stats.corruptedRecordCount).toBe(2);
    atlas.close();
  });

  test("strict: false does not throw on malformed JSON", async () => {
    const atlas = await openAtlas(corruptJsonArchive.path, { strict: false });
    // Should not throw
    for await (const _ of atlas.readers.navigation()) { /* drain */ }
    atlas.close();
  });

  test("MalformedRecordError exposes dataset and reason", async () => {
    const atlas = await openAtlas(corruptJsonArchive.path);
    try {
      for await (const _ of atlas.readers.navigation()) { /* drain */ }
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedRecordError);
      const mre = err as InstanceType<typeof MalformedRecordError>;
      expect(mre.dataset).toBe("navigation");
      expect(mre.reason).toContain("invalid JSON");
    } finally {
      atlas.close();
    }
  });
});

describe("BUG-0094(a) (fixed): abort mid-iteration terminates cleanly", () => {
  test("calling close() mid-iteration ends the generator without throwing", async () => {
    const atlas = await openAtlas(multiRecordArchive.path);
    const records: unknown[] = [];
    for await (const record of atlas.readers.navigation()) {
      records.push(record);
      if (records.length === 1) {
        atlas.close();
      }
    }
    // The fixture has 3 navigation records total; closing after the first
    // must stop iteration early (proving the abort was actually observed)
    // without surfacing an "Operation aborted." error to the consumer.
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records.length).toBeLessThan(3);
  });
});
