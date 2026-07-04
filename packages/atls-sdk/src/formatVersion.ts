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

export const SUPPORTED_FORMAT_MAJOR = 1;

export interface ParsedFormatVersion {
  major: number;
  isPrerelease: boolean;
}

export function parseFormatVersion(raw: string): ParsedFormatVersion | null {
  const value = raw.trim();
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  if (!Number.isFinite(major)) {
    return null;
  }
  return {
    major,
    isPrerelease: /[-+]/.test(value)
  };
}

/** Thrown when a manifest is missing the required formatVersion field. */
export class AtlasMissingFormatVersionError extends Error {
  constructor() {
    super("Unsupported Atlas archive: missing required manifest.formatVersion");
    this.name = "AtlasMissingFormatVersionError";
  }
}

/**
 * Thrown when a manifest's formatVersion is present but unparseable, or
 * parseable with an unsupported major version.
 */
export class AtlasUnsupportedFormatVersionError extends Error {
  readonly formatVersion: string;
  readonly reason: "invalid" | "unsupported_major";
  constructor(formatVersion: string, reason: "invalid" | "unsupported_major", message: string) {
    super(message);
    this.name = "AtlasUnsupportedFormatVersionError";
    this.formatVersion = formatVersion;
    this.reason = reason;
  }
}

/**
 * Validate a manifest's formatVersion field, throwing a typed error if it is
 * missing, malformed, or an unsupported major version.
 *
 * Shared by openAtlas() (index.ts) and validate()'s Phase 1 manifest check
 * (validate.ts) so both paths apply the exact same rule — previously they
 * independently reimplemented this check and silently disagreed on how to
 * treat a 0.x-major formatVersion.
 */
export function enforceFormatVersionSupport(manifest: { formatVersion?: unknown }): void {
  const formatVersion = (manifest as Record<string, any>).formatVersion;
  if (typeof formatVersion !== "string" || formatVersion.trim().length === 0) {
    throw new AtlasMissingFormatVersionError();
  }

  const parsed = parseFormatVersion(formatVersion);
  if (!parsed) {
    throw new AtlasUnsupportedFormatVersionError(
      formatVersion,
      "invalid",
      `Unsupported Atlas archive: invalid formatVersion "${formatVersion}"`
    );
  }
  if (parsed.major !== SUPPORTED_FORMAT_MAJOR) {
    throw new AtlasUnsupportedFormatVersionError(
      formatVersion,
      "unsupported_major",
      `Unsupported Atlas archive formatVersion "${formatVersion}". SDK supports ${SUPPORTED_FORMAT_MAJOR}.x.x archives only.`
    );
  }

  if (parsed.isPrerelease) {
    console.warn(`[Atlas SDK] Deprecated pre-release formatVersion "${formatVersion}" detected.`);
  }
}
