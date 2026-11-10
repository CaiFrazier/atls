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

import { afterEach, describe, expect, it } from "vitest";
import {
  describeArchive,
  describeDataset,
  readDatasetSlice,
  readRecord,
  readSchema,
  statBlob,
  openZipHandle,
  AtlasRecordNotFoundError,
} from "../src/index.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let fixture: FixtureArchive | null = null;

afterEach(async () => {
  if (fixture) {
    await fixture.cleanup();
    fixture = null;
  }
});

describe("describeArchive", () => {
  it("describes datasets, blobs, and identity without scanning records", async () => {
    fixture = await createFixtureArchive();
    const description = await describeArchive(fixture.path);

    expect(description.formatVersion).toBe("1.0.0");
    expect(description.mode).toBe("raw");
    expect(description.entryCount).toBeGreaterThan(0);
    expect(description.blobs.count).toBe(1);
    expect(description.blobs.storedBytes).toBeGreaterThan(0);

    const names = description.datasets.map((d) => d.name).sort();
    expect(names).toEqual(["assets", "navigation", "page_metadata", "responses"]);

    const pageMetadata = description.datasets.find((d) => d.name === "page_metadata")!;
    expect(pageMetadata.state).toBe("present");
    expect(pageMetadata.declaredRecordCount).toBe(1);
    expect(pageMetadata.partCount).toBe(1);
    expect(pageMetadata.parts[0]!.compressedBytes).toBeGreaterThan(0);
    expect(pageMetadata.schemaPath).toBe("schemas/page_metadata.v1.schema.json");
  });

  it("distinguishes empty from present", async () => {
    fixture = await createFixtureArchive({ emptyDatasets: ["assets"] });
    const description = await describeArchive(fixture.path);
    expect(description.datasets.find((d) => d.name === "assets")!.state).toBe("empty");
    expect(description.datasets.find((d) => d.name === "responses")!.state).toBe("present");
  });

  it("reports undeclared on-disk folders as unexpected", async () => {
    fixture = await createFixtureArchive({
      unlistedDatasetParts: { dataset: "mystery", records: [{ k: 1 }, { k: 2 }] },
    });
    const description = await describeArchive(fixture.path);
    const mystery = description.datasets.find((d) => d.name === "mystery")!;
    expect(mystery.state).toBe("unexpected");
    expect(mystery.partCount).toBe(1);
    expect(mystery.declaredRecordCount).toBeNull();
  });

  it("does not report meta, schemas, or blobs as unexpected datasets", async () => {
    for (const folder of ["meta", "schemas", "blobs"]) {
      fixture = await createFixtureArchive({
        unlistedDatasetParts: { dataset: folder, records: [{ k: 1 }] },
      });
      const description = await describeArchive(fixture.path);
      expect(description.datasets.find((d) => d.name === folder || d.folder === folder)).toBeUndefined();
      expect(description.datasets.some((d) => d.state === "unexpected")).toBe(false);
      await fixture.cleanup();
      fixture = null;
    }
  });

  it("reports declared-but-missing part files as corrupt", async () => {
    fixture = await createFixtureArchive({ omitPartFiles: ["responses"] });
    const description = await describeArchive(fixture.path);
    expect(description.datasets.find((d) => d.name === "responses")!.state).toBe("corrupt");
  });

  it("resolves short alias dataset folders", async () => {
    fixture = await createFixtureArchive({ aliasFolders: true });
    const description = await describeArchive(fixture.path);
    const pageMetadata = description.datasets.find((d) => d.name === "page_metadata")!;
    expect(pageMetadata.folder).toBe("pages");
    expect(pageMetadata.state).toBe("present");
    // The alias folder must not double-report as an unexpected dataset.
    expect(description.datasets.filter((d) => d.name === "pages" || d.folder === "pages")).toHaveLength(1);
  });

  it("works over a shared open handle", async () => {
    fixture = await createFixtureArchive();
    const handle = await openZipHandle(fixture.path);
    try {
      const description = await describeArchive(handle);
      const one = await describeDataset(handle, "navigation");
      expect(one).toEqual(description.datasets.find((d) => d.name === "navigation"));
    } finally {
      handle.close();
    }
  });
});

describe("readDatasetSlice", () => {
  it("pages across parts with continuous ordinals", async () => {
    // corruptLines (with VALID json) appends a second part to navigation,
    // giving a two-part dataset: part_00 has 1 record, part_corrupt has 2.
    fixture = await createFixtureArchive({
      corruptLines: { dataset: "navigation", lines: ['{"extra":1}', '{"extra":2}'] },
    });

    const all = await readDatasetSlice(fixture.path, "navigation", { limit: 100 });
    expect(all.records).toHaveLength(3);
    expect(all.nextCursor).toBeNull();
    expect(all.records.map((r) => r.ordinal)).toEqual([0, 1, 2]);
    const parts = new Set(all.records.map((r) => r.part));
    expect(parts.size).toBe(2);

    // Walk one record at a time; the concatenation must equal the full read.
    const walked: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page = await readDatasetSlice(fixture.path, "navigation", { cursor, limit: 1 });
      walked.push(...page.records.map((r) => r.json));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(walked).toEqual(all.records.map((r) => r.json));
  });

  it("rejects malformed cursors", async () => {
    fixture = await createFixtureArchive();
    await expect(
      readDatasetSlice(fixture.path, "navigation", { cursor: '{"part":-1}' }),
    ).rejects.toThrow(/Invalid dataset cursor/);
    await expect(
      readDatasetSlice(fixture.path, "navigation", { cursor: '{"part":1.5,"line":0,"ordinal":0}' }),
    ).rejects.toThrow(/Invalid dataset cursor/);
    await expect(
      readDatasetSlice(fixture.path, "navigation", {
        cursor: `{"part":${Number.MAX_SAFE_INTEGER + 2},"line":0,"ordinal":0}`,
      }),
    ).rejects.toThrow(/Invalid dataset cursor/);
  });

  it("rejects a limit or maxBytes that is not a positive integer", async () => {
    fixture = await createFixtureArchive();
    await expect(readDatasetSlice(fixture.path, "navigation", { limit: 0 })).rejects.toThrow(
      /limit must be a positive integer/,
    );
    await expect(readDatasetSlice(fixture.path, "navigation", { limit: 1.5 })).rejects.toThrow(RangeError);
    await expect(readDatasetSlice(fixture.path, "navigation", { maxBytes: 0 })).rejects.toThrow(
      /maxBytes must be a positive integer/,
    );
    await expect(readDatasetSlice(fixture.path, "navigation", { maxBytes: 1.2 })).rejects.toThrow(RangeError);
  });

  it("stops a slice at maxBytes and resumes at the unreturned row", async () => {
    fixture = await createFixtureArchive({
      corruptLines: { dataset: "page_metadata", lines: ['{"extra":1}', '{"extra":2}'] },
    });
    const first = await readDatasetSlice(fixture.path, "page_metadata", { limit: 1 });
    const bytes = Buffer.byteLength(first.records[0]!.json, "utf8");
    const bounded = await readDatasetSlice(fixture.path, "page_metadata", { limit: 100, maxBytes: bytes });
    expect(bounded.records).toHaveLength(1);
    expect(bounded.nextCursor).not.toBeNull();
    const next = await readDatasetSlice(fixture.path, "page_metadata", {
      cursor: bounded.nextCursor,
      limit: 1,
    });
    expect(next.records[0]!.ordinal).toBe(1);
    await expect(
      readDatasetSlice(fixture.path, "page_metadata", { maxBytes: 1 }),
    ).rejects.toMatchObject({ code: "ATLAS_RESOURCE_LIMIT" });
  });

  it("returns an empty slice for datasets with no parts", async () => {
    fixture = await createFixtureArchive();
    const slice = await readDatasetSlice(fixture.path, "performance", { limit: 10 });
    expect(slice.records).toHaveLength(0);
    expect(slice.nextCursor).toBeNull();
  });
});

describe("readRecord", () => {
  it("reads a record by global ordinal across parts", async () => {
    fixture = await createFixtureArchive({
      corruptLines: { dataset: "navigation", lines: ['{"extra":1}', '{"extra":2}'] },
    });
    const record = await readRecord(fixture.path, "navigation", 2);
    expect(record.ordinal).toBe(2);
    expect(JSON.parse(record.json)).toEqual({ extra: 2 });
  });

  it("throws AtlasRecordNotFoundError past the end and on invalid ordinals", async () => {
    fixture = await createFixtureArchive();
    await expect(readRecord(fixture.path, "navigation", 99)).rejects.toBeInstanceOf(
      AtlasRecordNotFoundError,
    );
    await expect(readRecord(fixture.path, "navigation", -1)).rejects.toBeInstanceOf(
      AtlasRecordNotFoundError,
    );
  });
});

describe("readSchema", () => {
  it("returns the archived schema when present", async () => {
    fixture = await createFixtureArchive({ includeSchemas: true });
    const result = await readSchema(fixture.path, "page_metadata");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("schemas/page_metadata.v1.schema.json");
    expect((result!.schema as { type?: string }).type).toBe("object");
  });

  it("returns null when the archive carries no schema", async () => {
    fixture = await createFixtureArchive();
    expect(await readSchema(fixture.path, "page_metadata")).toBeNull();
  });

  it("falls back to manifest.schemas when the dataset declares no schema path", async () => {
    fixture = await createFixtureArchive({
      manifestSchemas: { performance: "schemas/performance.v1.schema.json" },
    });
    const result = await readSchema(fixture.path, "performance");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("schemas/performance.v1.schema.json");
    expect((result!.schema as { title?: string }).title).toBe("manifest.schemas");
  });

  it("prefers a dataset schema declaration over manifest.schemas", async () => {
    fixture = await createFixtureArchive({
      includeSchemas: true,
      manifestSchemas: { page_metadata: "schemas/from-manifest.schema.json" },
    });
    const result = await readSchema(fixture.path, "page_metadata");
    expect(result!.path).toBe("schemas/page_metadata.v1.schema.json");
  });
});

describe("statBlob", () => {
  it("reports size metadata without inflating", async () => {
    fixture = await createFixtureArchive();
    const stat = await statBlob(fixture.path, fixture.blobRef);
    expect(stat.exists).toBe(true);
    expect(stat.path).toBe(`blobs/${fixture.blobRef}.zst`);
    expect(stat.storedBytes).toBeGreaterThan(0);
    // Stored bytes are the zstd payload, strictly smaller than nothing inflated.
    expect(stat.storedBytes).toBeLessThan(10_000);
  });

  it("reports missing blobs as exists:false", async () => {
    fixture = await createFixtureArchive();
    const stat = await statBlob(fixture.path, "sha256/00/00/" + "0".repeat(64));
    expect(stat.exists).toBe(false);
    expect(stat.storedBytes).toBe(0);
  });
});
