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
import * as fs from "fs/promises";
import * as path from "path";

const APACHE_HEADER = `/*
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
 */`;

const ROOT_DIR = path.resolve(__dirname, "../../..");

async function getFiles(dir: string, ext: string): Promise<string[]> {
  const subdirs = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    subdirs.map(async (subdir) => {
      const res = path.resolve(dir, subdir.name);
      if (subdir.isDirectory()) {
        if (subdir.name === "node_modules" || subdir.name === "dist" || subdir.name === "legacy") {
          return [];
        }
        return getFiles(res, ext);
      } else {
        return res.endsWith(ext) ? [res] : [];
      }
    })
  );
  return files.flat();
}

describe("Atlas Public Readiness Checks", () => {
  test("every TypeScript source/test/example file has correct Apache-2.0 header", async () => {
    const specSrc = await getFiles(path.join(ROOT_DIR, "packages/atls-spec/src"), ".ts");
    const specTest = await getFiles(path.join(ROOT_DIR, "packages/atls-spec/test"), ".ts");
    const sdkSrc = await getFiles(path.join(ROOT_DIR, "packages/atls-sdk/src"), ".ts");
    const sdkTest = await getFiles(path.join(ROOT_DIR, "packages/atls-sdk/test"), ".ts");
    const sdkExamples = await getFiles(path.join(ROOT_DIR, "packages/atls-sdk/examples"), ".ts");
    const sdkConfig = [path.join(ROOT_DIR, "packages/atls-sdk/vitest.config.ts")];

    const allTsFiles = [
      ...specSrc,
      ...specTest,
      ...sdkSrc,
      ...sdkTest,
      ...sdkExamples,
      ...sdkConfig,
    ];

    expect(allTsFiles.length).toBeGreaterThan(10);

    for (const filePath of allTsFiles) {
      const content = await fs.readFile(filePath, "utf-8");
      const normalized = content.replace(/\r\n/g, "\n");
      const relativePath = path.relative(ROOT_DIR, filePath);
      expect(
        normalized.startsWith(APACHE_HEADER),
        `File ${relativePath} must start with the exact Apache-2.0 license header.`
      ).toBe(true);
    }
  });

  test("no file contains proprietary or confidential headers", async () => {
    const specDir = path.join(ROOT_DIR, "packages/atls-spec");
    const sdkDir = path.join(ROOT_DIR, "packages/atls-sdk");

    const specFiles = await getFiles(specDir, ".ts");
    const sdkFiles = await getFiles(sdkDir, ".ts");
    const allTsFiles = [...specFiles, ...sdkFiles].filter(
      (f) => !f.endsWith("readiness-checks.test.ts")
    );

    const privateHeader = /\b(?:proprietary|confidential)\b/i;

    for (const filePath of allTsFiles) {
      const content = await fs.readFile(filePath, "utf-8");
      const relativePath = path.relative(ROOT_DIR, filePath);
      expect(
        privateHeader.test(content),
        `File ${relativePath} must not contain a proprietary or confidential header.`
      ).toBe(false);
    }
  });

  test("no file contains absolute local paths", async () => {
    const specDir = path.join(ROOT_DIR, "packages/atls-spec");
    const sdkDir = path.join(ROOT_DIR, "packages/atls-sdk");

    const specFiles = await getFiles(specDir, ".ts");
    const sdkFiles = await getFiles(sdkDir, ".ts");
    const allTsFiles = [...specFiles, ...sdkFiles].filter(
      (f) => !f.endsWith("readiness-checks.test.ts")
    );

    // Machine-local absolute paths: macOS and Linux home directories, and Windows user profiles.
    const absoluteLocalPath = /\/Users\/|\/home\/|[A-Za-z]:[\\/]Users[\\/]/;

    for (const filePath of allTsFiles) {
      const content = await fs.readFile(filePath, "utf-8");
      const relativePath = path.relative(ROOT_DIR, filePath);
      expect(
        absoluteLocalPath.test(content),
        `File ${relativePath} must not contain an absolute local path.`
      ).toBe(false);
    }
  });

  test("documentation files do not contain stale 0-record warning banners", async () => {
    const docs = [
      path.join(ROOT_DIR, "packages/atls-sdk/QUICK_REFERENCE.md"),
      path.join(ROOT_DIR, "packages/atls-sdk/README.md"),
      path.join(ROOT_DIR, "packages/atls-sdk/docs/API.md"),
      path.join(ROOT_DIR, "packages/atls-spec/SPECIFICATION.md"),
      path.join(ROOT_DIR, "packages/atls-spec/docs/reading-archives.md"),
      path.join(ROOT_DIR, "packages/atls-spec/docs/versioning.md"),
    ];

    const stalePhrases = [
      "returns 0 records",
      "SDK assumes a removed legacy",
      "stale and its readers return",
    ];

    for (const docPath of docs) {
      const content = await fs.readFile(docPath, "utf-8");
      const relativePath = path.relative(ROOT_DIR, docPath);

      for (const phrase of stalePhrases) {
        expect(
          content.toLowerCase().includes(phrase.toLowerCase()),
          `Document ${relativePath} must not contain stale phrase: "${phrase}"`
        ).toBe(false);
      }
    }
  });

  test("package-level LICENSE files exist and match the root LICENSE", async () => {
    const rootLicense = await fs.readFile(path.join(ROOT_DIR, "LICENSE"), "utf-8");
    const specLicense = await fs.readFile(path.join(ROOT_DIR, "packages/atls-spec/LICENSE"), "utf-8");
    const sdkLicense = await fs.readFile(path.join(ROOT_DIR, "packages/atls-sdk/LICENSE"), "utf-8");

    expect(specLicense).toBe(rootLicense);
    expect(sdkLicense).toBe(rootLicense);
  });
});
