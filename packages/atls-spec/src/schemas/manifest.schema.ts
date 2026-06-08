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
    blob_format: z.enum(['zst', 'tar.zst']).optional(),
    replay_tier: z.enum(['html', 'html+css', 'full']).optional(),
    content_addressing: z.enum(['on', 'off']).optional(),
    image_policy: z.enum(['none', 'dimensions', 'full']).optional(),
    max_image_bytes: z.number().int().nonnegative().optional(),
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
  strip_cookies: z.boolean(),
  strip_auth_headers: z.boolean(),
  redact_inputs: z.boolean(),
  redact_pii: z.boolean(),
  redact_forms: z.boolean().optional(),
});

/**
 * Robots policy metadata
 */
export const RobotsPolicySchema = z.object({
  respect: z.boolean(),
  overrides_used: z.boolean(),
  override_reason: z.string().optional(),
});

/**
 * Atlas Manifest v1.0 Schema
 *
 * Aligned to runtime manifest output and AtlasManifest interface naming.
 */
export const AtlasManifestV1Schema = z
  .object({
    dataset_id: z.string().optional(),
    crawl_id: z.string().optional(),
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
    site_root: z.string().optional(),
    scope: z.record(z.unknown()).optional(),
    crawler_settings: z.record(z.unknown()).optional(),
    url_normalization: z.record(z.unknown()).optional(),
    crawlContext: z.record(z.unknown()).optional(),
    crawl_started_at: z.string().optional(),
    crawl_completed_at: z.string().optional(),
    producer: z.record(z.unknown()).optional(),
    environment: z.record(z.unknown()).optional(),
    privacy_policy: PrivacyPolicySchema.optional(),
    robots_policy: RobotsPolicySchema.optional(),
    compare_compatibility: z.record(z.unknown()).optional(),
    crawl_config_hash: z.string().optional(),

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
        content_sha256: z.string().optional(),
        contentSha256: z.string().optional(), // Legacy alias
        archiveSha256: z.string().optional(),
        audit_hash: z.string().optional(),
        files: z.record(z.string()),
      })
      .passthrough(),

    createdAt: z.string(),
    generator: z.string(),
  })
  .passthrough();

export type AtlasManifestV1 = z.infer<typeof AtlasManifestV1Schema>;
export type DatasetMetadata = z.infer<typeof DatasetMetadataSchema>;
