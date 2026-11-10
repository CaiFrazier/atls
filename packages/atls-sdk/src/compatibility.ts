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

/**
 * SDK compatibility enforcement.
 *
 * Archives declare `compatibility.minSdkVersion` in `capabilities.v1.json`
 * (see CompatibilitySchema in @caifrazier/atls-spec). Until this module, NOTHING ever
 * consumed that field — an archive requiring a newer SDK silently opened in
 * an older one.
 *
 * `openAtlas()` WARNS on incompatibility (opening old/foreign archives must
 * not hard-fail on a metadata hint); callers wanting hard enforcement call
 * the exported `assertCompatible()` explicitly.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** The running SDK's own version, read from package.json at load time. */
export const SDK_VERSION: string = (require("../package.json") as { version: string }).version;

export class SdkCompatibilityError extends Error {
  readonly minSdkVersion: string;
  readonly sdkVersion: string;

  constructor(minSdkVersion: string, sdkVersion: string) {
    super(
      `Archive requires SDK >= ${minSdkVersion}, but this SDK is ${sdkVersion}. ` +
      `Upgrade @caifrazier/atls-sdk to read this archive.`
    );
    this.name = "SdkCompatibilityError";
    this.minSdkVersion = minSdkVersion;
    this.sdkVersion = sdkVersion;
  }
}

/**
 * Parse "major.minor.patch" (optionally with a -prerelease/+build suffix)
 * into a numeric triple. Returns null for unparseable input.
 *
 * Prerelease tags are deliberately IGNORED in comparison: the shipping SDK is
 * `1.0.0-rc.1` while native archives declare `minSdkVersion: "1.0.0"` — under
 * full semver semantics the rc would rank BELOW the requirement and every
 * native archive would be "incompatible" with the SDK that produced-read it.
 * The major.minor.patch triple is the compatibility contract.
 */
function parseTriple(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function tripleGte(a: [number, number, number], b: [number, number, number]): boolean {
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] >= b[2];
}

export interface CompatibilityCheckResult {
  compatible: boolean;
  /** Human-readable reason when incompatible or unenforceable. */
  reason?: string;
  minSdkVersion?: string;
  sdkVersion: string;
}

/**
 * Check an archive's declared `compatibility.minSdkVersion` against this SDK.
 * Absent/unparseable declarations are treated as compatible (no contract to
 * enforce), with the reason noted.
 */
export function checkCompatible(
  capabilities: unknown,
  sdkVersion: string = SDK_VERSION
): CompatibilityCheckResult {
  const minSdkVersion = (capabilities as { compatibility?: { minSdkVersion?: unknown } } | null | undefined)
    ?.compatibility?.minSdkVersion;
  if (typeof minSdkVersion !== "string" || minSdkVersion.trim() === "") {
    return { compatible: true, reason: "archive declares no minSdkVersion", sdkVersion };
  }
  const required = parseTriple(minSdkVersion);
  const running = parseTriple(sdkVersion);
  if (!required || !running) {
    return {
      compatible: true,
      reason: `unparseable version (min=${minSdkVersion}, sdk=${sdkVersion}); not enforced`,
      minSdkVersion,
      sdkVersion,
    };
  }
  if (tripleGte(running, required)) {
    return { compatible: true, minSdkVersion, sdkVersion };
  }
  return {
    compatible: false,
    reason: `archive requires SDK >= ${minSdkVersion}, running ${sdkVersion}`,
    minSdkVersion,
    sdkVersion,
  };
}

/**
 * Hard-enforcing variant: throws SdkCompatibilityError when the archive's
 * declared minSdkVersion exceeds this SDK's version.
 */
export function assertCompatible(capabilities: unknown, sdkVersion: string = SDK_VERSION): void {
  const result = checkCompatible(capabilities, sdkVersion);
  if (!result.compatible) {
    throw new SdkCompatibilityError(result.minSdkVersion ?? "unknown", sdkVersion);
  }
}
