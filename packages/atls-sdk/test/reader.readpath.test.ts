/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { describe, test, expect } from "vitest";
import { createWriteStream, promises as fs, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import archiver from "archiver";
import { openAtlas, openZipHandle, iterateParts } from "../src/index.js";
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
        responses.push(r as { body_blob_ref: string });
      }
      const ref = responses[0].body_blob_ref;

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
