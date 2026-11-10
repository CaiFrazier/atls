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
 * Stops the prose spec, the versioning chapter, and the SDK-facing manifest
 * type from drifting away from the Zod schemas.
 *
 * The check is the dataset registry, the current schema tag, and every object
 * key in AtlasManifestV1Schema. It does not reject archives whose
 * schemaVersion is an older tag: that field stays an open string.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ATLAS_DATASET_KEYS, ATLAS_SCHEMA_VERSION, AtlasManifestV1Schema } from "../src/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

type ZodLike = {
  _def: { typeName: string; schema?: ZodLike; type?: ZodLike };
  shape?: Record<string, ZodLike>;
  unwrap?: () => ZodLike;
  element?: ZodLike;
};

function unwrap(schema: ZodLike): ZodLike {
  const typeName = schema._def.typeName;
  if ((typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault") && schema.unwrap) {
    return unwrap(schema.unwrap());
  }
  if (typeName === "ZodEffects" && schema._def.schema) {
    return unwrap(schema._def.schema);
  }
  return schema;
}

function collectObjectKeys(schema: ZodLike, keys: Set<string>): void {
  const current = unwrap(schema);
  if (current._def.typeName === "ZodObject" && current.shape) {
    for (const [key, child] of Object.entries(current.shape)) {
      keys.add(key);
      collectObjectKeys(child, keys);
    }
    return;
  }
  if (current._def.typeName === "ZodArray") {
    const element = current.element ?? current._def.type;
    if (element) collectObjectKeys(element, keys);
  }
}

const CURRENT_TAG_LINE = `Current schema tag: \`${ATLAS_SCHEMA_VERSION}\``;

const TAG_DOCS = [
  "packages/atls-spec/SPECIFICATION.md",
  "packages/atls-spec/docs/versioning.md",
  "packages/atls-spec/docs/root-files.md",
  "packages/atls-spec/docs/reading-archives.md",
  "packages/atls-sdk/docs/API.md",
];

describe("spec drift guard", () => {
  test("schemaVersion stays an open string and the documented tag is 2026-09-04", () => {
    expect(ATLAS_SCHEMA_VERSION).toBe("2026-09-04");
    const schemaVersion = AtlasManifestV1Schema.shape.schemaVersion as ZodLike;
    expect(schemaVersion._def.typeName).toBe("ZodOptional");
    expect(unwrap(schemaVersion)._def.typeName).toBe("ZodString");
  });

  test("prose that states the current schema tag matches ATLAS_SCHEMA_VERSION", () => {
    for (const path of TAG_DOCS) {
      expect(readRepo(path), path).toContain(CURRENT_TAG_LINE);
    }
  });

  test("the dataset chapter lists exactly the registry, and the index counts 21", () => {
    const datasets = readRepo("packages/atls-spec/docs/datasets.md");
    const listed = [...datasets.matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map((match) => match[1]);
    expect([...listed].sort()).toEqual([...Object.values(ATLAS_DATASET_KEYS)].sort());

    for (const path of ["packages/atls-spec/SPECIFICATION.md", "packages/atls-spec/README.md"]) {
      const text = readRepo(path);
      expect(text, path).toContain("21 datasets");
      expect(text, path).not.toContain("19 datasets");
    }
  });

  test("root-files.md names every manifest object field the schema defines", () => {
    const keys = new Set<string>();
    collectObjectKeys(AtlasManifestV1Schema as unknown as ZodLike, keys);
    const rootFiles = readRepo("packages/atls-spec/docs/root-files.md");
    const missing = [...keys].filter((key) => !rootFiles.includes(`\`${key}\``)).sort();
    expect(missing, `manifest fields missing from root-files.md: ${missing.join(", ")}`).toEqual([]);
  });

  test("the SDK manifest type uses the schema's integrity field names", () => {
    const types = readRepo("packages/atls-spec/src/types.ts");
    const start = types.indexOf("contentSha256?:");
    expect(start).toBeGreaterThan(0);
    const integrity = types.slice(start - 120, start + 500);
    expect(integrity).toContain("archiveSha256?:");
    expect(integrity).toContain("auditHash?:");
    expect(types).not.toContain("content_sha256");
    expect(types).not.toContain("audit_hash");
  });

  test("published package names are the ones the spec and SDK text use", () => {
    const notice = readRepo("NOTICE");
    const compatibility = readRepo("packages/atls-sdk/src/compatibility.ts");
    for (const [label, text] of [["NOTICE", notice], ["compatibility.ts", compatibility]] as const) {
      expect(text, label).not.toContain("@atls/sdk");
      expect(text, label).not.toContain("@atls/spec");
    }
    expect(compatibility).toContain("@caifrazier/atls-sdk");
    expect(notice).toContain("@caifrazier/atls-spec");
    expect(notice).toContain("@caifrazier/atls-sdk");
  });

  test("dataset directories are the long registry names in the spec and the SDK sources", () => {
    const specification = readRepo("packages/atls-spec/SPECIFICATION.md");
    expect(specification).toContain("pages/` for");
    expect(specification).toContain("edges/` for");
    expect(specification).toContain("failed_pages/` for");
    expect(specification).not.toContain("removed legacy");

    const sdkSources = [
      "packages/atls-sdk/src/index.ts",
      "packages/atls-sdk/src/describe.ts",
      "packages/atls-sdk/docs/API.md",
    ];
    for (const path of sdkSources) {
      const text = readRepo(path);
      expect(text, path).not.toContain("NEWER_FORMAT");
      expect(text, path).not.toContain("broken folder");
    }
  });
});
