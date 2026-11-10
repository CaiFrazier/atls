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

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ATLAS_FORMAT_VERSION,
  ATLAS_SPEC_VERSION,
  ATLAS_VERSION,
  AtlasSummarySchema,
  END_REASON_TO_COMPLETION_REASON,
  FrontierLedgerRecordV1Schema,
  FRONTIER_SKIP_SOURCES,
  ROBOTS_SKIP_REASONS,
  RobotsDatasetRecordV1Schema,
  RobotsPolicySchema,
  completionReasonForEndReason,
  isCanonicalBlobRef,
  serializedOrigin,
  sha256Hex,
} from "../src/index.js";

const FETCHED_AT = "2026-01-02T03:04:05.000Z";
const BLOB_HASH = "7145fc4f75d487a859dad3467b311f6e2c509219c805b05dc1463e8912a5fb3f";
const BLOB_REF = `sha256/${BLOB_HASH.slice(0, 2)}/${BLOB_HASH.slice(2, 4)}/${BLOB_HASH}`;
const OTHER_DIGEST = sha256Hex("previous last-good body");

function robotsRow(overrides: Record<string, unknown> = {}) {
  const robotsUrl = (overrides.robotsUrl as string | undefined) ?? "https://example.com/robots.txt";
  return {
    origin: serializedOrigin(robotsUrl),
    robotsUrl,
    userAgentToken: "ExampleBot",
    matchedGroup: "*",
    fetchStatus: "ok",
    httpStatus: 200,
    fetchedAt: FETCHED_AT,
    attempts: 1,
    bodySource: "fresh",
    lastGoodFetchedAt: null,
    lastGoodBodySha256: null,
    bodyBlobRef: BLOB_REF,
    bodyBytes: 12,
    truncated: false,
    declaredCrawlDelaySec: null,
    appliedIntervalMs: 1000,
    blockedNoCopy: false,
    responses429: null,
    responses5xx: null,
    ...overrides,
  };
}

describe("spec 1.3 robots producer text", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const datasets = readFileSync(join(root, "packages/atls-spec/docs/datasets.md"), "utf8");
  const questions = readFileSync(join(root, "docs/OPEN_QUESTIONS.md"), "utf8");

  test("a robots writer settles the origin before the first page", () => {
    expect(datasets).toContain("before it fetches that origin's first page");
    expect(datasets).toContain("retries included");
    expect(datasets).toContain("one row per origin");
  });

  test("matchedRobotsRule recommends Directive: pattern", () => {
    expect(datasets).toContain("Disallow: /cart");
    expect(datasets).toContain("<Directive>: <pattern>");
  });

  test("mode, modeSource, failClosed, and the applied-body digest stay stable", () => {
    const versioning = readFileSync(join(root, "packages/atls-spec/docs/versioning.md"), "utf8");
    expect(versioning).toContain("stay stable across 1.3.x");
    expect(versioning).toContain("does not depend on `fetchStatus`");
    expect(datasets).toContain("independent of `fetchStatus`");
    expect(datasets).toContain("applied-body digest");
  });

  test("1.4 candidates stay out of the 1.3 contract", () => {
    expect(questions).toContain("## 13. Spec 1.4 candidates");
    expect(questions).toContain("fetchSeq");
    expect(questions).toContain("matchedGroup, directive, pattern, lineNumber");
    expect(questions).toContain("Keep `bodyBlobRef` whenever a rule is cited");
  });
});

describe("spec 1.3 versions", () => {
  test("the package stamps 1.3 and keeps the schema tag", () => {
    expect(ATLAS_SPEC_VERSION).toBe("1.3.0");
    expect(ATLAS_FORMAT_VERSION).toBe("1.3.0");
    expect(ATLAS_VERSION).toBe("1.3");
  });
});

describe("serialized origin", () => {
  test("is scheme://host[:non-default-port], lowercase, punycode", () => {
    expect(serializedOrigin("https://example.com/robots.txt")).toBe("https://example.com");
    expect(serializedOrigin("HTTPS://Example.COM:443/robots.txt")).toBe("https://example.com");
    expect(serializedOrigin("http://example.com:80/robots.txt")).toBe("http://example.com");
    expect(serializedOrigin("http://example.com:8080/robots.txt")).toBe("http://example.com:8080");
    expect(serializedOrigin("https://api.example.com:8443/robots.txt")).toBe("https://api.example.com:8443");
    expect(serializedOrigin("https://user:pass@example.com/robots.txt")).toBe("https://example.com");
    expect(serializedOrigin("https://münchen.example/robots.txt")).toBe("https://xn--mnchen-3ya.example");
    expect(serializedOrigin("https://WWW.Example.com/robots.txt")).toBe("https://www.example.com");
    expect(serializedOrigin("https://example.com/robots.txt?b=2&a=1")).toBe("https://example.com");
    expect(serializedOrigin("http://[::1]:8080/robots.txt")).toBe("http://[::1]:8080");
    expect(serializedOrigin("http://[::1]/robots.txt")).toBe("http://[::1]");
    expect(serializedOrigin("not a url")).toBeNull();
  });
});

describe("robots dataset", () => {
  test("accepts one row for each fetchStatus and each bodySource", () => {
    expect(RobotsDatasetRecordV1Schema.safeParse(robotsRow()).success).toBe(true);
    expect(RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      robotsUrl: "https://cdn.example.com/robots.txt",
      origin: "https://cdn.example.com",
      fetchStatus: "unavailable",
      httpStatus: 404,
      bodySource: "none",
      matchedGroup: null,
      bodyBlobRef: null,
      bodyBytes: 0,
      responses429: 0,
      responses5xx: 0,
    })).success).toBe(true);
    expect(RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      robotsUrl: "https://api.example.com:8443/robots.txt",
      origin: "https://api.example.com:8443",
      fetchStatus: "unreachable",
      httpStatus: 503,
      bodySource: "lastGood",
      lastGoodFetchedAt: "2026-01-01T00:00:00.000Z",
      responses429: 0,
      responses5xx: 2,
    })).success).toBe(true);
    expect(RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      fetchStatus: "unreachable",
      httpStatus: null,
      bodySource: "none",
      matchedGroup: null,
      bodyBlobRef: null,
      bodyBytes: 0,
      blockedNoCopy: true,
    })).success).toBe(true);
  });

  test("origin must equal the origin of normalizeUrl(robotsUrl)", () => {
    const bad = RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      robotsUrl: "HTTPS://Example.COM:443/robots.txt",
      origin: "HTTPS://Example.COM:443",
    }));
    expect(bad.success).toBe(false);
    const good = RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      robotsUrl: "HTTPS://Example.COM:443/robots.txt",
      origin: "https://example.com",
    }));
    expect(good.success).toBe(true);
  });

  test("bodyBlobRef is canonical only, and lastGoodBodySha256 is a digest", () => {
    expect(isCanonicalBlobRef(BLOB_REF)).toBe(true);
    expect(isCanonicalBlobRef(`blobs/${BLOB_REF}.zst`)).toBe(false);
    const legacy = RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      bodyBlobRef: `blobs/${BLOB_REF}.zst`,
    }));
    expect(legacy.success).toBe(false);
    const sameBody = RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      lastGoodBodySha256: BLOB_HASH,
    }));
    expect(sameBody.success).toBe(false);
    const otherBody = RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      lastGoodBodySha256: OTHER_DIGEST,
    }));
    expect(otherBody.success).toBe(true);
    expect(OTHER_DIGEST).toMatch(/^[a-f0-9]{64}$/);
  });

  test("responses429 and responses5xx allow null and zero", () => {
    expect(RobotsDatasetRecordV1Schema.safeParse(robotsRow({
      responses429: null,
      responses5xx: 0,
    })).success).toBe(true);
  });
});

describe("robotsPolicy", () => {
  test("a 1.2 object and a 1.3 object both validate", () => {
    expect(RobotsPolicySchema.safeParse({
      respect: true,
      overridesUsed: false,
    }).success).toBe(true);
    expect(RobotsPolicySchema.safeParse({
      mode: "lenient",
      modeSource: "default",
      failClosed: false,
      retryAttempts: 1,
      keepLastGood: true,
    }).success).toBe(true);
    expect(RobotsPolicySchema.safeParse({
      respect: true,
      overridesUsed: false,
      mode: "strict",
      modeSource: "flag",
      failClosed: true,
      retryAttempts: 2,
      keepLastGood: false,
    }).success).toBe(true);
  });

  test("a partial 1.3 object does not validate", () => {
    expect(RobotsPolicySchema.safeParse({ mode: "lenient" }).success).toBe(false);
  });

  test("a 1.2 reader schema accepts a 1.3 object that keeps the old booleans", () => {
    const reader12 = z.object({
      respect: z.boolean(),
      overridesUsed: z.boolean(),
      overrideReason: z.string().optional(),
    });
    const mixed = {
      respect: true,
      overridesUsed: false,
      mode: "lenient",
      modeSource: "default",
      failClosed: false,
      retryAttempts: 0,
      keepLastGood: true,
    };
    const parsed = reader12.safeParse(mixed);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({ respect: true, overridesUsed: false });
    expect(reader12.safeParse({
      mode: "lenient",
      modeSource: "default",
      failClosed: false,
      retryAttempts: 0,
      keepLastGood: true,
    }).success).toBe(false);
  });
});

describe("frontier_ledger spec 1.3 fields", () => {
  test("skipReason stays a string, including the robots values", () => {
    const base = {
      url: "https://example.com/private/",
      normalizedUrl: "https://example.com/private/",
      status: "skipped" as const,
      hostGroup: "example.com",
    };
    expect(FrontierLedgerRecordV1Schema.safeParse(base).success).toBe(true);
    for (const skipReason of ROBOTS_SKIP_REASONS) {
      expect(FrontierLedgerRecordV1Schema.safeParse({
        ...base,
        skipReason,
        skipSource: "page",
        matchedRobotsRule: "/private",
      }).success).toBe(true);
    }
    expect(FrontierLedgerRecordV1Schema.safeParse({
      ...base,
      skipReason: "ROBOTS_UNREACHABLE",
      skipSource: "warmup",
      matchedRobotsRule: null,
    }).success).toBe(true);
    expect([...FRONTIER_SKIP_SOURCES]).toEqual(["page", "scout", "sitemap", "warmup"]);
  });

  test("a 1.2 field set strips the new keys and still accepts the skip reason string", () => {
    const reader12 = z.object({
      url: z.string(),
      normalizedUrl: z.string(),
      status: z.enum(["discovered", "queued", "visited", "skipped"]),
      skipReason: z.string().optional(),
      hostGroup: z.string(),
    });
    const parsed = reader12.safeParse({
      url: "https://example.com/private/",
      normalizedUrl: "https://example.com/private/",
      status: "skipped",
      skipReason: "ROBOTS_DISALLOWED",
      skipSource: "scout",
      matchedRobotsRule: "/private",
      hostGroup: "example.com",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.skipReason).toBe("ROBOTS_DISALLOWED");
    expect(parsed.success && "skipSource" in parsed.data).toBe(false);
  });
});

describe("endReason mapping", () => {
  function summary(endReason: string, completionReason: string) {
    return {
      identity: {
        seedUrls: ["https://example.com/"],
        primaryOrigin: "https://example.com",
        domain: "example.com",
        publicSuffix: "com",
      },
      crawlContext: {
        specLevel: 1,
        completionReason,
        endReason,
        skippedByReason: null,
        config: { robotsRespect: true, followExternal: false },
      },
      stats: {
        totalPages: 0,
        totalEdges: 0,
        totalAssets: 0,
        totalErrors: 0,
        statusCodes: {},
        renderModes: {},
      },
      performance: { maxDepthReached: 0 },
      timestamps: {
        crawlStartedAt: FETCHED_AT,
        crawlCompletedAt: FETCHED_AT,
        crawlDurationMs: 1,
      },
    };
  }

  test("each endReason maps onto the existing completionReason enum", () => {
    for (const [endReason, completionReason] of Object.entries(END_REASON_TO_COMPLETION_REASON)) {
      expect(completionReasonForEndReason(endReason)).toBe(completionReason);
      expect(AtlasSummarySchema.safeParse(summary(endReason, completionReason)).success).toBe(true);
    }
  });

  test("a mismatch fails and a 1.2 summary without endReason still parses", () => {
    expect(AtlasSummarySchema.safeParse(summary("pageCap", "finished")).success).toBe(false);
    const legacy = summary("complete", "finished");
    delete (legacy.crawlContext as { endReason?: string }).endReason;
    delete (legacy.crawlContext as { skippedByReason?: null }).skippedByReason;
    expect(AtlasSummarySchema.safeParse(legacy).success).toBe(true);
  });

  test("skippedByReason uses null for unmeasured and 0 for measured zero", () => {
    const measured = summary("complete", "finished");
    (measured.crawlContext as { skippedByReason: unknown }).skippedByReason = { ROBOTS_DISALLOWED: 0 };
    expect(AtlasSummarySchema.safeParse(measured).success).toBe(true);
    (measured.crawlContext as { skippedByReason: unknown }).skippedByReason = { ROBOTS_DISALLOWED: -1 };
    expect(AtlasSummarySchema.safeParse(measured).success).toBe(false);
  });
});
