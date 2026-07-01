/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 Manifest Schema
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
 * Robots policy metadata
 */
export const RobotsPolicySchema = z.object({
  respect: z.boolean(),
  overridesUsed: z.boolean(),
  overrideReason: z.string().optional(),
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
    atlasVersion: z.string(),
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
    identity: z.record(z.unknown()).optional(),
    siteRoot: z.string().optional(),
    scope: z.record(z.unknown()).optional(),
    crawlerSettings: z.record(z.unknown()).optional(),
    urlNormalization: z.record(z.unknown()).optional(),
    crawlContext: z.record(z.unknown()).optional(),
    crawlStartedAt: z.string().optional(),
    crawlCompletedAt: z.string().optional(),
    producer: z.record(z.unknown()).optional(),
    environment: z.record(z.unknown()).optional(),
    privacyPolicy: PrivacyPolicySchema.optional(),
    robotsPolicy: RobotsPolicySchema.optional(),
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
    capabilities: z.record(z.unknown()).optional(),
    coverage: z.record(z.unknown()).optional(),

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
