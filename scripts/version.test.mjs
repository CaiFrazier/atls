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

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarVersion,
  labelVersion,
  nextHotfixVersion,
  parseDateOption,
  planRelease,
  run
} from "./version.mjs";

function localDate(year, month, day) {
  return new Date(year, month - 1, day);
}

describe("calendar version", () => {
  const cases = [
    ["2026-11-01", "26.11.1"],
    ["2026-11-07", "26.11.1"],
    ["2026-11-08", "26.11.2"],
    ["2026-11-10", "26.11.2"],
    ["2026-11-14", "26.11.2"],
    ["2026-11-15", "26.11.3"],
    ["2026-11-21", "26.11.3"],
    ["2026-11-22", "26.11.4"],
    ["2026-11-28", "26.11.4"],
    ["2026-11-29", "26.11.5"],
    ["2026-11-30", "26.11.5"],
    ["2026-01-01", "26.1.1"],
    ["2026-01-07", "26.1.1"],
    ["2026-01-08", "26.1.2"],
    ["2026-09-04", "26.9.1"],
    ["2026-10-01", "26.10.1"],
    ["2026-12-31", "26.12.5"],
    ["2024-02-29", "24.2.5"],
    ["2026-02-28", "26.2.4"],
    ["2000-01-01", "00.1.1"]
  ];

  for (const [input, expected] of cases) {
    test(`${input} is ${expected}`, () => {
      const [year, month, day] = input.split("-").map(Number);
      assert.equal(calendarVersion(localDate(year, month, day)), expected);
      assert.equal(calendarVersion(parseDateOption(input)), expected);
    });
  }

  test("week boundaries are ceil(day / 7)", () => {
    assert.equal(Math.ceil(1 / 7), 1);
    assert.equal(Math.ceil(7 / 7), 1);
    assert.equal(Math.ceil(8 / 7), 2);
    assert.equal(Math.ceil(14 / 7), 2);
    assert.equal(Math.ceil(29 / 7), 5);
    assert.equal(Math.ceil(31 / 7), 5);
  });

  test("--date rejects values that are not a calendar day", () => {
    assert.throws(() => parseDateOption("2026-02-31"), /calendar day/);
    assert.throws(() => parseDateOption("2026-13-01"), /calendar day/);
    assert.throws(() => parseDateOption("2026-00-10"), /calendar day/);
    assert.throws(() => parseDateOption("2026-11-00"), /calendar day/);
    assert.throws(() => parseDateOption("11-10"), /YYYY-MM-DD/);
    assert.throws(() => parseDateOption("2026-11-10T00:00:00Z"), /YYYY-MM-DD/);
  });
});

describe("hotfix letters", () => {
  test("the weekly release is implicit a, so the first hotfix is b", () => {
    assert.equal(nextHotfixVersion("26.11.2", ["26.11.2"]), "26.11.2-b");
  });

  test("b is followed by c", () => {
    assert.equal(nextHotfixVersion("26.11.2", ["26.11.2", "26.11.2-b"]), "26.11.2-c");
  });

  test("the next letter follows the highest letter already used", () => {
    assert.equal(nextHotfixVersion("26.11.2", ["26.11.2-b"]), "26.11.2-c");
    assert.equal(nextHotfixVersion("26.11.2", ["26.11.2-b", "26.11.2-d"]), "26.11.2-e");
  });

  test("a bare weekly tag counts, and a hotfix tag counts", () => {
    assert.equal(nextHotfixVersion("26.11.2", ["1.3.1", "26.11.2"]), "26.11.2-b");
    assert.equal(nextHotfixVersion("26.11.2", ["26.11.2", "26.11.2-b", "26.11.2-c"]), "26.11.2-d");
  });

  test("the first build of a week is the weekly release", () => {
    assert.throws(
      () => nextHotfixVersion("26.11.3", ["26.11.2", "26.11.2-c"]),
      /first build of 26\.11\.3 is that week's release/
    );
    const planned = planRelease({
      calendar: "26.11.3",
      hotfix: false,
      usedVersions: ["26.11.2-c"],
      tags: ["26.11.2", "26.11.2-c"]
    });
    assert.deepEqual(planned, { ok: true, version: "26.11.3" });
  });

  test("set --hotfix refuses a week that has no release yet", () => {
    const planned = planRelease({
      calendar: "26.11.2",
      hotfix: true,
      usedVersions: ["1.3.1"],
      tags: ["1.2.0", "1.3.1"]
    });
    assert.equal(planned.ok, false);
    assert.match(planned.message, /first build of 26\.11\.2/);
  });

  test("set refuses a version whose git tag already exists unless --force", () => {
    const refused = planRelease({
      calendar: "26.11.2",
      hotfix: false,
      usedVersions: ["1.3.1"],
      tags: ["26.11.2"]
    });
    assert.equal(refused.ok, false);
    assert.match(refused.message, /git tag v26\.11\.2 already exists/);

    const forced = planRelease({
      calendar: "26.11.2",
      hotfix: false,
      usedVersions: ["1.3.1"],
      tags: ["26.11.2"],
      force: true
    });
    assert.deepEqual(forced, { ok: true, version: "26.11.2" });
  });

  test("a tagged hotfix is not chosen again", () => {
    const planned = planRelease({
      calendar: "26.11.2",
      hotfix: true,
      usedVersions: ["26.11.2"],
      tags: ["26.11.2", "26.11.2-b"]
    });
    assert.deepEqual(planned, { ok: true, version: "26.11.2-c" });
  });

  test("z is the last hotfix letter", () => {
    assert.throws(() => nextHotfixVersion("26.11.2", ["26.11.2-z"]), /No hotfix letter is left/);
  });
});

describe("label", () => {
  test("drops the hyphen in a lettered hotfix", () => {
    assert.equal(labelVersion("26.11.2-b"), "26.11.2b");
    assert.equal(labelVersion("26.11.2-c"), "26.11.2c");
  });

  test("leaves the weekly release unchanged", () => {
    assert.equal(labelVersion("26.11.2"), "26.11.2");
  });
});

function capture() {
  const out = { stdout: "", stderr: "" };
  return {
    out,
    io: {
      stdout(text) {
        out.stdout += text;
      },
      stderr(text) {
        out.stderr += text;
      }
    }
  };
}

function git(root, args) {
  execFileSync(
    "git",
    [
      "-c", "user.name=test",
      "-c", "user.email=test@example.invalid",
      "-c", "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd: root,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    }
  );
}

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), "atls-version-"));
  mkdirSync(join(root, "packages/atls-spec"), { recursive: true });
  mkdirSync(join(root, "packages/atls-sdk"), { recursive: true });
  writeFileSync(
    join(root, "packages/atls-spec/package.json"),
    `${JSON.stringify({ name: "@caifrazier/atls-spec", version: "1.3.1" }, null, 2)}\n`
  );
  writeFileSync(
    join(root, "packages/atls-sdk/package.json"),
    `${JSON.stringify({
      name: "@caifrazier/atls-sdk",
      version: "1.3.1",
      dependencies: { "@caifrazier/atls-spec": "1.3.1" }
    }, null, 2)}\n`
  );
  writeFileSync(
    join(root, "pnpm-lock.yaml"),
    [
      "  packages/atls-sdk:",
      "    dependencies:",
      "      '@caifrazier/atls-spec':",
      "        specifier: 1.3.1",
      "        version: link:../atls-spec",
      ""
    ].join("\n")
  );
  git(root, ["init"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "init"]);
  return root;
}

function readVersion(root, path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

describe("commands", () => {
  test("next, check, set, and label against a fixture repo", () => {
    const root = fixtureRepo();
    try {
      const next = capture();
      assert.equal(run(["next", "--date=2026-11-10"], { root, io: next.io }), 0);
      assert.equal(next.out.stdout, "26.11.2\n");

      const behind = capture();
      assert.equal(run(["check", "--date=2026-11-10"], { root, io: behind.io }), 1);
      assert.match(behind.out.stderr, /atls-spec is 1\.3\.1/);
      assert.match(behind.out.stderr, /atls-sdk is 1\.3\.1/);

      const tooSoon = capture();
      assert.equal(run(["set", "--hotfix", "--date=2026-11-10"], { root, io: tooSoon.io }), 1);
      assert.match(tooSoon.out.stderr, /first build of 26\.11\.2/);

      const weekly = capture();
      assert.equal(run(["set", "--date=2026-11-10"], { root, io: weekly.io }), 0);
      assert.equal(weekly.out.stdout, "26.11.2\n");
      assert.equal(readVersion(root, "packages/atls-spec/package.json").version, "26.11.2");
      const sdk = readVersion(root, "packages/atls-sdk/package.json");
      assert.equal(sdk.version, "26.11.2");
      assert.equal(sdk.dependencies["@caifrazier/atls-spec"], "26.11.2");
      assert.match(readFileSync(join(root, "pnpm-lock.yaml"), "utf8"), /specifier: 26\.11\.2\n/);

      const ready = capture();
      assert.equal(run(["check", "--date=2026-11-10"], { root, io: ready.io }), 0);
      assert.equal(ready.out.stdout, "26.11.2\n");

      git(root, ["add", "."]);
      git(root, ["commit", "-m", "weekly"]);
      git(root, ["tag", "v26.11.2"]);

      const tagged = capture();
      assert.equal(run(["set", "--date=2026-11-10"], { root, io: tagged.io }), 1);
      assert.match(tagged.out.stderr, /git tag v26\.11\.2 already exists/);
      assert.equal(readVersion(root, "packages/atls-spec/package.json").version, "26.11.2");

      const hotfix = capture();
      assert.equal(run(["set", "--hotfix", "--date=2026-11-10"], { root, io: hotfix.io }), 0);
      assert.equal(hotfix.out.stdout, "26.11.2-b\n");
      assert.equal(readVersion(root, "packages/atls-sdk/package.json").dependencies["@caifrazier/atls-spec"], "26.11.2-b");

      const label = capture();
      assert.equal(run(["label", "26.11.2-b"], { root, io: label.io }), 0);
      assert.equal(label.out.stdout, "26.11.2b\n");

      const hotfixCheck = capture();
      assert.equal(run(["check", "--date=2026-11-10"], { root, io: hotfixCheck.io }), 1);

      git(root, ["add", "."]);
      git(root, ["commit", "-m", "hotfix"]);
      git(root, ["tag", "v26.11.2-b"]);
      const second = capture();
      assert.equal(run(["set", "--hotfix", "--date=2026-11-10"], { root, io: second.io }), 0);
      assert.equal(second.out.stdout, "26.11.2-c\n");

      const newWeek = capture();
      assert.equal(run(["set", "--date=2026-11-15"], { root, io: newWeek.io }), 0);
      assert.equal(newWeek.out.stdout, "26.11.3\n");
      assert.equal(readVersion(root, "packages/atls-spec/package.json").version, "26.11.3");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("next without --date uses the provided local clock", () => {
    const io = capture();
    assert.equal(run(["next"], { now: localDate(2026, 11, 10), io: io.io }), 0);
    assert.equal(io.out.stdout, "26.11.2\n");
  });
});
