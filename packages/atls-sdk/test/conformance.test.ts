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

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { normalizeUrl, openAtlas, parseBlobRef, readBlob, sha256Hex, statBlob, urlKey, validate } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..", "conformance");
const expected = JSON.parse(readFileSync(join(root, "expected.json"), "utf8"));
const vectors = JSON.parse(readFileSync(join(root, "vectors/url-and-hashes.json"), "utf8"));

describe("conformance archives", () => {
  for (const archive of expected.archives) {
    test(`${archive.file} matches the expected verdict`, async () => {
      const path = join(root, "archives", archive.file);
      const result = await validate(path);
      const strict = await validate(path, { strict: true });
      const errorCodes = result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code);
      expect(result.valid, JSON.stringify(result.issues, null, 2)).toBe(archive.valid);
      expect(errorCodes.sort()).toEqual([...archive.errorCodes].sort());
      expect(strict.valid, JSON.stringify(strict.issues, null, 2)).toBe(archive.strictValid);
    });
  }
});

describe("legacy blob ref on a 1.1 archive", () => {
  test("getBlob, readBlob, and statBlob resolve the legacy spelling", async () => {
    const path = join(root, "archives", "legacy-blob-ref-1.1.atls");
    const atlas = await openAtlas(path);
    try {
      const responses: Array<{ bodyBlobRef?: string }> = [];
      for await (const row of atlas.readers.responses()) {
        responses.push(row as { bodyBlobRef?: string });
      }
      expect(responses).toHaveLength(1);
      const ref = responses[0]?.bodyBlobRef;
      expect(ref).toMatch(/^blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.zst$/);
      const parsed = parseBlobRef(ref!);
      expect(parsed).not.toBeNull();

      const fromReader = await atlas.getBlob(ref!);
      expect(fromReader.toString("utf8")).toBe("Hello, Atlas");

      const fromCanonical = await readBlob(path, parsed!.canonical);
      expect(fromCanonical.equals(fromReader)).toBe(true);

      const stat = await statBlob(path, ref!);
      expect(stat.exists).toBe(true);
      expect(stat.path).toBe(parsed!.archivePath);
    } finally {
      atlas.close();
    }
  });
});

describe("conformance vectors", () => {
  test("normalizeUrl and urlKey match the 1.2 vector file", () => {
    for (const row of vectors.urlNormalization) {
      expect(normalizeUrl(row.input), row.input).toBe(row.normalized);
      expect(urlKey(row.input), row.input).toBe(row.urlKey);
    }
  });

  test("an overlong URL is not eligible for a urlKey", () => {
    const overlong = `https://example.com/${"a".repeat(9000)}`;
    expect(overlong.length).toBeGreaterThan(vectors.overlong.limit);
    expect(normalizeUrl(overlong)).toBeNull();
    expect(urlKey(overlong)).toBeNull();
  });

  test("published content digests match the library", () => {
    expect(sha256Hex("")).toBe(vectors.hashes.sha256Empty);
    expect(sha256Hex("hello")).toBe(vectors.hashes.sha256Hello);
    expect(vectors.hashes.contentSha256.empty).toBe(sha256Hex(""));
    expect(vectors.hashes.pathOrder.mixedCase.differ).toBe(true);
    expect(vectors.hashes.pathOrder.thaiLocale.thDiffers).toBe(true);
    expect(vectors.hashes.pathOrder.thaiLocale.utf8MatchesEnUs).toBe(true);
  });
});
