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
 * The package release says when the tooling shipped. The format stamps say
 * what an archive may contain. They are written down separately, and this
 * test keeps them that way. A later `version:set` updates the `26.11.2`
 * expectation below.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  ATLAS_FORMAT_VERSION,
  ATLAS_SCHEMA_VERSION,
  ATLAS_SPEC_VERSION,
  ATLAS_VERSION,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("package release and format version", () => {
  test("26.11.2 is the package release and the format stamps stay on spec 1.3", () => {
    const spec = JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as { version: string };
    const sdk = JSON.parse(readFileSync(join(here, "../../atls-sdk/package.json"), "utf8")) as {
      version: string;
      dependencies: Record<string, string>;
    };
    const edition = readFileSync(join(here, "../src/edition.ts"), "utf8");

    expect(spec.version).toBe("26.11.2");
    expect(sdk.version).toBe(spec.version);
    expect(sdk.dependencies["@caifrazier/atls-spec"]).toBe(spec.version);

    expect(ATLAS_SPEC_VERSION).toBe("1.3.0");
    expect(ATLAS_FORMAT_VERSION).toBe("1.3.0");
    expect(ATLAS_VERSION).toBe("1.3");
    expect(ATLAS_SCHEMA_VERSION).toBe("2026-09-04");

    expect(spec.version).not.toBe(ATLAS_SPEC_VERSION);
    expect(spec.version).not.toBe(ATLAS_FORMAT_VERSION);
    expect(spec.version.startsWith(`${ATLAS_VERSION}.`)).toBe(false);
    expect(edition).not.toContain("package.json");
    expect(edition).not.toContain(spec.version);
  });
});
