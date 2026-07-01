/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { validate } from "../src/validate.js";
import { join } from "path";
import { tmpdir } from "os";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

let validArchive: FixtureArchive;
let invalidArchive: FixtureArchive;
let missingFormatVersionArchive: FixtureArchive;
let nonCanonicalBlobRefArchive: FixtureArchive;
let nonCanonicalAssetBlobRefArchive: FixtureArchive;
let pageNullTitleArchive: FixtureArchive;

beforeAll(async () => {
  validArchive = await createFixtureArchive();
  invalidArchive = await createFixtureArchive({ edgeSourceUrl: "https://invalid.example.com/" });
  missingFormatVersionArchive = await createFixtureArchive({ omitFormatVersion: true });
  nonCanonicalBlobRefArchive = await createFixtureArchive({ nonCanonicalBlobRef: true });
  nonCanonicalAssetBlobRefArchive = await createFixtureArchive({ nonCanonicalAssetBlobRef: true });
  pageNullTitleArchive = await createFixtureArchive({ pageNullTitle: true });
});

afterAll(async () => {
  await validArchive?.cleanup();
  await invalidArchive?.cleanup();
  await missingFormatVersionArchive?.cleanup();
  await nonCanonicalBlobRefArchive?.cleanup();
  await nonCanonicalAssetBlobRefArchive?.cleanup();
  await pageNullTitleArchive?.cleanup();
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

  test("strict mode enforces canonical blob ref format", async () => {
    const result = await validate(nonCanonicalBlobRefArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const blobIssues = result.issues.filter((i) => i.code === "STRICT_BLOB_REF_NON_CANONICAL");
    expect(blobIssues.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });

  test("strict mode enforces canonical blob ref on the nested asset resourceHint", async () => {
    // Regression guard: the asset blob ref lives at resourceHint.bodyBlobRef, not at the
    // top level. A top-level lookup silently validates nothing (the original bug).
    const result = await validate(nonCanonicalAssetBlobRefArchive.path, {
      strict: true,
      checkIntegrity: false,
      checkBrokenLinks: false,
    });

    const assetBlobIssues = result.issues.filter(
      (i) => i.code === "STRICT_BLOB_REF_NON_CANONICAL" && i.dataset === "assets",
    );
    expect(assetBlobIssues.length).toBeGreaterThan(0);
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
});

describe("SDK validate() truncation", () => {
  test("sets truncated when maxIssues reached", async () => {
    const missingPath = join(tmpdir(), `atlas-missing-${Date.now()}-${Math.random().toString(16).slice(2)}.atls`);
    const result = await validate(missingPath, { maxIssues: 1 });

    expect(result.truncated).toBe(true);
    expect(result.issues.length).toBe(1);
  });
});
