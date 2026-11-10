#!/usr/bin/env node
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
 * Packs @caifrazier/atls-spec and @caifrazier/atls-sdk, then installs those
 * tarballs into fresh projects and opens a conformance archive.
 *
 * npm install of both tarballs satisfies the SDK dependency
 * @caifrazier/atls-spec@<version> from the spec tarball.
 *
 * pnpm add of the same two tarballs still requests that version from the npm
 * registry. pnpm install works when pnpm.overrides points @caifrazier/atls-spec
 * at the spec tarball.
 *
 * Build dist/ before running this. The GitHub release URLs are the same
 * tarball names; this script uses the local files because the release is cut
 * from the weekly tag after merge.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specPackage = JSON.parse(readFileSync(join(repoRoot, "packages/atls-spec/package.json"), "utf8"));
const sdkPackage = JSON.parse(readFileSync(join(repoRoot, "packages/atls-sdk/package.json"), "utf8"));
const version = specPackage.version;

if (sdkPackage.version !== version) {
  throw new Error(`package versions differ: spec ${version}, sdk ${sdkPackage.version}`);
}
if (sdkPackage.dependencies["@caifrazier/atls-spec"] !== version) {
  throw new Error(`SDK depends on @caifrazier/atls-spec@${sdkPackage.dependencies["@caifrazier/atls-spec"]}`);
}

const specTarball = `caifrazier-atls-spec-${version}.tgz`;
const sdkTarball = `caifrazier-atls-sdk-${version}.tgz`;
const fixture = join(repoRoot, "conformance/archives/minimal-valid-1.3.atls");
const releaseBase = `https://github.com/CaiFrazier/atls/releases/download/v${version}`;

for (const pkg of ["atls-spec", "atls-sdk"]) {
  const entry = join(repoRoot, "packages", pkg, "dist/index.js");
  if (!existsSync(entry)) {
    throw new Error(`Missing ${entry}. Run pnpm build first.`);
  }
}
if (!existsSync(fixture)) {
  throw new Error(`Missing conformance fixture ${fixture}`);
}

const dirs = [];

function keep(dir) {
  dirs.push(dir);
  return dir;
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function openArchive(dir) {
  const script = join(dir, "open.mjs");
  writeFileSync(
    script,
    `import { openAtlas } from "@caifrazier/atls-sdk";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const specPath = require.resolve("@caifrazier/atls-spec/package.json");
if (specPath.includes("@caifrazier/atls-sdk/node_modules")) {
  throw new Error("spec resolved under the SDK package: " + specPath);
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));
if (spec.version !== ${JSON.stringify(version)}) {
  throw new Error("spec version " + spec.version);
}
const atlas = await openAtlas(${JSON.stringify(fixture)});
try {
  if (atlas.manifest.atlasVersion !== "1.3") {
    throw new Error("atlasVersion " + atlas.manifest.atlasVersion);
  }
  let pages = 0;
  for await (const page of atlas.readers.pageMetadata()) {
    if (!page || typeof page !== "object") throw new Error("empty page_metadata row");
    pages += 1;
  }
  if (pages < 1) throw new Error("fixture produced no page_metadata rows");
  console.log("opened", specPath);
  console.log("pages", pages);
} finally {
  atlas.close();
}
`,
  );
  run("node", [script], dir);
}

try {
  const packDir = keep(mkdtempSync(join(tmpdir(), "atls-pack-")));
  run("npm", ["pack", join(repoRoot, "packages/atls-spec")], packDir);
  run("npm", ["pack", join(repoRoot, "packages/atls-sdk")], packDir);
  const specPath = join(packDir, specTarball);
  const sdkPath = join(packDir, sdkTarball);
  if (!existsSync(specPath) || !existsSync(sdkPath)) {
    throw new Error(`npm pack did not write ${specTarball} and ${sdkTarball}`);
  }

  const npmDir = keep(mkdtempSync(join(tmpdir(), "atls-npm-")));
  run("npm", ["install", "--no-fund", "--no-audit", specPath, sdkPath], npmDir);
  const lock = JSON.parse(readFileSync(join(npmDir, "package-lock.json"), "utf8"));
  const specLocked = lock.packages?.["node_modules/@caifrazier/atls-spec"];
  const sdkLocked = lock.packages?.["node_modules/@caifrazier/atls-sdk"];
  if (!specLocked?.resolved?.includes(specTarball) || specLocked.resolved.includes("registry.npmjs.org")) {
    throw new Error(`npm resolved spec to ${specLocked?.resolved}`);
  }
  if (!sdkLocked?.resolved?.includes(sdkTarball) || sdkLocked.resolved.includes("registry.npmjs.org")) {
    throw new Error(`npm resolved sdk to ${sdkLocked?.resolved}`);
  }
  if (sdkLocked.dependencies?.["@caifrazier/atls-spec"] !== version) {
    throw new Error(`packed SDK depends on ${sdkLocked.dependencies?.["@caifrazier/atls-spec"]}`);
  }
  const nested = Object.keys(lock.packages).filter((key) => key.includes("@caifrazier/atls-sdk/node_modules/@caifrazier/atls-spec"));
  if (nested.length > 0) {
    throw new Error(`npm nested the spec package: ${nested.join(", ")}`);
  }
  openArchive(npmDir);

  const pnpmDir = keep(mkdtempSync(join(tmpdir(), "atls-pnpm-")));
  const specRef = `file:${specPath}`;
  const sdkRef = `file:${sdkPath}`;
  writeFileSync(
    join(pnpmDir, "package.json"),
    `${JSON.stringify(
      {
        name: "atls-tarball-smoke",
        private: true,
        dependencies: {
          "@caifrazier/atls-spec": specRef,
          "@caifrazier/atls-sdk": sdkRef,
        },
        pnpm: {
          overrides: {
            "@caifrazier/atls-spec": specRef,
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  run("pnpm", ["install"], pnpmDir);
  const pnpmLock = readFileSync(join(pnpmDir, "pnpm-lock.yaml"), "utf8");
  if (pnpmLock.includes("registry.npmjs.org/@caifrazier/atls-spec") || pnpmLock.includes("registry.npmjs.org/@caifrazier/atls-sdk")) {
    throw new Error("pnpm resolved a @caifrazier package from the npm registry");
  }
  if (!pnpmLock.includes(specTarball) || !pnpmLock.includes(sdkTarball)) {
    throw new Error("pnpm lockfile does not record both tarball file names");
  }
  openArchive(pnpmDir);

  console.log("verified:");
  console.log(`npm install ${releaseBase}/${specTarball} ${releaseBase}/${sdkTarball}`);
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}
