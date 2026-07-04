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

import { describe, test, expect } from "vitest";
import { createWriteStream, promises as fs, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import archiver from "archiver";
import { compress } from "@mongodb-js/zstd";
import {
  AtlasDuplicateEntryError,
  AtlasResourceLimitError,
  MalformedRecordError,
  iterateParts,
  openAtlas,
  openZipHandle,
  readBlob,
} from "../src/index.js";
import type { DatasetName } from "../src/types.js";
import { createFixtureArchive } from "./helpers/fixtureArchive.js";

/** Build a minimal .atls-named zip with arbitrary (name -> contents) entries. */
async function buildZip(entries: Array<{ name: string; body: string | Buffer }>): Promise<string> {
  const path = join(tmpdir(), `readpath-${randomUUID()}.atls`);
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(path);
    const archive = archiver("zip", { store: true });
    out.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(out);
    for (const entry of entries) {
      archive.append(entry.body, { name: entry.name });
    }
    archive.finalize();
  });
  return path;
}

/** Count file descriptors held by this process (macOS/Linux expose /dev/fd). */
function openFdCount(): number {
  return readdirSync("/dev/fd").length;
}

describe("SDK read path (BUG-0110 / BUG-0111 / BUG-0073)", () => {
  test("BUG-0110: reads reuse the open archive handle instead of reopening by path", async () => {
    const fixture = await createFixtureArchive();
    // Work on a disposable copy so we can delete it mid-read.
    const copy = join(tmpdir(), `bug0110-${randomUUID()}.atls`);
    await fs.copyFile(fixture.path, copy);
    await fixture.cleanup();

    const atlas = await openAtlas(copy);
    try {
      const responses: Array<{ body_blob_ref: string }> = [];
      for await (const r of atlas.readers.responses()) {
        responses.push(r as { bodyBlobRef: string });
      }
      const ref = responses[0].bodyBlobRef;

      // First read while the file is still on disk.
      const first = await atlas.getBlob(ref);
      expect(first.length).toBeGreaterThan(0);

      // Remove the underlying file. On POSIX, the already-open fd survives unlink.
      // The pre-fix code reopened the archive by path on every read and would
      // throw ENOENT here; the fixed code streams from the held handle.
      await fs.rm(copy);

      const second = await atlas.getBlob(ref);
      expect(second.equals(first)).toBe(true);

      let pages = 0;
      for await (const _ of atlas.readers.pageMetadata()) {
        pages++;
      }
      expect(pages).toBe(1);
    } finally {
      atlas.close();
      await fs.rm(copy, { force: true });
    }
  });

  test("BUG-0225: rejects a zstd dataset part that expands past the configured limit", async () => {
    const payload = Buffer.concat([
      Buffer.from("{\"payload\":\""),
      Buffer.alloc(2 * 1024 * 1024, 0x41),
      Buffer.from("\"}\n"),
    ]);
    const compressed = Buffer.from(await compress(payload));
    const path = await buildZip([
      { name: "manifest.json", body: JSON.stringify({ formatVersion: "1.0.0" }) },
      { name: "summary.json", body: JSON.stringify({ stats: { totalPages: 1, totalErrors: 0 } }) },
      { name: "page_metadata/part-0001.jsonl.zst", body: compressed },
    ]);

    try {
      await expect((async () => {
        for await (const _ of iterateParts(path, "page_metadata" as DatasetName, {
          limits: { maxPartDecompressedBytes: 64 * 1024 },
        })) {
          // consume
        }
      })()).rejects.toBeInstanceOf(AtlasResourceLimitError);
    } finally {
      await fs.rm(path, { force: true });
    }
  });

  test("BUG-0225: rejects a zstd blob that expands past the configured limit", async () => {
    const payload = Buffer.alloc(2 * 1024 * 1024, 0x42);
    const compressed = Buffer.from(await compress(payload));
    const ref = `sha256/${"a".repeat(64)}`;
    const path = await buildZip([
      { name: "manifest.json", body: JSON.stringify({ formatVersion: "1.0.0" }) },
      { name: "summary.json", body: JSON.stringify({ stats: { totalPages: 0, totalErrors: 0 } }) },
      { name: `blobs/${ref}.zst`, body: compressed },
    ]);

    try {
      await expect(readBlob(path, ref, {
        limits: { maxBlobDecompressedBytes: 64 * 1024 },
      })).rejects.toBeInstanceOf(AtlasResourceLimitError);
    } finally {
      await fs.rm(path, { force: true });
    }
  });

  test("BUG-0230: rejects an uncompressed JSONL line that exceeds the configured limit", async () => {
    const path = await buildZip([
      { name: "manifest.json", body: JSON.stringify({ formatVersion: "1.0.0" }) },
      { name: "navigation/part-0001.jsonl", body: `{"payload":"${"x".repeat(2048)}"}\n` },
    ]);

    try {
      await expect((async () => {
        for await (const _ of iterateParts(path, "navigation" as DatasetName, {
          limits: { maxJsonlLineBytes: 128 },
        })) {
          // consume
        }
      })()).rejects.toBeInstanceOf(AtlasResourceLimitError);
    } finally {
      await fs.rm(path, { force: true });
    }
  });

  test("BUG-0227: rejects duplicate ZIP entry names while indexing", async () => {
    const path = await buildZip([
      { name: "manifest.json", body: "{}\n" },
      { name: "manifest.json", body: "{\"formatVersion\":\"1.0.0\"}\n" },
    ]);

    try {
      await expect(openZipHandle(path)).rejects.toBeInstanceOf(AtlasDuplicateEntryError);
    } finally {
      await fs.rm(path, { force: true });
    }
  });

  test("rejects path-traversal ZIP entry names while indexing", async () => {
    const path = await buildZip([
      { name: "manifest.json", body: "{}\n" },
      { name: "escape", body: "nope" },
    ]);

    try {
      const bytes = await fs.readFile(path);
      const original = Buffer.from("escape");
      const invalid = Buffer.from("..\\bad");
      let offset = bytes.indexOf(original);
      while (offset >= 0) {
        invalid.copy(bytes, offset);
        offset = bytes.indexOf(original, offset + invalid.length);
      }
      await fs.writeFile(path, bytes);

      await expect(openZipHandle(path)).rejects.toThrow(/invalid relative path|Invalid ZIP entry name/);
    } finally {
      await fs.rm(path, { force: true });
    }
  });

  test("BUG-0111: iterateParts streams an uncompressed .jsonl part line-by-line", async () => {
    const lines = [
      JSON.stringify({ page_id: "a", sourceUrl: "https://x/", edges: [] }),
      JSON.stringify({ page_id: "b", sourceUrl: "https://y/", edges: [] }),
      JSON.stringify({ page_id: "c", sourceUrl: "https://z/", edges: [] }),
    ];
    // Plain .jsonl entry (no .zst) exercises the streamUtf8Lines path.
    const path = await buildZip([
      { name: "manifest.json", body: JSON.stringify({ formatVersion: "1.0.0" }) },
      { name: "navigation/part-0001.jsonl", body: lines.join("\n") + "\n" },
    ]);
    try {
      const collected: string[] = [];
      for await (const line of iterateParts(path, "navigation" as DatasetName)) {
        collected.push(line);
      }
      expect(collected).toEqual(lines);
    } finally {
      await fs.rm(path, { force: true });
    }
  });

  test("BUG-0111: openEntryStream returns a real readable stream over entry bytes", async () => {
    const body = "line-1\nline-2\nline-3\n";
    const path = await buildZip([
      { name: "manifest.json", body: JSON.stringify({ formatVersion: "1.0.0" }) },
      { name: "notes.txt", body },
    ]);
    const handle = await openZipHandle(path);
    try {
      const stream = await handle.openEntryStream("notes.txt");
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString("utf-8")).toBe(body);
    } finally {
      handle.close();
      await fs.rm(path, { force: true });
    }
  });

  test("BUG-0073: a corrupt central directory does not leak a file descriptor per failed open", async () => {
    // Valid EOCD but a broken central-directory entry: open() succeeds, entry
    // indexing throws. The zipfile is opened autoClose:false, so the fix must
    // close it on the indexEntries failure.
    const valid = await buildZip([
      { name: "manifest.json", body: "{}\n" },
      { name: "navigation/part-0001.jsonl", body: "{}\n" },
    ]);
    const bytes = await fs.readFile(valid);
    await fs.rm(valid, { force: true });

    // Damage the first central-directory file header (sig 0x02014b50): set the
    // file-name length (offset +28) to an impossible value so entry parse fails.
    const cenSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    const cenAt = bytes.indexOf(cenSig);
    expect(cenAt).toBeGreaterThan(-1);
    bytes.writeUInt16LE(0xffff, cenAt + 28);

    const corrupt = join(tmpdir(), `bug0073-${randomUUID()}.atls`);
    await fs.writeFile(corrupt, bytes);

    try {
      // Warm up so any one-time fd allocations (module init, /dev/fd self-read)
      // are already counted before we measure.
      await expect(openZipHandle(corrupt)).rejects.toThrow();

      const before = openFdCount();
      const attempts = 40;
      for (let i = 0; i < attempts; i++) {
        await expect(openZipHandle(corrupt)).rejects.toThrow();
      }
      const after = openFdCount();

      // With the leak, fd count grows ~1 per failed open (~40). With the fix it
      // stays flat. Allow a small slack for unrelated runtime fd churn.
      expect(after - before).toBeLessThan(10);
    } finally {
      await fs.rm(corrupt, { force: true });
    }
  });
});

describe("BUG-0228 (fixed): readJson() surfaces a typed error on corrupt JSON", () => {
  test("a corrupt manifest.json throws MalformedRecordError instead of a generic Error", async () => {
    const path = await buildZip([{ name: "manifest.json", body: "NOT VALID JSON {" }]);
    try {
      await expect(openAtlas(path)).rejects.toThrow(MalformedRecordError);
    } finally {
      await fs.rm(path, { force: true });
    }
  });
});
