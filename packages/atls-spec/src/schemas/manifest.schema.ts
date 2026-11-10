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
 * Atlas Manifest Schema
 */

import { z } from 'zod';

/**
 * Dataset metadata within manifest
 */
export const DatasetMetadataSchema = z.object({
  name: z.string().optional(),
  partCount: z.number().int().nonnegative().optional(),
  recordCount: z.number().int().nonnegative().optional(),
  bytes: z.number().int().nonnegative().optional(),
  schema: z.string().optional(),
  schemaVersion: z.string().optional(),
  schemaHash: z.string().optional(),
  present: z.boolean().optional(),
  parts: z.number().int().nonnegative().optional(),
  sidecarUri: z.string().optional(),
  sidecarSha256: z.string().nullable().optional(),
  integrity: z
    .object({
      algorithm: z.string(),
      checksums: z.record(z.string()),
    })
    .optional(),
}).passthrough();

/**
 * Storage metadata
 */
export const BlobStorageMetadataSchema = z
  .object({
    compression: z
      .object({
        algorithm: z.string(),
        level: z.number().int().optional(),
      })
      .optional(),
    blobFormat: z.enum(['zst', 'tar.zst']).optional(),
    replayTier: z.enum(['html', 'html+css', 'full']).optional(),
    contentAddressing: z.enum(['on', 'off']).optional(),
    imagePolicy: z.enum(['none', 'dimensions', 'full']).optional(),
    maxImageBytes: z.number().int().nonnegative().optional(),
    media: z
      .object({
        location: z.string(),
        formats: z.array(z.string()),
      })
      .passthrough()
      .optional(),
    blobs: z
      .object({
        enabled: z.boolean(),
        format: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

/**
 * Privacy policy metadata
 */
export const PrivacyPolicySchema = z.object({
  stripCookies: z.boolean(),
  stripAuthHeaders: z.boolean(),
  redactInputs: z.boolean(),
  redactPii: z.boolean(),
  redactForms: z.boolean().optional(),
});

/**
 * Robots policy metadata.
 *
 * Spec 1.2 and earlier stored `respect`, `overridesUsed`, and optional
 * `overrideReason`. Those keys stay valid. Spec 1.3 adds `mode`,
 * `modeSource`, `failClosed`, `retryAttempts`, and `keepLastGood` on the
 * same object. When any 1.3 key is present, all five are present. When none
 * of them is present, `respect` and `overridesUsed` are required, which is
 * the 1.2 shape.
 *
 * Lenient mode and `failClosed: false` are producer defaults when an operator
 * does not choose otherwise. This schema records the facts the producer
 * wrote. It does not require a crawler to use those defaults, and it does
 * not fill them in when the keys are absent. `capabilities.robots`
 * (`respectsRobotsTxt`, `overrideUsed`) is a separate object and is unchanged.
 *
 * A 1.2 reader strips unknown keys on this object and still requires
 * `respect` and `overridesUsed`. A 1.3 writer that wants that reader to
 * accept the object keeps those two booleans beside the 1.3 keys.
 */
const robotsPolicyV13Keys = ["mode", "modeSource", "failClosed", "retryAttempts", "keepLastGood"] as const;

export const RobotsPolicySchema = z
  .object({
    respect: z.boolean().optional(),
    overridesUsed: z.boolean().optional(),
    overrideReason: z.string().optional(),
    mode: z.enum(["lenient", "strict"]).optional(),
    modeSource: z.enum(["default", "config", "flag"]).optional(),
    failClosed: z.boolean().optional(),
    retryAttempts: z.number().int().nonnegative().optional(),
    keepLastGood: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const anyV13 = robotsPolicyV13Keys.some((key) => value[key] !== undefined);
    if (anyV13) {
      for (const key of robotsPolicyV13Keys) {
        if (value[key] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "Spec 1.3 robotsPolicy fields are recorded together",
          });
        }
      }
      return;
    }
    if (typeof value.respect !== "boolean" || typeof value.overridesUsed !== "boolean") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["respect"],
        message: "robotsPolicy requires respect and overridesUsed, or the spec 1.3 fields mode, modeSource, failClosed, retryAttempts, and keepLastGood",
      });
    }
  });

/**
 * Atlas Manifest v1.0 Schema
 *
 * Aligned to runtime manifest output and AtlasManifest interface naming.
 */
export const AtlasManifestV1Schema = z
  .object({
    datasetId: z.string().optional(),
    crawlId: z.string().optional(),
    mode: z.enum(['raw', 'import', 'prerender', 'full']).optional(),
    // BUG-0134: atlasVersion was a free string nothing validated. Historical
    // emitted values: "1.0", "1.1" (RC2); "v1" appears in older validators.
    atlasVersion: z.string().regex(/^v?\d+(\.\d+)?$/, 'atlasVersion must look like "1.1" (or legacy "v1")'),
    formatVersion: z.string(),
    specVersion: z.string().optional(),
    schemaVersion: z.string().optional(),
    incomplete: z.boolean().optional(),

    owner: z.object({
      name: z.string(),
    }),
    consumers: z.array(z.string()),

    source: z
      .object({
        sourceType: z.enum(['warc', 'native']),
      })
      .passthrough()
      .optional(),

    packs: z.array(z.record(z.unknown())).optional(),
    // BUG-0125: these sub-objects were all z.record(z.unknown()) — the TS
    // AtlasManifest fully typed them but the Zod schema validated nothing.
    // Typed here mirroring the interface; .passthrough() keeps forward-compat.
    identity: z.object({
      primary_origin: z.string().optional(),
      primaryOrigin: z.string().optional(),
      domain: z.string().optional(),
      publicSuffix: z.string().optional(),
      seed_urls: z.array(z.string()).optional(),
      seedUrls: z.array(z.string()).optional(),
    }).passthrough().optional(),
    siteRoot: z.string().optional(),
    scope: z.object({
      seeds: z.array(z.string()).optional(),
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
      block_params: z.array(z.string()).optional(),
      follow_external: z.boolean().optional(),
      max_pages: z.number().optional(),
      max_depth: z.number().optional(),
    }).passthrough().optional(),
    crawlerSettings: z.object({
      render_mode: z.string().optional(),
      robots_policy: z.string().optional(),
      robots_override: z.boolean().optional(),
      user_agent: z.string().optional(),
      concurrency: z.number().optional(),
      rps: z.number().optional(),
      replay_tier: z.string().optional(),
      cpu_slowdown_multiplier: z.number().optional(),
      network_conditions: z.enum(["none", "mobile-4g", "mobile-3g", "mobile-2g", "slow-2g"]).optional(),
    }).passthrough().optional(),
    urlNormalization: z.object({
      lowercase_host: z.boolean().optional(),
      remove_default_port: z.boolean().optional(),
      strip_fragment: z.boolean().optional(),
      remove_trailing_slash: z.boolean().optional(),
      // Spec 1.2: the one trailing-slash declaration. Normative value is
      // "append-unless-file". remove_trailing_slash and any
      // trailing_slash_policy key are informational. See url-identity.md.
      trailing_slash: z.string().optional(),
      sort_query_params: z.boolean().optional(),
      querystring_policy: z.string().optional(),
      blocked_query_params: z.array(z.string()).optional(),
    }).passthrough().optional(),
    crawlContext: z.object({
      mode: z.enum(["raw", "import", "prerender", "full"]).optional(),
      robots: z.boolean().optional(),
      maxPages: z.number().optional(),
      maxDepth: z.number().optional(),
      followExternal: z.boolean().optional(),
      concurrency: z.number().optional(),
      rps: z.number().optional(),
      userAgent: z.string().optional(),
      urlNormalization: z.string().optional(),
      urlNormalizationRules: z.array(z.string()).optional(),
      paramPolicy: z.enum(["keep", "sample", "strip"]).optional(),
      parameterBlockList: z.array(z.string()).optional(),
      allowUrls: z.array(z.string()).optional(),
      denyUrls: z.array(z.string()).optional(),
    }).passthrough().optional(),
    crawlStartedAt: z.string().optional(),
    crawlCompletedAt: z.string().optional(),
    producer: z.object({
      name: z.string(),
      version: z.string(),
      build: z.string(),
      git_hash: z.string().optional(),
      command_line: z.string().optional(),
    }).passthrough().optional(),
    environment: z.object({
      device: z.enum(["desktop", "mobile"]),
      viewport: z.object({ width: z.number(), height: z.number() }),
      user_agent: z.string(),
      locale: z.string(),
      timezone: z.string(),
      accept_language: z.string(),
      cpu_throttling: z.number().nullable().optional(),
      network_conditions: z.enum(["none", "mobile-4g", "mobile-3g", "mobile-2g", "slow-2g"]).optional(),
      network_profile: z.object({
        name: z.string(),
        download_kbps: z.number(),
        upload_kbps: z.number(),
        latency_ms: z.number(),
      }).passthrough().optional(),
      consent_state: z.object({
        cookies_enabled: z.boolean(),
        do_not_track: z.boolean(),
        gdpr_mode: z.boolean().optional(),
      }).passthrough().optional(),
      browser: z.object({
        name: z.string(),
        version: z.string(),
        headless: z.boolean(),
      }).passthrough(),
      platform: z.object({
        os: z.string(),
        arch: z.string(),
        node_version: z.string(),
      }).passthrough(),
    }).passthrough().optional(),
    privacyPolicy: PrivacyPolicySchema.optional(),
    robotsPolicy: RobotsPolicySchema.optional(),
    // Deliberately free-form: field name is camelCase but inner keys
    // (comparable_to/diff_*) are data, not schema surface.
    compareCompatibility: z.record(z.unknown()).optional(),
    crawlConfigHash: z.string().optional(),

    hashing: z.object({
      algorithm: z.string(),
      urlKeyAlgo: z.string(),
      rawHtmlHash: z.string(),
      domHash: z.string(),
    }),

    parts: z.record(z.array(z.string())),
    schemas: z.record(z.string()),
    datasets: z.record(z.string(), DatasetMetadataSchema).optional(),
    capabilities: z.object({
      renderModes: z.array(z.enum(["raw", "import", "prerender", "full"])),
      modesUsed: z.array(z.enum(["raw", "import", "prerender", "full"])),
      specLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      dataSets: z.array(z.string()),
      robots: z.object({
        respectsRobotsTxt: z.boolean(),
        overrideUsed: z.boolean(),
      }).passthrough(),
    }).passthrough().optional(),
    // BUG-0224/BUG-0245: camelCase coverage subtree (recased 2026-07-04) with
    // the totals the SDK's strict validate requires. Archives written earlier
    // carry snake keys — schema-level readers should dual-read.
    coverage: z.object({
      matrix: z.array(z.object({
        part: z.string(),
        expected: z.boolean(),
        present: z.boolean(),
        rowCount: z.number().int().nonnegative(),
        coveragePct: z.number().optional(),
        reasonIfAbsent: z.string().optional(),
      }).passthrough()),
      totalPages: z.number().int().nonnegative(),
      totalEdges: z.number().int().nonnegative(),
      totalAssets: z.number().int().nonnegative(),
      successfulPages: z.number().int().nonnegative(),
      failedStatusPages: z.number().int().nonnegative(),
      pagesWithErrors: z.number().int().nonnegative(),
      incomplete: z.boolean(),
      truncatedParts: z.array(z.string()).optional(),
    }).passthrough().optional(),

    // B4 (schemaVersion 2026-07-16): crawl-level sitemap-discovery honesty flag.
    // Optional so pre-B4 archives validate; a reader maps a missing value to
    // "absent" (never "complete"). See SitemapCoverage in types.ts.
    sitemapCoverage: z.enum(['absent', 'failed', 'partial', 'complete']).optional(),

    configIncluded: z.boolean(),
    redactionApplied: z.boolean(),
    storage: BlobStorageMetadataSchema.optional(),
    notes: z.array(z.string()),

    integrity: z
      .object({
        algorithm: z.string().optional(),
        contentSha256: z.string().optional(),
        archiveSha256: z.string().optional(),
        auditHash: z.string().optional(),
        files: z.record(z.string()),
      })
      .passthrough(),

    createdAt: z.string(),
    generator: z.string(),
  })
  .passthrough();

export type AtlasManifestV1 = z.infer<typeof AtlasManifestV1Schema>;
export type DatasetMetadata = z.infer<typeof DatasetMetadataSchema>;
