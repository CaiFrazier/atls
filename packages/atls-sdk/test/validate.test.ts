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
import { validate } from "../src/validate.js";
import { openAtlas } from "../src/index.js";
import { join } from "path";
import { tmpdir } from "os";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let validArchive: FixtureArchive;
let invalidArchive: FixtureArchive;
let missingFormatVersionArchive: FixtureArchive;
let nonCanonicalBlobRefArchive: FixtureArchive;
let nonCanonicalAssetBlobRefArchive: FixtureArchive;
let invalidAssetBlobRefArchive: FixtureArchive;
let pageNullTitleArchive: FixtureArchive;
let zeroMajorFormatVersionArchive: FixtureArchive;
let brokenLinkArchive: FixtureArchive;
let pageMissingSocialArchive: FixtureArchive;

beforeAll(async () => {
  validArchive = await createFixtureArchive();
  invalidArchive = await createFixtureArchive({ edgeSourceUrl: "https://invalid.example.com/" });
  missingFormatVersionArchive = await createFixtureArchive({ omitFormatVersion: true });
  nonCanonicalBlobRefArchive = await createFixtureArchive({ nonCanonicalBlobRef: true });
  nonCanonicalAssetBlobRefArchive = await createFixtureArchive({ nonCanonicalAssetBlobRef: true });
  invalidAssetBlobRefArchive = await createFixtureArchive({ invalidAssetBlobRef: true });
  pageNullTitleArchive = await createFixtureArchive({ pageNullTitle: true });
  zeroMajorFormatVersionArchive = await createFixtureArchive({ formatVersionValue: "0.9.0" });
  // The single page's own navigation edge self-links to pageUrl; a 404
  // response for that same URL makes it a genuine broken internal link.
  brokenLinkArchive = await createFixtureArchive({ responseStatusCode: 404 });
  pageMissingSocialArchive = await createFixtureArchive({ pageMissingSocial: true });
});

afterAll(async () => {
  await validArchive?.cleanup();
  await invalidArchive?.cleanup();
  await missingFormatVersionArchive?.cleanup();
  await nonCanonicalBlobRefArchive?.cleanup();
  await nonCanonicalAssetBlobRefArchive?.cleanup();
  await invalidAssetBlobRefArchive?.cleanup();
  await pageNullTitleArchive?.cleanup();
  await zeroMajorFormatVersionArchive?.cleanup();
  await brokenLinkArchive?.cleanup();
  await pageMissingSocialArchive?.cleanup();
});

describe("SDK validate()", () => {
  test("validates a valid archive", async () => {
    const result = await validate(validArchive.path);
    
    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.stats.errorsFound).toBe(0);
    expect(result.stats.pageMetadataChecked).toBeGreaterThan(0);
  });
  
  test("reports stats for checked records", async () => {
    const result = await validate(validArchive.path);
    
    expect(result.stats.pageMetadataChecked).toBeGreaterThan(0);
    expect(result.stats.navigationEdgesChecked).toBeGreaterThanOrEqual(0);
    expect(result.stats.assetsChecked).toBeGreaterThanOrEqual(0);
  });
  
  test("checks referential integrity by default", async () => {
    const result = await validate(validArchive.path, {
      checkIntegrity: true,
    });
    
    // If there are edges, they should all reference valid pages
    if (result.stats.navigationEdgesChecked > 0) {
      const edgeIntegrityIssues = result.issues.filter(
        (i) => i.code === "EDGE_INVALID_SOURCE"
      );
      expect(edgeIntegrityIssues.length).toBe(0);
    }
  });
  
  test("checks broken internal links", async () => {
    const result = await validate(validArchive.path, {
      checkBrokenLinks: true,
    });

    // Broken links are warnings, not errors
    const brokenLinkWarnings = result.issues.filter(
      (i) => i.code === "EDGE_BROKEN_LINK"
    );

    // This test just ensures the check runs without errors
    expect(brokenLinkWarnings).toBeInstanceOf(Array);
  });

  test("BUG-0055/BUG-0231 (fixed): a 404 response on an internal link actually fires EDGE_BROKEN_LINK", async () => {
    // Regression guard: checkBrokenLinks previously read pageRecord.statusCode,
    // a field canonical page_metadata records never have, so this warning was
    // permanently unreachable regardless of archive content. It now reads
    // status from the responses dataset.
    const result = await validate(brokenLinkArchive.path, {
      checkBrokenLinks: true,
      checkIntegrity: true,
    });

    const brokenLinkWarnings = result.issues.filter((i) => i.code === "EDGE_BROKEN_LINK");
    expect(brokenLinkWarnings.length).toBeGreaterThan(0);
    expect(brokenLinkWarnings[0].details?.statusCode).toBe(404);
  });
  
  test("rejects a maxIssues value that is not a positive integer", async () => {
    await expect(validate(validArchive.path, { maxIssues: 0 })).rejects.toThrow(
      /maxIssues must be a positive integer/,
    );
    await expect(validate(validArchive.path, { maxIssues: -3 })).rejects.toThrow(RangeError);
    await expect(validate(validArchive.path, { maxIssues: 1.5 })).rejects.toThrow(RangeError);
    await expect(validate(validArchive.path, { maxIssues: Number.POSITIVE_INFINITY })).rejects.toThrow(RangeError);
  });

  test("respects maxIssues limit", async () => {
    const result = await validate(validArchive.path, {
      maxIssues: 5,
    });
    
    expect(result.issues.length).toBeLessThanOrEqual(5);
  });
  
  test("filters errors when errorsOnly=true", async () => {
    const result = await validate(validArchive.path, {
      errorsOnly: true,
    });
    
    const nonErrors = result.issues.filter((i) => i.severity !== "error");
    expect(nonErrors.length).toBe(0);
  });
  
  test("checks manifest schema", async () => {
    const result = await validate(validArchive.path, {
      checkManifest: true,
    });
    
    // Manifest should have required fields
    const manifestIssues = result.issues.filter(
      (i) => i.code.startsWith("MANIFEST_")
    );
    
    // Expect no critical manifest errors
    const criticalManifestErrors = manifestIssues.filter(
      (i) => i.severity === "error"
    );
    expect(criticalManifestErrors.length).toBe(0);
  });
  
  test("can skip integrity checks", async () => {
    const result = await validate(validArchive.path, {
      checkIntegrity: false,
      checkBrokenLinks: false,
    });
    
    // Should still validate schemas
    expect(result.stats.pageMetadataChecked).toBeGreaterThan(0);
    
    // But no integrity issues reported
    const integrityIssues = result.issues.filter(
      (i) => i.code === "EDGE_INVALID_SOURCE" || i.code === "ASSET_INVALID_REFERRER"
    );
    expect(integrityIssues.length).toBe(0);
  });
  
  test("includes detailed issue information", async () => {
    const result = await validate(validArchive.path);
    
    // Check structure of any issues found
    result.issues.forEach((issue) => {
      expect(issue).toHaveProperty("severity");
      expect(issue).toHaveProperty("code");
      expect(issue).toHaveProperty("message");
      expect(["error", "warning", "info"]).toContain(issue.severity);
    });
  });

  test("BUG-0055/BUG-0136/BUG-0231 (fixed): a page_metadata record missing a required field fails schema validation", async () => {
    // Regression guard: validatePageSchema previously hand-rolled a handful
    // of truthy checks on non-canonical fields (url/finalUrl/statusCode/depth)
    // that don't exist on real page_metadata records, so a genuinely invalid
    // canonical record (missing the required `social` field) previously
    // validated clean. It now runs the real PageMetadataDatasetRecordV1Schema.
    const result = await validate(pageMissingSocialArchive.path, {
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    expect(result.valid).toBe(false);
    const schemaIssues = result.issues.filter(
      (i) => i.code === "DATASET_SCHEMA_VIOLATION" && i.dataset === "page_metadata"
    );
    expect(schemaIssues.length).toBeGreaterThan(0);
    expect(schemaIssues[0].message).toContain("social");
  });

  test("reports edge integrity errors", async () => {
    const result = await validate(invalidArchive.path, {
      checkIntegrity: true,
    });

    expect(result.valid).toBe(false);
    const integrityIssues = result.issues.filter((issue) => issue.code === "EDGE_INVALID_SOURCE");
    expect(integrityIssues.length).toBeGreaterThan(0);
  });

  test("treats missing required manifest formatVersion as an error", async () => {
    const result = await validate(missingFormatVersionArchive.path, {
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const issue = result.issues.find((i) => i.code === "MANIFEST_MISSING_FORMAT_VERSION");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    expect(result.valid).toBe(false);
  });

  test("BUG-0094(c) (fixed): validate() and openAtlas() agree on a 0.x-major formatVersion", async () => {
    // Both paths now share the same major-version rule (formatVersion.ts),
    // so a 0.x archive is rejected consistently rather than validate()'s own
    // Phase 1 check silently allowing what openAtlas() would already reject.
    await expect(openAtlas(zeroMajorFormatVersionArchive.path)).rejects.toThrow(/formatVersion/i);

    const result = await validate(zeroMajorFormatVersionArchive.path, {
      checkIntegrity: false,
      checkBrokenLinks: false,
    });
    expect(result.valid).toBe(false);
    const issue = result.issues.find(
      (i) => i.code === "MANIFEST_UNSUPPORTED_FORMAT_VERSION" || i.code === "MANIFEST_INVALID_FORMAT_VERSION"
    );
    expect(issue).toBeDefined();
  });

  test("strict mode enforces full spec-level manifest fields", async () => {
    const result = await validate(validArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const strictIssues = result.issues.filter((i) =>
      i.code === "MANIFEST_STRICT_MISSING_FIELD" || i.code === "MANIFEST_STRICT_INVALID_FIELD"
    );
    expect(strictIssues.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });

  test("strict mode accepts the legacy blob ref spelling", async () => {
    const result = await validate(nonCanonicalBlobRefArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const blobIssues = result.issues.filter((i) => i.code === "STRICT_BLOB_REF_NON_CANONICAL");
    expect(blobIssues).toEqual([]);
  });

  test("strict mode accepts the legacy blob ref on the nested asset resourceHint", async () => {
    const result = await validate(nonCanonicalAssetBlobRefArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const assetBlobIssues = result.issues.filter(
      (i) => i.code === "STRICT_BLOB_REF_NON_CANONICAL" && i.dataset === "assets",
    );
    expect(assetBlobIssues).toEqual([]);
  });

  test("strict mode rejects a blob ref that is neither spelling, including on the nested asset", async () => {
    const result = await validate(invalidAssetBlobRefArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const assetBlobIssues = result.issues.filter(
      (i) => i.code === "STRICT_BLOB_REF_NON_CANONICAL" && i.dataset === "assets",
    );
    expect(assetBlobIssues.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });

  test("strict mode forbids null for non-nullable optional fields", async () => {
    const result = await validate(pageNullTitleArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const nullIssues = result.issues.filter((i) => i.code === "STRICT_NULL_FORBIDDEN");
    expect(nullIssues.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });

  test("strict mode accepts a body-less redirect row and still requires a terminal body", async () => {
    // "1.3" is the spec 1.3 atlasVersion stamp. Writer rules may report other
    // issues on that stamp; this assertion is only about the missing body.
    for (const atlasVersion of ["1.0", "1.3"]) {
      for (const isRedirect of [true, false]) {
        const fixture = await createFixtureArchive({
          atlasVersion,
          responseOverride: {
            isRedirect,
            statusCode: isRedirect ? 301 : 200,
            bodyBlobRef: undefined,
            encoding: undefined,
          },
        });
        try {
          const result = await validate(fixture.path, {
            strict: true,
            checkManifest: false,
          });
          expect(
            result.issues.some((issue) => issue.code === "STRICT_BLOB_REF_MISSING"),
            `atlasVersion ${atlasVersion}, isRedirect ${isRedirect}`,
          ).toBe(!isRedirect);
        } finally {
          await fixture.cleanup();
        }
      }
    }
  });
});

describe("SDK validate() truncation", () => {
  test("sets truncated when maxIssues reached", async () => {
    const missingPath = join(tmpdir(), `atlas-missing-${Date.now()}-${Math.random().toString(16).slice(2)}.atls`);
    const result = await validate(missingPath, { maxIssues: 1 });

    expect(result.truncated).toBe(true);
    expect(result.issues.length).toBe(1);
  });

  test("BUG-0247: a truncated run is never valid — it is indeterminate", async () => {
    // brokenLinkArchive emits at least one WARNING (EDGE_BROKEN_LINK) and no
    // errors, so maxIssues:1 deterministically exhausts the cap on a warning —
    // the exact truncated shape: errors could hide past the cap, so a clean
    // count must NOT read as valid. (validArchive is useless here: it yields
    // zero issues, never truncates, and would silently test nothing.)
    const result = await validate(brokenLinkArchive.path, {
      checkBrokenLinks: true,
      checkIntegrity: true,
      maxIssues: 1,
    });

    expect(result.truncated).toBe(true);
    expect(result.stats.errorsFound).toBe(0);
    expect(result.valid).toBe(false);
    expect(result.indeterminate).toBe(true);
  });
});
