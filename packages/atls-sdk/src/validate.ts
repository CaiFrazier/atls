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

import { openAtlas } from "./index.js";
import { AtlasResourceLimitError, decompressZstdBuffer, openZipHandle } from "./reader.js";
import type { AtlasReadLimits, ZipHandle } from "./reader.js";
import {
  acceptedContentDigests,
  assetId,
  completionReasonForEndReason,
  contentSha256,
  integrityEdition,
  isDatasetPartPath,
  parseBlobRef,
  sha256Hex,
  TRAILING_SLASH_POLICY,
} from "@caifrazier/atls-spec";
import {
  parseFormatVersion,
  SUPPORTED_FORMAT_MAJOR,
  AtlasMissingFormatVersionError,
  AtlasUnsupportedFormatVersionError,
} from "./formatVersion.js";
import type { AtlasManifest, AssetRecord, ResponseRecordV1 } from "./types.js";
import {
  ContentDatasetRecordV1Schema,
  NavigationDatasetRecordV1Schema,
  StructuredDataDatasetRecordV1Schema,
  TechnologyDatasetRecordV1Schema,
  RenderStateDatasetRecordV1Schema,
  PerformanceDatasetRecordV1Schema,
  SecurityDatasetRecordV1Schema,
  ResponseRecordV1Schema as ResponseRecordV1ZodSchema,
  ResourceRecordV1Schema,
  SitemapDatasetRecordV1Schema,
  SitemapUrlDatasetRecordV1Schema,
  ExtractionDatasetRecordV1Schema,
  EventRecordV1Schema,
  AccessibilityDatasetRecordV1Schema,
  PipelineFailureRecordV1Schema,
  PipelineAlertRecordV1Schema,
  PageMetadataDatasetRecordV1Schema,
  AssetRecordSchema,
  RobotsDatasetRecordV1Schema,
} from "@caifrazier/atls-spec";

/**
 * Validation issue severity levels
 */
export type ValidationSeverity = "error" | "warning" | "info";

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  dataset?: string;
  record?: any;
  details?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * True only when the archive was fully checked and no errors were found.
   * A truncated run can find zero errors merely because it stopped
   * early, so `valid` is never true while `truncated` (see `indeterminate`).
   */
  valid: boolean;
  /**
   * The run hit the issue cap before finishing, found no errors so
   * far, but cannot vouch for the unchecked remainder. Neither valid nor
   * invalid: the caller must treat the archive as unverified.
   */
  indeterminate: boolean;
  issues: ValidationIssue[];
  stats: {
    pageMetadataChecked: number;
    navigationEdgesChecked: number;
    assetsChecked: number;
    contentChecked: number;
    structuredDataChecked: number;
    technologyChecked: number;
    renderStateChecked: number;
    performanceChecked: number;
    securityChecked: number;
    responsesChecked: number;
    resourcesChecked: number;
    sitemapsChecked: number;
    sitemapUrlsChecked: number;
    extractionChecked: number;
    eventsChecked: number;
    accessibilityChecked: number;
    pipelineFailuresChecked: number;
    pipelineAlertsChecked: number;
    robotsChecked: number;
    errorsFound: number;
    warningsFound: number;
  };
  truncated: boolean;
}

/**
 * Validation options
 */
export interface ValidateOptions {
  /**
   * Check referential integrity (edges reference valid pages, etc.)
   * @default true
   */
  checkIntegrity?: boolean;
  
  /**
   * Check for broken internal links
   * @default true
   */
  checkBrokenLinks?: boolean;
  
  /**
   * Check manifest consistency with actual data
   * @default true
   */
  checkManifest?: boolean;
  
  /**
   * Maximum number of issues to collect before stopping
   * @default 1000
   */
  maxIssues?: number;
  
  /**
   * Only report errors, skip warnings
   * @default false
   */
  errorsOnly?: boolean;

  /**
   * Enforce strict spec-level manifest requirements.
   * Missing required spec fields are reported as errors.
   * @default false
   */
  strict?: boolean;

  /**
   * Resource limits applied while reading untrusted archive entries.
   * Defaults come from DEFAULT_ATLAS_READ_LIMITS.
   */
  limits?: Partial<AtlasReadLimits>;

  /**
   * Skip decompress-and-hash checks of blob entries, and skip the check that
   * a blob reference resolves to an entry. Part checksums and contentSha256
   * are still verified. Default false.
   */
  skipBlobVerification?: boolean;
}

/**
 * Validate an Atlas archive for schema compliance and referential integrity
 * 
 * Checks:
 * - Schema compliance: All records have required fields
 * - Referential integrity: Edges reference valid page IDs, assets have valid URLs
 * - Manifest consistency: Counts match actual data
 * - Broken links: Internal links that lead to 404s or errors
 * 
 * @param atlsPath Path to .atls file
 * @param options Validation options
 * @returns Validation result with issues and statistics
 * 
 * @example
 * ```typescript
 * const result = await validate('./crawl.atls');
 * 
 * if (!result.valid) {
 *   console.error(`Found ${result.stats.errorsFound} errors`);
 *   for (const issue of result.issues) {
 *     console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
 *   }
 * }
 * ```
 */
export async function validate(
  atlsPath: string,
  options: ValidateOptions = {}
): Promise<ValidationResult> {
  const {
    checkIntegrity = true,
    checkBrokenLinks = true,
    checkManifest = true,
    maxIssues = 1000,
    errorsOnly = false,
    strict = false,
    limits,
    skipBlobVerification = false,
  } = options;
  
  const issues: ValidationIssue[] = [];
  const stats = {
    pageMetadataChecked: 0,
    navigationEdgesChecked: 0,
    assetsChecked: 0,
    contentChecked: 0,
    structuredDataChecked: 0,
    technologyChecked: 0,
    renderStateChecked: 0,
    performanceChecked: 0,
    securityChecked: 0,
    responsesChecked: 0,
    resourcesChecked: 0,
    sitemapsChecked: 0,
    sitemapUrlsChecked: 0,
    extractionChecked: 0,
    eventsChecked: 0,
    accessibilityChecked: 0,
    pipelineFailuresChecked: 0,
    pipelineAlertsChecked: 0,
    robotsChecked: 0,
    errorsFound: 0,
    warningsFound: 0,
  };
  let truncated = false;
  
  // Helper to add issue
  const addIssue = (issue: ValidationIssue): boolean => {
    if (errorsOnly && issue.severity !== "error") {
      return true; // Skip non-errors
    }
    
    issues.push(issue);
    
    if (issue.severity === "error") {
      stats.errorsFound++;
    } else if (issue.severity === "warning") {
      stats.warningsFound++;
    }
    
    if (issues.length >= maxIssues) {
      truncated = true;
      return false;
    }
    return true;
  };
  
  let atlas: Awaited<ReturnType<typeof openAtlas>> | null = null;
  try {
    atlas = await openAtlas(atlsPath, { strict: false, limits });
    const activeAtlas = atlas;
    // atlasVersion is the stamp. specVersion and formatVersion do not
    // keep a 1.2 or 1.3 line on the 1.1 writer rules.
    const writerRules = archiveRequiresWriterRules(atlas.manifest);
    
    // Phase 1: Check manifest schema
    if (checkManifest) {
      validateManifestSchema(atlas.manifest, addIssue, { strict });
    }
    if (writerRules) {
      validateWriterSlashDeclarations(atlas.manifest, addIssue);
    }

    // Spec 1.3: when both endReason and completionReason are present, they
    // must follow the normative map. completionReason stays required. A 1.2
    // summary that omits endReason is not checked.
    const crawlContext = atlas.summary?.crawlContext as { endReason?: unknown; completionReason?: unknown } | undefined;
    if (crawlContext && typeof crawlContext.endReason === "string" && typeof crawlContext.completionReason === "string") {
      const expected = completionReasonForEndReason(crawlContext.endReason);
      if (expected !== crawlContext.completionReason) {
        addIssue({
          severity: "error",
          code: "END_REASON_MISMATCH",
          message: `summary.crawlContext.endReason "${crawlContext.endReason}" maps to completionReason "${expected ?? "unknown"}", got "${crawlContext.completionReason}"`,
          details: { endReason: crawlContext.endReason, completionReason: crawlContext.completionReason, expected },
        });
      }
    }

    // Phase 1b: part checksums, contentSha256, and blob hashes.
    // Readers do not treat archiveSha256 or auditHash as a ZIP hash.
    // A 1.2 or later atlasVersion must omit both fields.
    const blobPaths = new Set<string>();
    if (issues.length < maxIssues) {
      const zip = await openZipHandle(atlsPath, { limits });
      try {
        await verifyPartDigests(zip, atlas.manifest, addIssue, writerRules);
        if (!skipBlobVerification) {
          await verifyBlobEntries(zip, addIssue, blobPaths);
        }
      } finally {
        zip.close();
      }
    }
    
    // Phase 2: Build page index for integrity checks
    const pageUrls = new Set<string>();

    // Use raw dataset reader (not pageMetadata()) to preserve nested `core`
    // structure needed by validatePageSchema's canonical-format detection.
    for await (const page of atlas.readers.dataset<Record<string, any>>("page_metadata" as any)) {
      const pageRecord = page as Record<string, any>;
      stats.pageMetadataChecked++;

      // Validate page schema
      if (!validatePageSchema(pageRecord, addIssue, { strict })) {
        if (writerRules) {
          collectBlobRefIssues(pageRecord, "page_metadata", blobPaths, addIssue, {
            writerRules: true,
            checkExists: false,
          });
        }
        continue; // Skip integrity checks if schema invalid
      }

      const pageUrl = typeof pageRecord.url === "string" ? pageRecord.url : "";
      if (pageUrl) {
        pageUrls.add(pageUrl);
      }
      if (!skipBlobVerification || writerRules) {
        collectBlobRefIssues(pageRecord, "page_metadata", blobPaths, addIssue, {
          writerRules,
          checkExists: !skipBlobVerification,
        });
      }

      if (issues.length >= maxIssues) break;
    }

    // Phase 2.5: Build a url -> statusCode index from responses, for the
    // broken-link check in Phase 3. page_metadata records carry no
    // statusCode field of their own — status only lives in the responses
    // dataset. (checkBrokenLinks previously read
    // pageRecord.statusCode, a field canonical page_metadata records never
    // have, so it was permanently a no-op.)
    const pageStatusCodes = new Map<string, number>();
    if (checkBrokenLinks) {
      for await (const response of atlas.readers.responses()) {
        const responseRecord = response as Record<string, any>;
        if (typeof responseRecord.url === "string" && typeof responseRecord.statusCode === "number") {
          pageStatusCodes.set(responseRecord.url, responseRecord.statusCode);
        }
        if (issues.length >= maxIssues) break;
      }
    }

    // Phase 3: Validate navigation records (schema + referential integrity)
    for await (const navigationRecord of atlas.readers.navigation()) {
      stats.navigationEdgesChecked++;
      const navRecord = navigationRecord as Record<string, any>;

      // Zod schema validation — single source of truth for record shape
      const parsed = NavigationDatasetRecordV1Schema.safeParse(navRecord);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const path = firstIssue?.path?.length ? `/${firstIssue.path.join("/")}` : "/";
        addIssue({
          severity: "error",
          code: "DATASET_SCHEMA_VIOLATION",
          message: `navigation record failed schema validation: ${path} ${firstIssue?.message ?? "unknown"}`,
          dataset: "navigation",
          record: navRecord,
        });
        if (issues.length >= maxIssues) break;
        continue;
      }

      // Referential integrity checks on validated records
      if (checkIntegrity) {
        const navSourceUrl = navRecord.sourceUrl as string;

        for (const edge of navRecord.edges as Array<Record<string, any>>) {
          const edgeSourceUrl = typeof edge.sourceUrl === "string" ? edge.sourceUrl : navSourceUrl;

          if (!pageUrls.has(edgeSourceUrl)) {
            addIssue({
              severity: "error",
              code: "EDGE_INVALID_SOURCE",
              message: `Edge references non-existent source page: ${edgeSourceUrl}`,
              dataset: "navigation",
              record: edge,
              details: { sourceUrl: edgeSourceUrl, targetUrl: edge.targetUrl },
            });
          }

          if (checkBrokenLinks && !edge.isExternal && edge.targetUrl) {
            const targetStatus = pageStatusCodes.get(edge.targetUrl as string);
            if (targetStatus && (targetStatus === 404 || targetStatus >= 500)) {
              addIssue({
                severity: "warning",
                code: "EDGE_BROKEN_LINK",
                message: `Internal link leads to ${targetStatus}: ${edgeSourceUrl} → ${edge.targetUrl}`,
                dataset: "navigation",
                record: edge,
                details: { sourceUrl: edgeSourceUrl, targetUrl: edge.targetUrl, statusCode: targetStatus },
              });
            }
          }
        }
      }

      if (issues.length >= maxIssues) {
        break;
      }
    }
    
    // Phase 4: Validate assets
    for await (const asset of atlas.readers.assets()) {
      stats.assetsChecked++;
      
      // Validate asset schema
      const assetSchemaOk = validateAssetSchema(asset, addIssue, { strict });
      if (!assetSchemaOk) {
        if (writerRules) {
          collectBlobRefIssues(asset, "assets", blobPaths, addIssue, {
            writerRules: true,
            checkExists: false,
          });
        }
        continue;
      }
      if (writerRules) {
        checkWriterAssetId(asset, addIssue);
      }
      
      // Check referential integrity
      if (checkIntegrity && !pageUrls.has(asset.pageUrl)) {
        addIssue({
          severity: "error",
          code: "ASSET_INVALID_REFERRER",
          message: `Asset references non-existent referrer page: ${asset.pageUrl}`,
          dataset: "assets",
          record: asset,
          details: { assetUrl: asset.assetUrl, pageUrl: asset.pageUrl },
        });
      }
      if (!skipBlobVerification || writerRules) {
        collectBlobRefIssues(asset, "assets", blobPaths, addIssue, {
          writerRules,
          checkExists: !skipBlobVerification,
        });
      }
      
      if (issues.length >= maxIssues) break;
    }

    // Phase 4.5: Strict-only response checks (blob refs + null semantics)
    if (strict) {
      for await (const response of atlas.readers.responses()) {
        validateResponseSchema(response, addIssue, { strict });
        if (issues.length >= maxIssues) break;
      }
    }

    // Phase 4.6: Validate remaining datasets against their Zod schemas
    const zodDatasets: Array<{
      name: string;
      statKey: keyof typeof stats;
      reader: () => AsyncIterable<any>;
      schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } };
    }> = [
      { name: "content", statKey: "contentChecked", reader: activeAtlas.readers.content, schema: ContentDatasetRecordV1Schema },
      { name: "structured_data", statKey: "structuredDataChecked", reader: activeAtlas.readers.structuredData, schema: StructuredDataDatasetRecordV1Schema },
      { name: "technology", statKey: "technologyChecked", reader: activeAtlas.readers.technology, schema: TechnologyDatasetRecordV1Schema },
      { name: "render_state", statKey: "renderStateChecked", reader: activeAtlas.readers.renderState, schema: RenderStateDatasetRecordV1Schema },
      { name: "performance", statKey: "performanceChecked", reader: activeAtlas.readers.performance, schema: PerformanceDatasetRecordV1Schema },
      { name: "security", statKey: "securityChecked", reader: activeAtlas.readers.security, schema: SecurityDatasetRecordV1Schema },
      { name: "responses", statKey: "responsesChecked", reader: activeAtlas.readers.responses, schema: ResponseRecordV1ZodSchema },
      { name: "resources", statKey: "resourcesChecked", reader: activeAtlas.readers.resources, schema: ResourceRecordV1Schema },
      { name: "sitemaps", statKey: "sitemapsChecked", reader: () => activeAtlas.readers.dataset("sitemaps"), schema: SitemapDatasetRecordV1Schema },
      { name: "sitemap_urls", statKey: "sitemapUrlsChecked", reader: () => activeAtlas.readers.sitemapUrls(), schema: SitemapUrlDatasetRecordV1Schema },
      { name: "extraction", statKey: "extractionChecked", reader: () => activeAtlas.readers.extraction(), schema: ExtractionDatasetRecordV1Schema },
      { name: "events", statKey: "eventsChecked", reader: activeAtlas.readers.events, schema: EventRecordV1Schema },
      { name: "accessibility", statKey: "accessibilityChecked", reader: activeAtlas.readers.accessibility, schema: AccessibilityDatasetRecordV1Schema },
      { name: "pipeline_failures", statKey: "pipelineFailuresChecked", reader: activeAtlas.readers.pipelineFailures, schema: PipelineFailureRecordV1Schema },
      { name: "pipeline_alerts", statKey: "pipelineAlertsChecked", reader: activeAtlas.readers.pipelineAlerts, schema: PipelineAlertRecordV1Schema },
    ];

    for (const { name, statKey, reader, schema } of zodDatasets) {
      if (!atlas.hasDataset(name as any)) continue;
      if (!schema) continue; // skip datasets without schema (should not happen)
      try {
        for await (const record of reader()) {
          (stats as any)[statKey]++;
          const parsed = schema.safeParse(record);
          if (!parsed.success) {
            const firstIssue = parsed.error?.issues[0];
            const path = firstIssue?.path?.length ? `/${firstIssue.path.join("/")}` : "/";
            addIssue({
              severity: "error",
              code: "DATASET_SCHEMA_VIOLATION",
              message: `${name} record failed schema validation: ${path} ${firstIssue?.message ?? "unknown"}`,
              dataset: name,
              record,
            });
          } else if (!skipBlobVerification || writerRules) {
            collectBlobRefIssues(record, name, blobPaths, addIssue, {
              writerRules,
              checkExists: !skipBlobVerification,
            });
          }
          if (!parsed.success && writerRules) {
            collectBlobRefIssues(record, name, blobPaths, addIssue, {
              writerRules: true,
              checkExists: false,
            });
          }
          if (issues.length >= maxIssues) break;
        }
      } catch (err) {
        // hasDataset(name) was true above, so the dataset IS present in the
        // archive. A throw here therefore means it could not be read/decompressed
        // (e.g. a truncated or corrupt part) — that must be surfaced, not
        // silently treated as "absent". Otherwise validate() certifies corrupt
        // archives as valid.
        addIssue({
          severity: "error",
          code: "DATASET_UNREADABLE",
          message: `${name} dataset is present but could not be read (likely truncated or corrupt): ${err instanceof Error ? err.message : String(err)}`,
          dataset: name,
        });
      }
    }

    // Spec 1.3 robots dataset. bodyBlobRef resolution is the blob-ref walk
    // below. blockedNoCopy may be true only when manifest.robotsPolicy.failClosed
    // is true. One row per origin.
    if (atlas.hasDataset("robots" as any) && issues.length < maxIssues) {
      const seenOrigins = new Set<string>();
      const failClosed = (atlas.manifest as { robotsPolicy?: { failClosed?: unknown } }).robotsPolicy?.failClosed === true;
      try {
        for await (const record of activeAtlas.readers.robots()) {
          stats.robotsChecked++;
          const parsed = RobotsDatasetRecordV1Schema.safeParse(record);
          if (!parsed.success) {
            const firstIssue = parsed.error.issues[0];
            const path = firstIssue?.path?.length ? `/${firstIssue.path.join("/")}` : "/";
            addIssue({
              severity: "error",
              code: "DATASET_SCHEMA_VIOLATION",
              message: `robots record failed schema validation: ${path} ${firstIssue?.message ?? "unknown"}`,
              dataset: "robots",
              record,
            });
          } else {
            if (!skipBlobVerification || writerRules) {
              collectBlobRefIssues(parsed.data, "robots", blobPaths, addIssue, {
                writerRules,
                checkExists: !skipBlobVerification,
              });
            }
            if (parsed.data.blockedNoCopy && !failClosed) {
              addIssue({
                severity: "error",
                code: "ROBOTS_BLOCKED_NO_COPY",
                message: "robots.blockedNoCopy is true only when manifest.robotsPolicy.failClosed is true",
                dataset: "robots",
                record,
                details: { origin: parsed.data.origin },
              });
            }
            if (seenOrigins.has(parsed.data.origin)) {
              addIssue({
                severity: "error",
                code: "ROBOTS_DUPLICATE_ORIGIN",
                message: `robots has more than one row for origin ${parsed.data.origin}`,
                dataset: "robots",
                record,
                details: { origin: parsed.data.origin },
              });
            }
            seenOrigins.add(parsed.data.origin);
          }
          if (!parsed.success && writerRules) {
            collectBlobRefIssues(record, "robots", blobPaths, addIssue, {
              writerRules: true,
              checkExists: false,
            });
          }
          if (issues.length >= maxIssues) break;
        }
      } catch (err) {
        addIssue({
          severity: "error",
          code: "DATASET_UNREADABLE",
          message: `robots dataset is present but could not be read (likely truncated or corrupt): ${err instanceof Error ? err.message : String(err)}`,
          dataset: "robots",
        });
      }
    }

    // reconstruction_index is not schema-checked. A 1.2 or later stamp still
    // rejects the legacy blob spelling on screenshot, favicon, body, and tile src.
    if (writerRules && atlas.hasDataset("reconstruction_index" as any) && issues.length < maxIssues) {
      try {
        for await (const record of activeAtlas.readers.dataset("reconstruction_index")) {
          if (!collectBlobRefIssues(record, "reconstruction_index", blobPaths, addIssue, {
            writerRules: true,
            checkExists: false,
          })) {
            break;
          }
        }
      } catch (err) {
        addIssue({
          severity: "error",
          code: "DATASET_UNREADABLE",
          message: `reconstruction_index dataset is present but could not be read (likely truncated or corrupt): ${err instanceof Error ? err.message : String(err)}`,
          dataset: "reconstruction_index",
        });
      }
    }
    
    // Records that could not be parsed were silently skipped during the lenient
    // reads above (e.g. truncated/corrupt dataset parts) and only tallied in
    // atlas.stats.corruptedRecordCount. Surface them — otherwise validate()
    // certifies a corrupt archive as valid. This is the
    // lenient-mode complement to the DATASET_UNREADABLE catch above.
    if (atlas.stats.corruptedRecordCount > 0) {
      addIssue({
        severity: "error",
        code: "CORRUPTED_RECORDS",
        message: `${atlas.stats.corruptedRecordCount} record(s) could not be parsed and were skipped (likely truncated or corrupt dataset parts)`,
      });
    }

    // Phase 5: Check manifest counts
    if (checkManifest) {
      validateManifestCounts(atlas.manifest, {
        pages: stats.pageMetadataChecked,
        edges: stats.navigationEdgesChecked,
        assets: stats.assetsChecked,
      }, addIssue);
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof AtlasMissingFormatVersionError) {
      addIssue({
        severity: "error",
        code: "MANIFEST_MISSING_FORMAT_VERSION",
        message: "Manifest missing required formatVersion field",
        details: { error: message },
      });
    } else if (error instanceof AtlasUnsupportedFormatVersionError) {
      addIssue({
        severity: "error",
        code: error.reason === "invalid" ? "MANIFEST_INVALID_FORMAT_VERSION" : "MANIFEST_UNSUPPORTED_FORMAT_VERSION",
        message,
        details: { error: message, formatVersion: error.formatVersion },
      });
    } else if (error instanceof AtlasResourceLimitError) {
      addIssue({
        severity: "error",
        code: error.code,
        message,
        details: { resource: error.resource, limit: error.limit, actual: error.actual },
      });
    } else {
      addIssue({
        severity: "error",
        code: "VALIDATION_FATAL",
        message: `Fatal validation error: ${message}`,
        details: { error: String(error) },
      });
    }
  } finally {
    atlas?.close();
  }
  
  // A truncated run only checked part of the archive, so "no errors
  // found" is inconclusive, not a pass. Report it as indeterminate and refuse
  // to claim validity.
  const indeterminate = truncated && stats.errorsFound === 0;
  return {
    valid: stats.errorsFound === 0 && !truncated,
    indeterminate,
    issues,
    stats,
    truncated,
  };
}

/**
 * Writer rules follow `atlasVersion` (then `atlas_semver` when that field is
 * absent). Minor 2 and later, including 1.3, use the 1.2 writer rules.
 * A 1.1 or earlier stamp keeps the lenient checks. `specVersion` does not
 * override this stamp.
 */
function archiveRequiresWriterRules(manifest: { atlasVersion?: unknown; atlas_semver?: unknown }): boolean {
  const stamped = typeof manifest.atlasVersion === "string" && manifest.atlasVersion.trim().length > 0
    ? manifest.atlasVersion
    : manifest.atlas_semver;
  if (typeof stamped !== "string") return false;
  const match = stamped.trim().match(/^v?(\d+)(?:\.(\d+))?/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = match[2] === undefined ? 0 : Number(match[2]);
  return major > 1 || (major === 1 && minor >= 2);
}

function reportDeprecatedIntegrityFields(
  manifest: Record<string, any>,
  addIssue: (issue: ValidationIssue) => boolean
): void {
  const integrity = manifest.integrity;
  if (!integrity || typeof integrity !== "object" || Array.isArray(integrity)) return;
  const present = (["archiveSha256", "auditHash"] as const).filter((key) => integrity[key] !== undefined);
  if (present.length === 0) return;
  const names = present.map((key) => `integrity.${key}`).join(" and ");
  const verb = present.length === 1 ? "is" : "are";
  addIssue({
    severity: "error",
    code: "INTEGRITY_DEPRECATED_FIELD",
    message: `${names} ${verb} present. A 1.2 or later archive omits integrity.archiveSha256 and integrity.auditHash.`,
    details: { fields: present },
  });
}

interface SlashDeclaration {
  path: string;
  value: string;
}

function slashDeclarations(manifest: Record<string, any>): { canonical?: SlashDeclaration; others: SlashDeclaration[] } {
  const others: SlashDeclaration[] = [];
  let canonical: SlashDeclaration | undefined;
  const urlNorm = manifest.urlNormalization;
  if (urlNorm && typeof urlNorm === "object" && !Array.isArray(urlNorm)) {
    if (urlNorm.trailing_slash !== undefined && urlNorm.trailing_slash !== null) {
      canonical = { path: "urlNormalization.trailing_slash", value: String(urlNorm.trailing_slash) };
    }
    if (urlNorm.remove_trailing_slash !== undefined && urlNorm.remove_trailing_slash !== null) {
      others.push({ path: "urlNormalization.remove_trailing_slash", value: String(urlNorm.remove_trailing_slash) });
    }
    if (urlNorm.trailing_slash_policy !== undefined && urlNorm.trailing_slash_policy !== null) {
      others.push({ path: "urlNormalization.trailing_slash_policy", value: String(urlNorm.trailing_slash_policy) });
    }
  }
  const crawl = manifest.crawlContext;
  if (crawl && typeof crawl === "object" && !Array.isArray(crawl)) {
    if (typeof crawl.urlNormalization === "string" && crawl.urlNormalization.length > 0) {
      others.push({ path: "crawlContext.urlNormalization", value: crawl.urlNormalization });
    }
    if (Array.isArray(crawl.urlNormalizationRules)) {
      crawl.urlNormalizationRules.forEach((rule: unknown, index: number) => {
        if (typeof rule === "string" && /slash/i.test(rule)) {
          others.push({ path: `crawlContext.urlNormalizationRules[${index}]`, value: rule });
        }
      });
    }
  }
  collectCamelSlashFlags(manifest, "", others);
  return { canonical, others };
}

function collectCamelSlashFlags(value: unknown, path: string, others: SlashDeclaration[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCamelSlashFlags(item, `${path}[${index}]`, others));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if ((key === "removeTrailingSlash" || key === "trailingSlashPolicy") && child !== undefined && child !== null) {
      others.push({ path: childPath, value: String(child) });
    }
    collectCamelSlashFlags(child, childPath, others);
  }
}

function validateWriterSlashDeclarations(
  manifest: AtlasManifest,
  addIssue: (issue: ValidationIssue) => boolean
): void {
  const { canonical, others } = slashDeclarations(manifest as Record<string, any>);
  const count = (canonical ? 1 : 0) + others.length;
  const canonicalConflicts = canonical !== undefined && canonical.value !== TRAILING_SLASH_POLICY;
  if (others.length === 0 && !canonicalConflicts) return;

  const listed = [
    ...(canonical ? [`${canonical.path} is ${canonical.value}`] : []),
    ...others.map((decl) => `${decl.path} is ${decl.value}`),
  ];
  const reasons: string[] = [];
  if (count > 1) {
    reasons.push(`it declares ${count} trailing-slash rules (${listed.join("; ")})`);
  } else if (others.length === 1) {
    const only = others[0]!;
    reasons.push(`it declares ${only.path} (${only.value}) instead of urlNormalization.trailing_slash`);
  }
  if (others.length > 0) {
    reasons.push(`the only allowed declaration is urlNormalization.trailing_slash, not ${others.map((decl) => decl.path).join(", ")}`);
  }
  if (canonicalConflicts && canonical) {
    reasons.push(`urlNormalization.trailing_slash is ${canonical.value}, which conflicts with ${TRAILING_SLASH_POLICY}`);
  }
  addIssue({
    severity: "error",
    code: "TRAILING_SLASH_DECLARATION",
    message: `A 1.2 or later archive uses only urlNormalization.trailing_slash set to ${TRAILING_SLASH_POLICY}. This archive does not: ${reasons.join("; ")}.`,
    details: {
      canonical: canonical ?? null,
      others,
    },
  });
}

function checkWriterAssetId(
  asset: { assetId?: unknown; assetUrl?: unknown },
  addIssue: (issue: ValidationIssue) => boolean
): boolean {
  if (typeof asset.assetId !== "string" || typeof asset.assetUrl !== "string") return true;
  const expected = assetId(asset.assetUrl);
  if (expected !== null && asset.assetId === expected) return true;
  const message = expected === null
    ? `assetId "${asset.assetId}" is not the UUID v5 of normalizeUrl(assetUrl), because "${asset.assetUrl}" is not eligible for normalizeUrl.`
    : `assetId "${asset.assetId}" is not the UUID v5 of normalizeUrl("${asset.assetUrl}"). Expected ${expected}.`;
  return addIssue({
    severity: "error",
    code: "ASSET_ID_MISMATCH",
    message,
    dataset: "assets",
    details: { assetId: asset.assetId, assetUrl: asset.assetUrl, expected },
  });
}

/**
 * Validate manifest schema
 */
function validateManifestSchema(
  manifest: AtlasManifest,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { strict?: boolean } = {}
): void {
  const { strict = false } = options;
  const manifestAny = manifest as Record<string, any>;
  const atlasVersion = manifestAny.atlasVersion ?? manifestAny.atlas_semver;
  const formatVersion = manifestAny.formatVersion;
  const ownerName = typeof manifestAny.owner === "string" ? manifestAny.owner : manifestAny.owner?.name;
  const generatorName = manifestAny.generator ?? manifestAny.created_by?.app;
  const pageMetadataParts =
    Array.isArray(manifestAny.parts?.page_metadata) && manifestAny.parts.page_metadata.length > 0;
  const hasPageMetadataDataset = Boolean(manifestAny.datasets?.page_metadata);

  if (!atlasVersion) {
    addIssue({
      severity: "error",
      code: "MANIFEST_MISSING_VERSION",
      message: "Manifest missing atlasVersion field",
    });
  }
  
  if (!formatVersion) {
    addIssue({
      severity: "error",
      code: "MANIFEST_MISSING_FORMAT_VERSION",
      message: "Manifest missing required formatVersion field",
    });
  } else {
    // Check format version compatibility using the same rule openAtlas()
    // enforces (via enforceFormatVersionSupport), so both paths agree on
    // exactly which formatVersion values are supported.
    const parsed = parseFormatVersion(String(formatVersion));
    if (!parsed || parsed.major !== SUPPORTED_FORMAT_MAJOR) {
      addIssue({
        severity: "error",
        code: "MANIFEST_UNSUPPORTED_FORMAT_VERSION",
        message: `Unsupported format version: ${formatVersion} (SDK supports ${SUPPORTED_FORMAT_MAJOR}.x.x only)`,
        details: { formatVersion },
      });
    }
  }
  
  if (!ownerName) {
    addIssue({
      severity: "warning",
      code: "MANIFEST_MISSING_OWNER",
      message: "Manifest missing owner.name field",
    });
  }
  
  if (!generatorName) {
    addIssue({
      severity: "warning",
      code: "MANIFEST_MISSING_GENERATOR",
      message: "Manifest missing generator field",
    });
  }
  
  if (!pageMetadataParts && !hasPageMetadataDataset) {
    addIssue({
      severity: "error",
      code: "MANIFEST_MISSING_PARTS",
      message: "Manifest missing page_metadata dataset metadata",
    });
  }

  if (strict) {
    const requireField = (value: unknown, path: string, message: string): void => {
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim().length === 0);
      if (!missing) return;
      addIssue({
        severity: "error",
        code: "MANIFEST_STRICT_MISSING_FIELD",
        message,
        details: { path },
      });
    };
    const requireFiniteNumber = (value: unknown, path: string, message: string): void => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return;
      }
      addIssue({
        severity: "error",
        code: "MANIFEST_STRICT_INVALID_FIELD",
        message,
        details: { path, expected: "finite number" },
      });
    };

    const crawlId = manifestAny.crawlId ?? manifestAny.crawl_id ?? manifestAny.crawl?.crawlId;
    const renderMode = manifestAny.mode ?? manifestAny.crawl?.renderMode;
    requireField(manifestAny.owner?.name, "owner.name", "Manifest missing required owner.name field");
    requireField(manifestAny.hashing?.algorithm, "hashing.algorithm", "Manifest missing required hashing.algorithm field");
    requireField(crawlId, "crawlId", "Manifest missing required crawlId field");
    requireField(renderMode, "mode", "Manifest missing required mode field");
    if (typeof manifestAny.incomplete !== "boolean") {
      addIssue({
        severity: "error",
        code: "MANIFEST_STRICT_INVALID_FIELD",
        message: "Manifest missing required incomplete boolean field",
        details: { path: "incomplete", expected: "boolean" },
      });
    }
    requireField(manifestAny.specVersion, "specVersion", "Manifest missing required specVersion field");

    if (!Array.isArray(manifestAny.consumers)) {
      addIssue({
        severity: "error",
        code: "MANIFEST_STRICT_INVALID_FIELD",
        message: "Manifest missing required consumers array",
        details: { path: "consumers", expected: "string[]" },
      });
    }

    const coverage = manifestAny.coverage ?? manifestAny.stats;
    if (!coverage || typeof coverage !== "object") {
      addIssue({
        severity: "error",
        code: "MANIFEST_STRICT_MISSING_FIELD",
        message: "Manifest missing required coverage/stats object",
        details: { path: "coverage" },
      });
    } else {
      const totalPages = coverage.total_pages ?? coverage.totalPages;
      const totalEdges = coverage.total_edges ?? coverage.totalEdges;
      const totalAssets = coverage.total_assets ?? coverage.totalAssets;
      // As of 2026-07-04, the producer's coverage block is now
      // camelCase and emits pagesWithErrors — included in the fallback chain
      // alongside the legacy snake spellings.
      const totalErrors = coverage.total_errors ?? coverage.totalErrors ?? coverage.pagesWithErrors ?? coverage.pages_with_errors;
      requireFiniteNumber(totalPages, "coverage.total_pages", "Manifest missing required coverage.total_pages field");
      requireFiniteNumber(totalEdges, "coverage.total_edges", "Manifest missing required coverage.total_edges field");
      requireFiniteNumber(totalAssets, "coverage.total_assets", "Manifest missing required coverage.total_assets field");
      requireFiniteNumber(totalErrors, "coverage.total_errors", "Manifest missing required coverage.total_errors/pages_with_errors field");
    }
  }
}

/**
 * Validate page record schema
 *
 * Previously, hand-rolled truthy checks on a
 * handful of fields (url/finalUrl/statusCode/depth — none of which exist on
 * canonical page_metadata records, since those checks predate the nested
 * core/indexing/social format). Replaced with the real
 * `@caifrazier/atls-spec` Zod schema — the single source of truth for record shape,
 * already reused this way for every other dataset in this file.
 */
function validatePageSchema(
  page: Record<string, any>,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { strict?: boolean } = {}
): boolean {
  const { strict = false } = options;
  const datasetName = "page_metadata";

  const parsed = PageMetadataDatasetRecordV1Schema.safeParse(page);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const path = firstIssue?.path?.length ? `/${firstIssue.path.join("/")}` : "/";
    addIssue({
      severity: "error",
      code: "DATASET_SCHEMA_VIOLATION",
      message: `page_metadata record failed schema validation: ${path} ${firstIssue?.message ?? "unknown"}`,
      dataset: datasetName,
      record: page,
    });
  }

  if (strict) {
    validateStrictTopLevelNulls(page as unknown as Record<string, unknown>, datasetName, addIssue);
    // page_metadata carries no blob ref — the old top-level "body_blob_ref" check was a
    // permanent no-op (required=false → undefined → pass). Removed.
  }

  return parsed.success;
}

/**
 * Validate asset record schema
 *
 * Replaced hand-rolled truthy checks (which had
 * drifted stale, for example ASSET_INVALID_TYPE only allowed "image"/"video" even
 * though the current AssetTypeEnum also permits "audio"/"document") with the
 * real `@caifrazier/atls-spec` Zod schema, matching every other dataset in this file.
 */
function validateAssetSchema(
  asset: AssetRecord,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { strict?: boolean } = {}
): boolean {
  const { strict = false } = options;

  const parsed = AssetRecordSchema.safeParse(asset);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const path = firstIssue?.path?.length ? `/${firstIssue.path.join("/")}` : "/";
    addIssue({
      severity: "error",
      code: "DATASET_SCHEMA_VIOLATION",
      message: `assets record failed schema validation: ${path} ${firstIssue?.message ?? "unknown"}`,
      dataset: "assets",
      record: asset,
    });
  }

  if (strict) {
    validateStrictTopLevelNulls(asset as unknown as Record<string, unknown>, "assets", addIssue, new Set(["visible", "inViewport"]));
    // The asset blob ref lives at resourceHint.bodyBlobRef (nested, optional), not at the
    // top level — validate it there when present.
    const resourceHint = (asset as unknown as Record<string, unknown>).resourceHint as
      | Record<string, unknown>
      | undefined;
    if (resourceHint) {
      validateCanonicalBlobRef(resourceHint, "assets", "bodyBlobRef", addIssue);
    }
  }

  return parsed.success;
}

function validateResponseSchema(
  response: ResponseRecordV1,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { strict?: boolean } = {}
): boolean {
  const { strict = false } = options;
  let valid = true;
  if (strict) {
    validateStrictTopLevelNulls(response as Record<string, unknown>, "responses", addIssue);
    if (!validateCanonicalBlobRef(response as Record<string, unknown>, "responses", "bodyBlobRef", addIssue, true)) {
      valid = false;
    }
  }
  return valid;
}

function validateStrictTopLevelNulls(
  record: Record<string, unknown>,
  dataset: string,
  addIssue: (issue: ValidationIssue) => boolean,
  allowedNullFields: Set<string> = new Set()
): void {
  for (const [key, value] of Object.entries(record)) {
    if (value !== null) continue;
    if (allowedNullFields.has(key)) continue;
    addIssue({
      severity: "error",
      code: "STRICT_NULL_FORBIDDEN",
      message: `Strict mode: field "${key}" must be omitted instead of null`,
      dataset,
      record,
      details: { field: key },
    });
  }
}

function validateCanonicalBlobRef(
  record: Record<string, unknown>,
  dataset: string,
  fieldName: string,
  addIssue: (issue: ValidationIssue) => boolean,
  required = false
): boolean {
  const value = record[fieldName];
  if (value === undefined) {
    if (!required) return true;
    addIssue({
      severity: "error",
      code: "STRICT_BLOB_REF_MISSING",
      message: `Strict mode: required blob ref "${fieldName}" is missing`,
      dataset,
      record,
      details: { field: fieldName },
    });
    return false;
  }
  if (typeof value !== "string") {
    addIssue({
      severity: "error",
      code: "STRICT_BLOB_REF_INVALID_TYPE",
      message: `Strict mode: blob ref "${fieldName}" must be a string`,
      dataset,
      record,
      details: { field: fieldName, actualType: typeof value },
    });
    return false;
  }
  if (!parseBlobRef(value)) {
    addIssue({
      severity: "error",
      code: "STRICT_BLOB_REF_NON_CANONICAL",
      message: `Strict mode: blob ref "${fieldName}" must be sha256/<2>/<2>/<64 hex> or the legacy blobs/sha256/<2>/<2>/<64 hex>.zst spelling`,
      dataset,
      record,
      details: { field: fieldName, value },
    });
    return false;
  }
  return true;
}

/**
 * Validate manifest counts against actual data
 */
function validateManifestCounts(
  manifest: AtlasManifest,
  actual: { pages: number; edges: number; assets: number },
  addIssue: (issue: ValidationIssue) => boolean
): void {
  // Get counts from datasets if available
  const manifestAny = manifest as Record<string, any>;
  const getCount = (meta?: Record<string, any>): number => {
    if (!meta) return 0;
    const value = meta.recordCount;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  const manifestPages = getCount(manifestAny.datasets?.page_metadata);
  const manifestEdges = getCount(manifestAny.datasets?.navigation);
  const manifestAssets = getCount(manifestAny.datasets?.assets);
  
  if (manifestPages !== actual.pages) {
    addIssue({
      severity: "error",
      code: "MANIFEST_COUNT_MISMATCH_PAGES",
      message: `Manifest pages count mismatch: manifest=${manifestPages}, actual=${actual.pages}`,
      details: { manifest: manifestPages, actual: actual.pages },
    });
  }
  
  if (manifestEdges !== actual.edges) {
    addIssue({
      severity: "error",
      code: "MANIFEST_COUNT_MISMATCH_EDGES",
      message: `Manifest edges count mismatch: manifest=${manifestEdges}, actual=${actual.edges}`,
      details: { manifest: manifestEdges, actual: actual.edges },
    });
  }
  
  if (manifestAssets !== actual.assets) {
    addIssue({
      severity: "error",
      code: "MANIFEST_COUNT_MISMATCH_ASSETS",
      message: `Manifest assets count mismatch: manifest=${manifestAssets}, actual=${actual.assets}`,
      details: { manifest: manifestAssets, actual: actual.assets },
    });
  }
}

/**
 * Part checksums are SHA-256 of the ZIP entry payload (the bytes a ZIP reader
 * returns). That payload is the Zstandard frame, or the raw JSONL when the
 * part is uncompressed. Do not decompress Zstandard and do not recompress.
 * contentSha256 rolls those checksums up in UTF-8 path order. Spec 1.1
 * archives may also match en-US or Thai localeCompare order.
 * archiveSha256 and auditHash are not verified as ZIP hashes. A 1.2 or
 * later atlasVersion must omit them.
 */
async function verifyPartDigests(
  zip: ZipHandle,
  manifest: AtlasManifest,
  addIssue: (issue: ValidationIssue) => boolean,
  writerRules: boolean
): Promise<void> {
  const manifestAny = manifest as Record<string, any>;
  // A 1.2+ atlasVersion uses byte order even when specVersion is still 1.1.
  const edition = writerRules ? "1.2" : integrityEdition(manifestAny);
  if (writerRules) {
    reportDeprecatedIntegrityFields(manifestAny, addIssue);
  }
  const declaredFiles = manifestAny.integrity?.files as Record<string, unknown> | undefined;
  const declaredDigest = manifestAny.integrity?.contentSha256;
  const hasFiles = !!declaredFiles && typeof declaredFiles === "object" && !Array.isArray(declaredFiles);
  const hasDigest = typeof declaredDigest === "string" && declaredDigest.trim().length > 0;
  if (!hasFiles && !hasDigest && edition !== "1.2") {
    return;
  }

  const actual: Record<string, string> = {};
  for (const relativePath of zip.listEntries()) {
    if (!isDatasetPartPath(relativePath)) {
      continue;
    }
    const payload = await zip.readEntryBuffer(relativePath, undefined, zip.limits.maxPartCompressedBytes);
    actual[relativePath] = sha256Hex(payload);
  }

  if (!hasFiles) {
    if (edition === "1.2") {
      addIssue({
        severity: "error",
        code: "PART_CHECKSUM_MISSING",
        message: "Spec 1.2 or later archive is missing integrity.files",
      });
    }
  } else {
    for (const [relativePath, declared] of Object.entries(declaredFiles)) {
      if (!isDatasetPartPath(relativePath)) {
        if (!addIssue({
          severity: "error",
          code: "PART_CHECKSUM_UNEXPECTED",
          message: `integrity.files key is not a dataset part path: ${relativePath}`,
          details: { path: relativePath },
        })) return;
        continue;
      }
      if (!(relativePath in actual)) {
        if (!addIssue({
          severity: "error",
          code: "PART_FILE_MISSING",
          message: `integrity.files lists a part that is not in the archive: ${relativePath}`,
          details: { path: relativePath },
        })) return;
        continue;
      }
      const expected = actual[relativePath]!;
      if (typeof declared !== "string" || declared.toLowerCase() !== expected) {
        if (!addIssue({
          severity: "error",
          code: "PART_CHECKSUM_MISMATCH",
          message: `Part checksum does not match the stored bytes: ${relativePath}`,
          details: { path: relativePath, expected, declared },
        })) return;
      }
    }
    for (const relativePath of Object.keys(actual)) {
      if (!(relativePath in declaredFiles)) {
        if (!addIssue({
          severity: "error",
          code: "PART_CHECKSUM_MISSING",
          message: `Dataset part has no integrity.files checksum: ${relativePath}`,
          details: { path: relativePath },
        })) return;
      }
    }
  }

  const datasets = manifestAny.datasets as Record<string, any> | undefined;
  if (datasets && typeof datasets === "object") {
    for (const [datasetName, meta] of Object.entries(datasets)) {
      const checksums = meta?.integrity?.checksums as Record<string, unknown> | undefined;
      if (!checksums || typeof checksums !== "object") continue;
      for (const [relativePath, declared] of Object.entries(checksums)) {
        const expected = actual[relativePath];
        if (!expected || typeof declared !== "string" || declared.toLowerCase() !== expected) {
          if (!addIssue({
            severity: "error",
            code: "DATASET_CHECKSUM_MISMATCH",
            message: `Dataset checksum does not match the stored part: ${relativePath}`,
            dataset: datasetName,
            details: { path: relativePath, expected, declared },
          })) return;
        }
      }
    }
  }

  if (!hasDigest) {
    if (edition === "1.2") {
      addIssue({
        severity: "error",
        code: "CONTENT_SHA256_MISSING",
        message: "Spec 1.2 or later archive is missing integrity.contentSha256",
      });
    }
    return;
  }

  const declared = String(declaredDigest).toLowerCase();
  const byteOrder = contentSha256(actual, "utf8");
  if (writerRules && declared !== byteOrder) {
    const localeHits = (["en-US", "th"] as const).filter((locale) => {
      const digest = contentSha256(actual, locale);
      return digest === declared && digest !== byteOrder;
    });
    if (localeHits.length > 0) {
      const orders = localeHits.map((locale) => `${locale} localeCompare`).join(" and ");
      addIssue({
        severity: "error",
        code: "CONTENT_SHA256_LOCALE_ORDER",
        message: `integrity.contentSha256 matches ${orders} path order and not UTF-8 byte order. A 1.2 or later archive accepts byte order only.`,
        details: { declared: declaredDigest, byteOrder, locales: localeHits },
      });
      return;
    }
  }

  const accepted = acceptedContentDigests(actual, edition);
  if (!accepted.includes(declared)) {
    addIssue({
      severity: "error",
      code: "CONTENT_SHA256_MISMATCH",
      message: edition === "1.2"
        ? "integrity.contentSha256 does not match the part checksums in UTF-8 path order"
        : "integrity.contentSha256 does not match the part checksums in UTF-8 path order or in 1.1 locale order",
      details: { declared: declaredDigest, accepted },
    });
  }
}

/**
 * Blob integrity is per blob: decompress the Zstandard frame, SHA-256 the
 * uncompressed bytes, and compare to the hash in the path. Any Zstandard
 * level is acceptable. `blobPaths` receives every blob entry path so record
 * references can be resolved.
 */
async function verifyBlobEntries(
  zip: ZipHandle,
  addIssue: (issue: ValidationIssue) => boolean,
  blobPaths: Set<string>
): Promise<void> {
  for (const relativePath of zip.listEntries()) {
    if (!relativePath.startsWith("blobs/") || relativePath.endsWith("/")) {
      continue;
    }
    blobPaths.add(relativePath);
    const parsed = parseBlobRef(relativePath);
    if (!parsed || parsed.archivePath !== relativePath) {
      if (!addIssue({
        severity: "error",
        code: "BLOB_PATH_INVALID",
        message: `Blob entry is not blobs/sha256/<2>/<2>/<64 hex>.zst: ${relativePath}`,
        details: { path: relativePath },
      })) return;
      continue;
    }
    let uncompressed: Buffer;
    try {
      const compressed = await zip.readEntryBuffer(relativePath, undefined, zip.limits.maxBlobCompressedBytes);
      uncompressed = decompressZstdBuffer(compressed, {
        resource: relativePath,
        maxBytes: zip.limits.maxBlobDecompressedBytes,
      });
    } catch (error) {
      if (!addIssue({
        severity: "error",
        code: "BLOB_UNREADABLE",
        message: `Blob could not be decompressed: ${relativePath}`,
        details: { path: relativePath, error: error instanceof Error ? error.message : String(error) },
      })) return;
      continue;
    }
    const actual = sha256Hex(uncompressed);
    if (actual !== parsed.hash) {
      if (!addIssue({
        severity: "error",
        code: "BLOB_HASH_MISMATCH",
        message: `Blob bytes do not match the hash in the path: ${relativePath}`,
        details: { path: relativePath, expected: parsed.hash, actual },
      })) return;
    }
  }
}

function collectBlobRefIssues(
  value: unknown,
  dataset: string,
  blobPaths: Set<string>,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { writerRules: boolean; checkExists: boolean },
  depth = 0,
  fieldPath = ""
): boolean {
  if (depth > 12 || value == null) return true;
  if (typeof value === "string") {
    const parsed = parseBlobRef(value);
    if (!parsed) return true;
    const ref = value.trim();
    if (options.writerRules && ref === parsed.legacy) {
      const where = fieldPath ? `${dataset}.${fieldPath}` : dataset;
      if (!addIssue({
        severity: "error",
        code: "LEGACY_BLOB_REF",
        message: `${where} uses the legacy blob ref spelling ${ref}. A 1.2 or later record uses ${parsed.canonical}.`,
        dataset,
        details: { field: fieldPath, ref, canonical: parsed.canonical },
      })) return false;
    }
    if (!options.checkExists || blobPaths.has(parsed.archivePath)) return true;
    return addIssue({
      severity: "error",
      code: "BLOB_NOT_FOUND",
      message: `Blob reference does not match an entry: ${parsed.archivePath}`,
      dataset,
      details: { path: parsed.archivePath, ref: value },
    });
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const childPath = fieldPath ? `${fieldPath}[${index}]` : `[${index}]`;
      if (!collectBlobRefIssues(value[index], dataset, blobPaths, addIssue, options, depth + 1, childPath)) {
        return false;
      }
    }
    return true;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = fieldPath ? `${fieldPath}.${key}` : key;
      if (!collectBlobRefIssues(child, dataset, blobPaths, addIssue, options, depth + 1, childPath)) {
        return false;
      }
    }
  }
  return true;
}
