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
 * Spec 1.3 `robots` dataset. One row per origin per crawl. The dataset is
 * optional. A row that is present carries every field below. Nullable fields
 * use null rather than omission.
 *
 * `fetchStatus` records a descriptive RFC 9309 outcome. `unavailable` is an
 * HTTP 4xx. `unreachable` is an HTTP 5xx, a network failure, or a timeout
 * (`httpStatus` null). The schema does not require the crawler to allow or
 * deny access because of that outcome. What the crawler did is recorded on
 * `manifest.robotsPolicy` and on `blockedNoCopy`.
 *
 * `responses429` and `responses5xx` count page responses received from this
 * origin during the crawl. They do not count fetches of robots.txt. Null
 * means the crawler did not measure the count. 0 means it measured zero.
 * That null-versus-zero rule is the spec 1.3 rule for new counters.
 *
 * `lastGoodBodySha256` is a plain lowercase SHA-256 hex digest of a last-good
 * body that is not the body stored in `bodyBlobRef`. It is not a blob ref
 * and does not need to resolve in the archive. `bodyBlobRef` is the canonical
 * `sha256/<2>/<2>/<hash>` spelling, or null when no body is stored. A null
 * `bodyBlobRef` means no body was stored, and that is independent of
 * `fetchStatus`. The applied-body digest is the `bodyBlobRef` hash when that
 * ref stores the applied body. When `bodySource` is `lastGood`, that stored
 * body is the last-good copy. Those meanings stay stable across 1.3.x.
 * The legacy `blobs/.../<hash>.zst` spelling is not accepted here. `validate()`
 * checks that a non-null `bodyBlobRef` resolves, and on a 1.2 or later
 * `atlasVersion` it also reports the legacy spelling. Blob readers still
 * resolve that spelling.
 */

import { z } from "zod";
import { isCanonicalBlobRef, parseBlobRef } from "../blobs.js";
import { serializedOrigin } from "../urlIdentity.js";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, "lowercase SHA-256 hex");

export const RobotsDatasetRecordV1Schema = z
  .object({
    origin: z.string().min(1),
    robotsUrl: z.string().min(1),
    userAgentToken: z.string().min(1),
    matchedGroup: z.string().nullable(),
    fetchStatus: z.enum(["ok", "unavailable", "unreachable"]),
    httpStatus: z.number().int().nullable(),
    fetchedAt: z.string().datetime(),
    attempts: z.number().int().nonnegative(),
    bodySource: z.enum(["fresh", "lastGood", "none"]),
    lastGoodFetchedAt: z.string().datetime().nullable(),
    lastGoodBodySha256: sha256Hex.nullable(),
    bodyBlobRef: z.string().nullable(),
    bodyBytes: z.number().int().nonnegative(),
    truncated: z.boolean(),
    declaredCrawlDelaySec: z.number().nonnegative().nullable(),
    appliedIntervalMs: z.number().int().nonnegative(),
    blockedNoCopy: z.boolean(),
    responses429: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "Page responses with HTTP 429 received from this origin during the crawl. This does not count fetches of robots.txt. Null means not measured. 0 means measured and zero.",
      ),
    responses5xx: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "Page responses with HTTP 5xx received from this origin during the crawl. This does not count fetches of robots.txt. Null means not measured. 0 means measured and zero.",
      ),
  })
  .superRefine((value, ctx) => {
    const expectedOrigin = serializedOrigin(value.robotsUrl);
    if (expectedOrigin === null || value.origin !== expectedOrigin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["origin"],
        message:
          "origin must equal the origin of normalizeUrl(robotsUrl): scheme://host[:non-default-port], lowercase, host in punycode",
      });
    }

    if (value.bodyBlobRef !== null && !isCanonicalBlobRef(value.bodyBlobRef)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyBlobRef"],
        message: "bodyBlobRef must be the canonical sha256/<2>/<2>/<hash> spelling, or null when there is no body",
      });
    }

    if (value.fetchStatus === "unavailable") {
      if (value.httpStatus === null || value.httpStatus < 400 || value.httpStatus > 499) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["httpStatus"],
          message: "fetchStatus unavailable means an HTTP 4xx",
        });
      }
    } else if (value.fetchStatus === "unreachable") {
      if (value.httpStatus !== null && (value.httpStatus < 500 || value.httpStatus > 599)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["httpStatus"],
          message: "fetchStatus unreachable means an HTTP 5xx, a network failure, or a timeout",
        });
      }
    } else if (value.httpStatus === null || value.httpStatus < 200 || value.httpStatus > 399) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["httpStatus"],
        message: "fetchStatus ok means an HTTP 2xx or 3xx",
      });
    }

    if (value.bodySource === "lastGood") {
      if (value.lastGoodFetchedAt === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lastGoodFetchedAt"],
          message: "lastGoodFetchedAt is set when bodySource is lastGood",
        });
      }
      if (value.bodyBlobRef === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bodyBlobRef"],
          message: "bodySource lastGood stores that body in bodyBlobRef",
        });
      }
      if (value.lastGoodBodySha256 !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lastGoodBodySha256"],
          message: "lastGoodBodySha256 is null when bodyBlobRef stores the last-good body",
        });
      }
    } else if (value.lastGoodFetchedAt !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastGoodFetchedAt"],
        message: "lastGoodFetchedAt is null unless bodySource is lastGood",
      });
    }

    if (value.bodySource === "none") {
      if (value.bodyBlobRef !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bodyBlobRef"],
          message: "bodySource none has no stored body",
        });
      }
      if (value.bodyBytes !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bodyBytes"],
          message: "bodyBytes is 0 when no body is stored",
        });
      }
    } else if (value.bodyBlobRef === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyBlobRef"],
        message: "a fresh or last-good body is stored in bodyBlobRef",
      });
    }

    if (
      typeof value.lastGoodBodySha256 === "string" &&
      typeof value.bodyBlobRef === "string" &&
      isCanonicalBlobRef(value.bodyBlobRef)
    ) {
      const parsed = parseBlobRef(value.bodyBlobRef);
      if (parsed && parsed.hash === value.lastGoodBodySha256) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lastGoodBodySha256"],
          message: "lastGoodBodySha256 is set only when that body is not the one stored in bodyBlobRef",
        });
      }
    }

    if (
      value.blockedNoCopy &&
      (value.fetchStatus !== "unreachable" ||
        value.bodySource !== "none" ||
        value.bodyBlobRef !== null ||
        value.lastGoodBodySha256 !== null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockedNoCopy"],
        message: "blockedNoCopy is true only when the origin was unreachable and no copy was stored",
      });
    }
  });

export type RobotsDatasetRecordV1 = z.infer<typeof RobotsDatasetRecordV1Schema>;
