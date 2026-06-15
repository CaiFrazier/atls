/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { describe, test, expect } from "vitest";
import { validate } from "../src/validate.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

/**
 * Regression coverage for BUG-0026 (audit C-14) + BUG-0054 (audit S-22):
 * validate() opens archives leniently and used to never surface records that
 * could not be parsed (truncated/corrupt dataset parts), certifying corrupt
 * archives as valid. It must now fail loud.
 *
 * `corruptLines` injects unparseable lines into a real zstd part — i.e. the part
 * decompresses, but records fail to parse, which is what a truncated dataset
 * looks like to the reader. `responses` is used because it is checked in the
 * per-record validation loop but is not covered by the edge/asset/manifest-count
 * integrity gates, isolating the corruption-detection path under test.
 */
describe("SDK validate() — corrupt/unreadable records (BUG-0026/C-14 + BUG-0054/S-22)", () => {
  test("pristine archive validates", async () => {
    const fixture: FixtureArchive = await createFixtureArchive();
    try {
      expect((await validate(fixture.path)).valid).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  test("flags unparseable records instead of certifying the archive valid", async () => {
    const fixture: FixtureArchive = await createFixtureArchive({
      corruptLines: { dataset: "responses", lines: ["NOT_VALID_JSON", "{ broken"] },
    });
    try {
      const result = await validate(fixture.path);
      expect(result.valid).toBe(false);
      const codes = (result.issues ?? []).map((i) => i.code);
      expect(codes).toContain("CORRUPTED_RECORDS");
    } finally {
      await fixture.cleanup();
    }
  });
});
