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

import { describe, expect, test } from "vitest";
import {
  SDK_VERSION,
  SdkCompatibilityError,
  assertCompatible,
  checkCompatible,
} from "../src/compatibility.js";

/**
 * BUG-0134: `compatibility.minSdkVersion` (capabilities.v1.json) had ZERO
 * consumers — archives requiring a newer SDK silently opened in older ones.
 */
describe("SDK compatibility enforcement (BUG-0134)", () => {
  const caps = (minSdkVersion: string) => ({ compatibility: { minSdkVersion, breakingChanges: [] } });

  test("SDK_VERSION reads the real package version", () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("archive requiring a newer SDK is incompatible (and assert throws)", () => {
    const result = checkCompatible(caps("999.0.0"), "1.0.0");
    expect(result.compatible).toBe(false);
    expect(() => assertCompatible(caps("999.0.0"), "1.0.0")).toThrow(SdkCompatibilityError);
  });

  test("archive at or below the running SDK is compatible", () => {
    expect(checkCompatible(caps("1.0.0"), "1.0.0").compatible).toBe(true);
    expect(checkCompatible(caps("0.9.0"), "1.0.0").compatible).toBe(true);
    expect(() => assertCompatible(caps("1.0.0"), "1.2.3")).not.toThrow();
  });

  test("prerelease SDK tags are ignored — 1.0.0-rc.1 satisfies minSdkVersion 1.0.0", () => {
    // Without this, the shipping 1.0.0-rc.1 SDK would rank below the 1.0.0
    // floor every native archive declares, flagging its own archives.
    expect(checkCompatible(caps("1.0.0"), "1.0.0-rc.1").compatible).toBe(true);
  });

  test("absent or unparseable declarations are treated as compatible", () => {
    expect(checkCompatible(undefined).compatible).toBe(true);
    expect(checkCompatible({}).compatible).toBe(true);
    expect(checkCompatible(caps("not-a-version")).compatible).toBe(true);
    expect(() => assertCompatible(null)).not.toThrow();
  });
});
