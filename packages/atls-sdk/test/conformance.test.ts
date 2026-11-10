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
import { normalizeUrl, openAtlas, parseBlobRef, readBlob, serializedOrigin, sha256Hex, statBlob, urlKey, validate } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..", "conformance");
const expected = JSON.parse(readFileSync(join(root, "expected.json"), "utf8"));
const vectors = JSON.parse(readFileSync(join(root, "vectors/url-and-hashes.json"), "utf8"));
const spec13 = JSON.parse(readFileSync(join(root, "vectors/spec-1.3.json"), "utf8"));

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

describe("spec 1.3 conformance", () => {
  test("origin vectors match serializedOrigin", () => {
    expect(spec13.specVersion).toBe("1.3.0");
    for (const row of spec13.origin) {
      expect(serializedOrigin(row.robotsUrl), row.robotsUrl).toBe(row.origin);
    }
  });

  test("a 1.3 archive is readable, including robots rows", async () => {
    const path = join(root, "archives", "minimal-valid-1.3.atls");
    const atlas = await openAtlas(path);
    try {
      const pages = [];
      for await (const page of atlas.readers.pageMetadata()) pages.push(page);
      expect(pages).toHaveLength(1);

      const robots = [];
      for await (const row of atlas.readers.robots()) robots.push(row);
      const statuses = new Set(robots.map((row) => row.fetchStatus));
      const sources = new Set(robots.map((row) => row.bodySource));
      expect(statuses).toEqual(new Set(["ok", "unavailable", "unreachable"]));
      expect(sources).toEqual(new Set(["fresh", "lastGood", "none"]));
      for (const row of robots) {
        expect(row.origin).toBe(serializedOrigin(row.robotsUrl));
      }
      expect(robots.some((row) => row.blockedNoCopy)).toBe(true);
      expect(atlas.manifest.robotsPolicy?.failClosed).toBe(true);
      expect(atlas.summary.crawlContext.endReason).toBe("complete");
      expect(atlas.summary.crawlContext.completionReason).toBe("finished");
    } finally {
      atlas.close();
    }
  });

  test("a 1.2 reader reads a 1.3 archive", async () => {
    const path = join(root, "archives", "minimal-valid-1.3.atls");
    const atlas = await openAtlas(path);
    try {
      const pages = [];
      for await (const page of atlas.readers.pageMetadata()) pages.push(page);
      expect(pages).toHaveLength(1);

      const policy = atlas.manifest.robotsPolicy as {
        respect?: boolean;
        overridesUsed?: boolean;
        mode?: string;
      };
      expect(typeof policy.respect).toBe("boolean");
      expect(typeof policy.overridesUsed).toBe("boolean");
      const keptByReader12 = { respect: policy.respect, overridesUsed: policy.overridesUsed };
      expect(keptByReader12).toEqual({ respect: true, overridesUsed: false });
      expect(policy.mode).toBe("strict");

      expect(atlas.summary.crawlContext.completionReason).toBe("finished");

      const frontier = [];
      for await (const row of atlas.readers.dataset<Record<string, unknown>>("frontier_ledger")) {
        frontier.push(row);
      }
      const reasons = frontier.map((row) => row.skipReason).sort();
      expect(reasons).toEqual(["ROBOTS_DISALLOWED", "ROBOTS_UNREACHABLE"]);
      for (const row of frontier) {
        expect(typeof row.skipReason).toBe("string");
      }
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
