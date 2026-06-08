/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import { openAtlas } from "./index.js";
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
  EventRecordV1Schema,
  AccessibilityDatasetRecordV1Schema,
  PipelineFailureRecordV1Schema,
  PipelineAlertRecordV1Schema,
} from "@atls/spec";

const CANONICAL_BLOB_REF_RE = /^sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}$/;

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
  valid: boolean;
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
    eventsChecked: number;
    accessibilityChecked: number;
    pipelineFailuresChecked: number;
    pipelineAlertsChecked: number;
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
    eventsChecked: 0,
    accessibilityChecked: 0,
    pipelineFailuresChecked: 0,
    pipelineAlertsChecked: 0,
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
  
  try {
    const atlas = await openAtlas(atlsPath, { strict: false });
    
    // Phase 1: Check manifest schema
    if (checkManifest) {
      validateManifestSchema(atlas.manifest, addIssue, { strict });
    }
    
    // Phase 2: Build page index for integrity checks
    const pageUrls = new Set<string>();
    const pageStatusCodes = new Map<string, number>();
    
    // Use raw dataset reader (not pageMetadata()) to preserve nested `core`
    // structure needed by validatePageSchema's canonical-format detection.
    for await (const page of atlas.readers.dataset<Record<string, any>>("page_metadata" as any)) {
      const pageRecord = page as Record<string, any>;
      stats.pageMetadataChecked++;
      
      // Validate page schema
      if (!validatePageSchema(pageRecord, addIssue, { strict })) {
        continue; // Skip integrity checks if schema invalid
      }
      
      const pageUrl = typeof pageRecord.url === "string" ? pageRecord.url : "";
      const pageStatusCode = typeof pageRecord.statusCode === "number" ? pageRecord.statusCode : undefined;
      if (pageUrl) {
        pageUrls.add(pageUrl);
        if (typeof pageStatusCode === "number") {
          pageStatusCodes.set(pageUrl, pageStatusCode);
        }
      }
      
      if (issues.length >= maxIssues) break;
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
      if (!validateAssetSchema(asset, addIssue, { strict })) {
        continue;
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
      { name: "content", statKey: "contentChecked", reader: atlas.readers.content, schema: ContentDatasetRecordV1Schema },
      { name: "structured_data", statKey: "structuredDataChecked", reader: atlas.readers.structuredData, schema: StructuredDataDatasetRecordV1Schema },
      { name: "technology", statKey: "technologyChecked", reader: atlas.readers.technology, schema: TechnologyDatasetRecordV1Schema },
      { name: "render_state", statKey: "renderStateChecked", reader: atlas.readers.renderState, schema: RenderStateDatasetRecordV1Schema },
      { name: "performance", statKey: "performanceChecked", reader: atlas.readers.performance, schema: PerformanceDatasetRecordV1Schema },
      { name: "security", statKey: "securityChecked", reader: atlas.readers.security, schema: SecurityDatasetRecordV1Schema },
      { name: "responses", statKey: "responsesChecked", reader: atlas.readers.responses, schema: ResponseRecordV1ZodSchema },
      { name: "resources", statKey: "resourcesChecked", reader: atlas.readers.resources, schema: ResourceRecordV1Schema },
      { name: "sitemaps", statKey: "sitemapsChecked", reader: () => atlas.readers.dataset("sitemaps"), schema: SitemapDatasetRecordV1Schema },
      { name: "events", statKey: "eventsChecked", reader: atlas.readers.events, schema: EventRecordV1Schema },
      { name: "accessibility", statKey: "accessibilityChecked", reader: atlas.readers.accessibility, schema: AccessibilityDatasetRecordV1Schema },
      { name: "pipeline_failures", statKey: "pipelineFailuresChecked", reader: atlas.readers.pipelineFailures, schema: PipelineFailureRecordV1Schema },
      { name: "pipeline_alerts", statKey: "pipelineAlertsChecked", reader: atlas.readers.pipelineAlerts, schema: PipelineAlertRecordV1Schema },
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
          }
          if (issues.length >= maxIssues) break;
        }
      } catch {
        // Dataset not present or unreadable — not an error for optional datasets
      }
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
    if (message.includes("missing required manifest.formatVersion")) {
      addIssue({
        severity: "error",
        code: "MANIFEST_MISSING_FORMAT_VERSION",
        message: "Manifest missing required formatVersion field",
        details: { error: message },
      });
    } else if (message.includes("invalid formatVersion")) {
      addIssue({
        severity: "error",
        code: "MANIFEST_INVALID_FORMAT_VERSION",
        message,
        details: { error: message },
      });
    } else if (message.includes("Unsupported Atlas archive formatVersion")) {
      addIssue({
        severity: "error",
        code: "MANIFEST_UNSUPPORTED_FORMAT_VERSION",
        message,
        details: { error: message },
      });
    } else {
      addIssue({
        severity: "error",
        code: "VALIDATION_FATAL",
        message: `Fatal validation error: ${message}`,
        details: { error: String(error) },
      });
    }
  }
  
  return {
    valid: stats.errorsFound === 0,
    issues,
    stats,
    truncated,
  };
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
    // Check format version compatibility
    const [major] = String(formatVersion).split('.').map(Number);
    if (major > 1) {
      addIssue({
        severity: "error",
        code: "MANIFEST_UNSUPPORTED_FORMAT_VERSION",
        message: `Unsupported format version: ${formatVersion} (SDK supports 1.x.x only)`,
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

    const crawlId = manifestAny.crawl_id ?? manifestAny.crawl?.crawlId;
    const renderMode = manifestAny.mode ?? manifestAny.crawl?.renderMode;
    requireField(manifestAny.owner?.name, "owner.name", "Manifest missing required owner.name field");
    requireField(manifestAny.hashing?.algorithm, "hashing.algorithm", "Manifest missing required hashing.algorithm field");
    requireField(crawlId, "crawl_id", "Manifest missing required crawl_id field");
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
      const totalErrors = coverage.total_errors ?? coverage.totalErrors ?? coverage.pages_with_errors;
      requireFiniteNumber(totalPages, "coverage.total_pages", "Manifest missing required coverage.total_pages field");
      requireFiniteNumber(totalEdges, "coverage.total_edges", "Manifest missing required coverage.total_edges field");
      requireFiniteNumber(totalAssets, "coverage.total_assets", "Manifest missing required coverage.total_assets field");
      requireFiniteNumber(totalErrors, "coverage.total_errors", "Manifest missing required coverage.total_errors/pages_with_errors field");
    }
  }
}

/**
 * Validate page record schema
 */
function validatePageSchema(
  page: Record<string, any>,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { strict?: boolean } = {}
): boolean {
  const { strict = false } = options;
  let valid = true;
  const datasetName = "page_metadata";
  const isCanonicalPageMetadata = typeof page.core === "object" && page.core !== null;
  
  if (!page.url) {
    addIssue({
      severity: "error",
      code: "PAGE_MISSING_URL",
      message: "Page record missing url field",
      dataset: datasetName,
      record: page,
    });
    valid = false;
  }

  if (!isCanonicalPageMetadata) {
    if (!page.finalUrl) {
      addIssue({
        severity: "error",
        code: "PAGE_MISSING_FINAL_URL",
        message: `Page missing finalUrl: ${page.url}`,
        dataset: datasetName,
        record: page,
      });
      valid = false;
    }

    if (typeof page.statusCode !== "number") {
      addIssue({
        severity: "error",
        code: "PAGE_MISSING_STATUS_CODE",
        message: `Page missing statusCode: ${page.url}`,
        dataset: datasetName,
        record: page,
      });
      valid = false;
    }

    if (typeof page.depth !== "number" || page.depth < 0) {
      addIssue({
        severity: "error",
        code: "PAGE_INVALID_DEPTH",
        message: `Page has invalid depth: ${page.url} (depth: ${page.depth})`,
        dataset: datasetName,
        record: page,
        details: { depth: page.depth },
      });
      valid = false;
    }
  }
  
  if (!page.fetchedAt) {
    addIssue({
      severity: "warning",
      code: "PAGE_MISSING_TIMESTAMP",
      message: `Page missing fetchedAt timestamp: ${page.url}`,
      dataset: datasetName,
      record: page,
    });
  }

  if (strict) {
    validateStrictTopLevelNulls(page as unknown as Record<string, unknown>, datasetName, addIssue);
    validateCanonicalBlobRef(page as unknown as Record<string, unknown>, datasetName, "body_blob_ref", addIssue);
  }
  
  return valid;
}

/**
 * Validate asset record schema
 */
function validateAssetSchema(
  asset: AssetRecord,
  addIssue: (issue: ValidationIssue) => boolean,
  options: { strict?: boolean } = {}
): boolean {
  const { strict = false } = options;
  let valid = true;
  
  if (!asset.assetUrl) {
    addIssue({
      severity: "error",
      code: "ASSET_MISSING_URL",
      message: "Asset record missing assetUrl field",
      dataset: "assets",
      record: asset,
    });
    valid = false;
  }
  
  if (!asset.pageUrl) {
    addIssue({
      severity: "error",
      code: "ASSET_MISSING_PAGE_URL",
      message: `Asset missing pageUrl: ${asset.assetUrl}`,
      dataset: "assets",
      record: asset,
    });
    valid = false;
  }
  
  if (!asset.type || !["image", "video"].includes(asset.type)) {
    addIssue({
      severity: "warning",
      code: "ASSET_INVALID_TYPE",
      message: `Asset has invalid type: ${asset.assetUrl} (type: ${asset.type})`,
      dataset: "assets",
      record: asset,
      details: { type: asset.type },
    });
  }

  if (strict) {
    validateStrictTopLevelNulls(asset as unknown as Record<string, unknown>, "assets", addIssue, new Set(["visible", "inViewport"]));
    validateCanonicalBlobRef(asset as unknown as Record<string, unknown>, "assets", "body_blob_ref", addIssue);
  }
  
  return valid;
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
    if (!validateCanonicalBlobRef(response as Record<string, unknown>, "responses", "body_blob_ref", addIssue, true)) {
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
  if (!CANONICAL_BLOB_REF_RE.test(value)) {
    addIssue({
      severity: "error",
      code: "STRICT_BLOB_REF_NON_CANONICAL",
      message: `Strict mode: blob ref "${fieldName}" must use canonical format sha256/aa/bb/<64hex>`,
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
