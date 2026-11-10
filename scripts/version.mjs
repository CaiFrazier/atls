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
 * Date-based package releases for @caifrazier/atls-spec and @caifrazier/atls-sdk.
 *
 * The version is YY.M.W. YY is the two-digit year. M is the month with no
 * padding. W is the week of the month, ceil(dayOfMonth / 7): days 1–7 are
 * week 1, 8–14 week 2, and so on through week 5. The date is the packager's
 * local calendar day, or the day passed as --date=YYYY-MM-DD.
 *
 * The weekly release is written YY.M.W (implicit letter a). A later build in
 * that same week is a semver prerelease, YY.M.W-b then YY.M.W-c. The first
 * build of a new week is that week's release. `set` will not write a version
 * that already exists as the git tag v<version> unless --force is set.
 *
 *   node scripts/version.mjs next [--date=YYYY-MM-DD]
 *   node scripts/version.mjs check [--date=YYYY-MM-DD]
 *   node scripts/version.mjs set [--date=YYYY-MM-DD] [--hotfix] [--force]
 *   node scripts/version.mjs label <version>
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SPEC_PACKAGE = "packages/atls-spec/package.json";
const SDK_PACKAGE = "packages/atls-sdk/package.json";
const LOCKFILE = "pnpm-lock.yaml";
const SPEC_NAME = "@caifrazier/atls-spec";
const SDK_NAME = "@caifrazier/atls-sdk";

const USAGE = `Usage:
  node scripts/version.mjs next [--date=YYYY-MM-DD]
  node scripts/version.mjs check [--date=YYYY-MM-DD]
  node scripts/version.mjs set [--date=YYYY-MM-DD] [--hotfix] [--force]
  node scripts/version.mjs label <version>`;

export function repoRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * YY.M.W for a Date's local calendar day.
 * Week is ceil(dayOfMonth / 7), so the 1st–7th are week 1 and the 29th–31st are week 5.
 */
export function calendarVersion(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const week = Math.ceil(day / 7);
  const yy = String(year % 100).padStart(2, "0");
  return `${yy}.${month}.${week}`;
}

/** Parse --date=YYYY-MM-DD as a local calendar day. Invalid days throw. */
export function parseDateOption(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    throw new Error(`--date expects YYYY-MM-DD, got ${value}.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`--date is not a calendar day: ${value}.`);
  }
  return date;
}

/** `26.11.2-b` becomes `26.11.2b`. A weekly version is unchanged. */
export function labelVersion(version) {
  const match = /^(\d+\.\d+\.\d+)-([a-z])$/.exec(version);
  if (!match) return version;
  return `${match[1]}${match[2]}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Next hotfix of `calendar`, or throw when this week has no release yet
 * or every letter b–z is already used.
 *
 * The weekly release counts as letter a and is not written with a suffix.
 * The next letter is the one after the highest letter already used.
 */
export function nextHotfixVersion(calendar, usedVersions) {
  const exact = new RegExp(`^${escapeRegExp(calendar)}$`);
  const hotfix = new RegExp(`^${escapeRegExp(calendar)}-([a-z])$`);
  let sawWeekly = false;
  let highest = 0;
  for (const version of usedVersions) {
    if (typeof version !== "string" || version.length === 0) continue;
    if (exact.test(version)) {
      sawWeekly = true;
      continue;
    }
    const match = hotfix.exec(version);
    if (!match) continue;
    sawWeekly = true;
    const index = match[1].charCodeAt(0) - 97;
    if (index > highest) highest = index;
  }
  if (!sawWeekly) {
    throw new Error(`The first build of ${calendar} is that week's release, not a hotfix.`);
  }
  const next = highest + 1;
  if (next > 25) {
    throw new Error(`No hotfix letter is left for ${calendar}.`);
  }
  return `${calendar}-${String.fromCharCode(97 + next)}`;
}

/**
 * Decide the version `set` should write.
 * `tags` and `usedVersions` are version strings without a leading v.
 * Tag refusal applies to the version that would be written. --force skips that refusal only.
 */
export function planRelease({ calendar, hotfix = false, usedVersions = [], tags = [], force = false }) {
  const tagSet = new Set(tags);
  if (!hotfix) {
    if (tagSet.has(calendar) && !force) {
      return {
        ok: false,
        message: `Refusing ${calendar}: git tag v${calendar} already exists. Pass --force to write it anyway.`
      };
    }
    return { ok: true, version: calendar };
  }
  let version;
  try {
    version = nextHotfixVersion(calendar, [...usedVersions, ...tags]);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  if (tagSet.has(version) && !force) {
    return {
      ok: false,
      message: `Refusing ${version}: git tag v${version} already exists. Pass --force to write it anyway.`
    };
  }
  return { ok: true, version };
}

export function parseArgs(argv) {
  const command = argv[0];
  if (!command || command.startsWith("-")) {
    return { error: USAGE };
  }
  const flags = { command, date: undefined, hotfix: false, force: false, positionals: [] };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--hotfix") {
      flags.hotfix = true;
    } else if (arg === "--force") {
      flags.force = true;
    } else if (arg.startsWith("--date=")) {
      flags.date = arg.slice("--date=".length);
    } else if (arg === "--date") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        return { error: "--date expects YYYY-MM-DD." };
      }
      flags.date = value;
      i += 1;
    } else if (arg.startsWith("-")) {
      return { error: `Unknown option ${arg}.\n${USAGE}` };
    } else {
      flags.positionals.push(arg);
    }
  }
  return flags;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readReleaseState(root) {
  const spec = readJson(join(root, SPEC_PACKAGE));
  const sdk = readJson(join(root, SDK_PACKAGE));
  return {
    spec: spec.version,
    sdk: sdk.version,
    dependency: sdk.dependencies?.[SPEC_NAME]
  };
}

function replaceOnce(source, pattern, insert) {
  const match = pattern.exec(source);
  if (!match) return null;
  return source.slice(0, match.index) + insert(match) + source.slice(match.index + match[0].length);
}

export function writeReleaseVersion(root, version) {
  const specPath = join(root, SPEC_PACKAGE);
  const sdkPath = join(root, SDK_PACKAGE);
  const specSource = readFileSync(specPath, "utf8");
  const sdkSource = readFileSync(sdkPath, "utf8");
  const specNext = replaceOnce(specSource, /("version"\s*:\s*")([^"]*)(")/, (match) => `${match[1]}${version}${match[3]}`);
  if (specNext === null) {
    throw new Error(`${SPEC_PACKAGE} has no version field.`);
  }
  const sdkVersion = replaceOnce(sdkSource, /("version"\s*:\s*")([^"]*)(")/, (match) => `${match[1]}${version}${match[3]}`);
  if (sdkVersion === null) {
    throw new Error(`${SDK_PACKAGE} has no version field.`);
  }
  const sdkNext = replaceOnce(
    sdkVersion,
    new RegExp(`("${SPEC_NAME.replace("/", "\\/")}"\\s*:\\s*")([^"]*)(")`),
    (match) => `${match[1]}${version}${match[3]}`
  );
  if (sdkNext === null) {
    throw new Error(`${SDK_PACKAGE} does not depend on ${SPEC_NAME}.`);
  }
  if (specNext !== specSource) writeFileSync(specPath, specNext);
  if (sdkNext !== sdkSource) writeFileSync(sdkPath, sdkNext);

  const lockPath = join(root, LOCKFILE);
  if (!existsSync(lockPath)) return;
  const lockSource = readFileSync(lockPath, "utf8");
  const lockNext = replaceOnce(
    lockSource,
    new RegExp(`('${SPEC_NAME.replace("/", "\\/")}':\\r?\\n[ \\t]+specifier:[ \\t]+)(\\S+)`),
    (match) => `${match[1]}${version}`
  );
  if (lockNext === null) {
    throw new Error(`${LOCKFILE} has no ${SPEC_NAME} specifier.`);
  }
  if (lockNext !== lockSource) writeFileSync(lockPath, lockNext);
}

export function listVersionTags(root) {
  let output;
  try {
    output = execFileSync("git", ["tag", "--list"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stderr = `${error.stderr ?? ""}\n${error.message ?? ""}`;
    if (/not a git repository/i.test(stderr)) return [];
    throw error;
  }
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("v") && line.length > 1)
    .map((line) => line.slice(1));
}

function resolveDate(dateFlag, now) {
  if (dateFlag === undefined) return now;
  return parseDateOption(dateFlag);
}

function checkProblems(calendar, state) {
  const problems = [];
  if (state.spec !== calendar) {
    problems.push(`${SPEC_NAME} is ${state.spec}. Expected ${calendar}.`);
  }
  if (state.sdk !== calendar) {
    problems.push(`${SDK_NAME} is ${state.sdk}. Expected ${calendar}.`);
  }
  const dependency = state.dependency === undefined ? "(missing)" : state.dependency;
  if (state.dependency !== calendar) {
    problems.push(`${SDK_NAME} depends on ${SPEC_NAME} ${dependency}. Expected ${calendar}.`);
  }
  return problems;
}

/**
 * Run one command. Returns a process exit code.
 * `options.root` defaults to this repository. `options.now` overrides the local clock.
 * `options.tags` overrides the git tag list (tests). `options.io` captures stdout and stderr.
 */
export function run(argv, options = {}) {
  const io = options.io ?? {
    stdout(text) {
      process.stdout.write(text);
    },
    stderr(text) {
      process.stderr.write(text);
    }
  };
  const root = options.root ?? repoRoot();
  const now = options.now ?? new Date();
  try {
    const parsed = parseArgs(argv);
    if (parsed.error) {
      io.stderr(`${parsed.error}\n`);
      return 1;
    }
    if (parsed.command === "label") {
      if (parsed.date !== undefined || parsed.hotfix || parsed.force || parsed.positionals.length !== 1) {
        io.stderr(`label takes the version to transform.\n${USAGE}\n`);
        return 1;
      }
      io.stdout(`${labelVersion(parsed.positionals[0])}\n`);
      return 0;
    }
    if (!["next", "check", "set"].includes(parsed.command)) {
      io.stderr(`Unknown command ${parsed.command}.\n${USAGE}\n`);
      return 1;
    }
    if (parsed.positionals.length > 0) {
      io.stderr(`${parsed.command} does not take a positional argument.\n${USAGE}\n`);
      return 1;
    }
    if (parsed.command !== "set" && (parsed.hotfix || parsed.force)) {
      io.stderr(`--hotfix and --force are only valid with set.\n`);
      return 1;
    }
    const calendar = calendarVersion(resolveDate(parsed.date, now));
    if (parsed.command === "next") {
      io.stdout(`${calendar}\n`);
      return 0;
    }
    const state = readReleaseState(root);
    if (parsed.command === "check") {
      const problems = checkProblems(calendar, state);
      if (problems.length > 0) {
        io.stderr(`${problems.join("\n")}\n`);
        return 1;
      }
      io.stdout(`${calendar}\n`);
      return 0;
    }
    const tags = options.tags ?? listVersionTags(root);
    const planned = planRelease({
      calendar,
      hotfix: parsed.hotfix,
      usedVersions: [state.spec, state.sdk, state.dependency].filter((value) => typeof value === "string"),
      tags,
      force: parsed.force
    });
    if (!planned.ok) {
      io.stderr(`${planned.message}\n`);
      return 1;
    }
    writeReleaseVersion(root, planned.version);
    io.stdout(`${planned.version}\n`);
    return 0;
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedAsCli()) {
  process.exit(run(process.argv.slice(2)));
}
