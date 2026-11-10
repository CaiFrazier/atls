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
import { validate } from "../src/validate.js";
import { createFixtureArchive, type FixtureArchive } from "./helpers/fixtureArchive.js";

/**
 * Regression coverage for unreadable and corrupt records:
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
