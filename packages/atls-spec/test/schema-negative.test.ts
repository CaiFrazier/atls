/**
 * Copyright © 2025 Cai Frazier.
 * Negative Schema Validation Tests
 *
 * Verifies that Zod schemas REJECT invalid data for every core dataset record type.
 * Previously 8 core schemas had zero validation tests — a schema regression (e.g.,
 * accidentally making a required field optional) would go undetected.
 *
 * Each schema is tested for: (a) missing required field, (b) wrong type, (c) invalid enum.
 */

import { describe, test, expect } from "vitest";
import {
  // V1 Schemas
  ResponseRecordV1Schema,
  ResourceRecordV1Schema,
  DOMSnapshotRecordV1Schema,
  NavigationRecordV1Schema,
  RenderRecordV1Schema,
  AuditResultRecordV1Schema,
  ProvenanceRecordV1Schema,
  // Runtime-core Schemas
  EdgeRecordSchema,
  AssetRecordSchema,
  ErrorRecordSchema,
} from "../src/schemas/index.js";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const uuid = "550e8400-e29b-41d4-a716-446655440000";
const now = new Date().toISOString();

// ──────────────────────────────────────────────────────────────
// EdgeRecordSchema
// ──────────────────────────────────────────────────────────────
describe("EdgeRecordSchema — negative tests", () => {
  const validEdge = {
    sourceUrl: "https://example.com/",
    targetUrl: "https://example.com/about",
    anchorText: "About",
    nofollow: false,
    isExternal: false,
    location: "nav",
    discoveredInMode: "prerender",
  };

  test("rejects missing required field (sourceUrl)", () => {
    const { sourceUrl, ...missing } = validEdge;
    expect(EdgeRecordSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (targetUrl)", () => {
    const { targetUrl, ...missing } = validEdge;
    expect(EdgeRecordSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (nofollow as string)", () => {
    expect(EdgeRecordSchema.safeParse({ ...validEdge, nofollow: "yes" }).success).toBe(false);
  });

  test("rejects invalid location enum", () => {
    expect(EdgeRecordSchema.safeParse({ ...validEdge, location: "basement" }).success).toBe(false);
  });

  test("rejects invalid discoveredInMode enum", () => {
    expect(EdgeRecordSchema.safeParse({ ...validEdge, discoveredInMode: "turbo" }).success).toBe(false);
  });

  test("rejects invalid URL format for sourceUrl", () => {
    expect(EdgeRecordSchema.safeParse({ ...validEdge, sourceUrl: "not-a-url" }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// AssetRecordSchema
// ──────────────────────────────────────────────────────────────
describe("AssetRecordSchema — negative tests", () => {
  const validAsset = {
    page_id: "550e8400-e29b-41d4-a716-446655440000",
    asset_id: "asset-001",
    pageUrl: "https://example.com/",
    assetUrl: "https://example.com/img.jpg",
    type: "image",
    hasAlt: true,
    visible: true,
    inViewport: true,
    wasLazyLoaded: false,
  };

  test("rejects missing required field (page_id)", () => {
    const { page_id, ...missing } = validAsset;
    expect(AssetRecordSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (assetUrl)", () => {
    const { assetUrl, ...missing } = validAsset;
    expect(AssetRecordSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (hasAlt as string)", () => {
    expect(AssetRecordSchema.safeParse({ ...validAsset, hasAlt: "true" }).success).toBe(false);
  });

  test("rejects invalid type enum", () => {
    expect(AssetRecordSchema.safeParse({ ...validAsset, type: "spreadsheet" }).success).toBe(false);
  });

  test("rejects invalid URL for assetUrl", () => {
    expect(AssetRecordSchema.safeParse({ ...validAsset, assetUrl: "not-a-url" }).success).toBe(false);
  });

  test("rejects srcset_candidates when not an array", () => {
    expect(
      AssetRecordSchema.safeParse({
        ...validAsset,
        srcset_candidates: "small.jpg 480w, large.jpg 1200w",
      }).success
    ).toBe(false);
  });

  test("rejects tiles with invalid shape", () => {
    expect(
      AssetRecordSchema.safeParse({
        ...validAsset,
        tiles: [{ src: "blobs/a.zst", height: "720", width: 1280, y: 0 }],
      }).success
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// ErrorRecordSchema
// ──────────────────────────────────────────────────────────────
describe("ErrorRecordSchema — negative tests", () => {
  const validError = {
    url: "https://example.com/broken",
    origin: "https://example.com",
    hostname: "example.com",
    occurredAt: now,
    phase: "fetch",
    message: "ECONNREFUSED",
  };

  test("rejects missing required field (url)", () => {
    const { url, ...missing } = validError;
    expect(ErrorRecordSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (message)", () => {
    const { message, ...missing } = validError;
    expect(ErrorRecordSchema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (phase as number)", () => {
    expect(ErrorRecordSchema.safeParse({ ...validError, phase: 42 }).success).toBe(false);
  });

  test("rejects invalid phase enum", () => {
    expect(ErrorRecordSchema.safeParse({ ...validError, phase: "deploy" }).success).toBe(false);
  });

  test("rejects empty occurredAt", () => {
    expect(ErrorRecordSchema.safeParse({ ...validError, occurredAt: "" }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// ResponseRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("ResponseRecordV1Schema — negative tests", () => {
  const validResponse = {
    page_id: uuid,
    url: "https://example.com/",
    final_url: "https://example.com/",
    status_code: 200,
    encoding: "utf-8",
    body_blob_ref: "sha256/aa/bb/aabbccdd",
  };

  test("rejects missing required field (page_id)", () => {
    const { page_id, ...missing } = validResponse;
    expect(ResponseRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (encoding)", () => {
    const { encoding, ...missing } = validResponse;
    expect(ResponseRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (body_blob_ref)", () => {
    const { body_blob_ref, ...missing } = validResponse;
    expect(ResponseRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (status_code as string)", () => {
    expect(ResponseRecordV1Schema.safeParse({ ...validResponse, status_code: "200" }).success).toBe(false);
  });

  test("rejects non-UUID page_id", () => {
    expect(ResponseRecordV1Schema.safeParse({ ...validResponse, page_id: "not-a-uuid" }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// ResourceRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("ResourceRecordV1Schema — negative tests", () => {
  const validResource = {
    res_id: uuid,
    owner_page_id: uuid,
    url: "https://example.com/style.css",
    type: "css",
    status: 200,
    content_type: "text/css",
    hash_body_sha256: "a".repeat(64),
    size_bytes: 4096,
    critical: true,
  };

  test("rejects missing required field (res_id)", () => {
    const { res_id, ...missing } = validResource;
    expect(ResourceRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (size_bytes as string)", () => {
    expect(ResourceRecordV1Schema.safeParse({ ...validResource, size_bytes: "big" }).success).toBe(false);
  });

  test("rejects invalid type enum", () => {
    expect(ResourceRecordV1Schema.safeParse({ ...validResource, type: "yaml" }).success).toBe(false);
  });

  test("rejects negative size_bytes", () => {
    expect(ResourceRecordV1Schema.safeParse({ ...validResource, size_bytes: -1 }).success).toBe(false);
  });

  test("rejects invalid SHA-256 hash format", () => {
    expect(ResourceRecordV1Schema.safeParse({ ...validResource, hash_body_sha256: "nothex" }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// NavigationRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("NavigationRecordV1Schema — negative tests", () => {
  const validLink = {
    sourceUrl: "https://example.com/",
    targetUrl: "https://example.com/about",
    anchorText: "About",
    nofollow: false,
    isExternal: false,
    location: "nav",
    discoveredInMode: "prerender",
  };

  test("rejects missing required field (sourceUrl)", () => {
    const { sourceUrl, ...missing } = validLink;
    expect(NavigationRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (discoveredInMode)", () => {
    const { discoveredInMode, ...missing } = validLink;
    expect(NavigationRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (nofollow as string)", () => {
    expect(NavigationRecordV1Schema.safeParse({ ...validLink, nofollow: "yes" }).success).toBe(false);
  });

  test("rejects invalid location enum", () => {
    expect(NavigationRecordV1Schema.safeParse({ ...validLink, location: "underground" }).success).toBe(false);
  });

  test("rejects invalid discoveredInMode enum", () => {
    expect(NavigationRecordV1Schema.safeParse({ ...validLink, discoveredInMode: "turbo" }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// RenderRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("RenderRecordV1Schema — negative tests", () => {
  const validRender = {
    page_id: uuid,
    mode: "prerender",
    viewport: { width: 1280, height: 720 },
    user_agent: "Cartographer/1.0",
    render_started_at: now,
    render_completed_at: now,
    render_duration_ms: 320,
    dom_content_loaded: true,
    load_event_fired: true,
    network_idle: true,
    scripts_enabled: true,
    styles_enabled: true,
    images_enabled: true,
    request_count: 15,
    failed_requests: 0,
  };

  test("rejects missing required field (page_id)", () => {
    const { page_id, ...missing } = validRender;
    expect(RenderRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects invalid mode enum", () => {
    expect(RenderRecordV1Schema.safeParse({ ...validRender, mode: "turbo" }).success).toBe(false);
  });

  test("rejects wrong type (render_duration_ms as string)", () => {
    expect(RenderRecordV1Schema.safeParse({ ...validRender, render_duration_ms: "fast" }).success).toBe(false);
  });

  test("rejects negative request_count", () => {
    expect(RenderRecordV1Schema.safeParse({ ...validRender, request_count: -5 }).success).toBe(false);
  });

  test("rejects viewport with non-positive width", () => {
    expect(RenderRecordV1Schema.safeParse({ ...validRender, viewport: { width: 0, height: 720 } }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// DOMSnapshotRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("DOMSnapshotRecordV1Schema — negative tests", () => {
  const validDOMSnapshot = {
    page_id: uuid,
    base_url: "https://example.com/",
    dom_json_zstd: "base64data==",
    styles_applied: true,
    scripts_executed: true,
    node_count: 150,
    text_nodes: 42,
    element_nodes: 108,
  };

  test("rejects missing required field (page_id)", () => {
    const { page_id, ...missing } = validDOMSnapshot;
    expect(DOMSnapshotRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects missing required field (dom_json_zstd)", () => {
    const { dom_json_zstd, ...missing } = validDOMSnapshot;
    expect(DOMSnapshotRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects wrong type (node_count as string)", () => {
    expect(DOMSnapshotRecordV1Schema.safeParse({ ...validDOMSnapshot, node_count: "many" }).success).toBe(false);
  });

  test("rejects negative node_count", () => {
    expect(DOMSnapshotRecordV1Schema.safeParse({ ...validDOMSnapshot, node_count: -1 }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// AuditResultRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("AuditResultRecordV1Schema — negative tests", () => {
  const validAudit = {
    audit_id: uuid,
    page_id: uuid,
    audited_at: now,
    auditor_version: "1.0.0",
    wcag_level: "AA",
    rule_id: "color-contrast",
    rule_name: "Color Contrast",
    severity: "serious",
    description: "Elements must have sufficient color contrast",
    impact: "Users with low vision cannot read",
    node_count: 3,
  };

  test("rejects missing required field (audit_id)", () => {
    const { audit_id, ...missing } = validAudit;
    expect(AuditResultRecordV1Schema.safeParse(missing).success).toBe(false);
  });

  test("rejects invalid wcag_level enum", () => {
    expect(AuditResultRecordV1Schema.safeParse({ ...validAudit, wcag_level: "AAAA" }).success).toBe(false);
  });

  test("rejects invalid severity enum", () => {
    expect(AuditResultRecordV1Schema.safeParse({ ...validAudit, severity: "catastrophic" }).success).toBe(false);
  });

  test("rejects wrong type (node_count as string)", () => {
    expect(AuditResultRecordV1Schema.safeParse({ ...validAudit, node_count: "three" }).success).toBe(false);
  });

  test("rejects node_count of 0 (must be positive)", () => {
    expect(AuditResultRecordV1Schema.safeParse({ ...validAudit, node_count: 0 }).success).toBe(false);
  });
});


// ──────────────────────────────────────────────────────────────
// ProvenanceRecordV1Schema
// ──────────────────────────────────────────────────────────────
describe("ProvenanceRecordV1Schema — negative tests", () => {
  const validProvenance = {
    dataset_name: "page_metadata.v1",
    producer: {
      app: "cartographer",
      version: "1.0.0",
      module: "extractor-page-metadata",
    },
    created_at: now,
    inputs: [],
    parameters: {
      mode: "full",
      retries: 2,
      enabled: true,
      nested: { key: "value" },
    },
    output: {
      record_count: 100,
      hash_sha256: "a".repeat(64),
    },
  };

  test("rejects parameters with non-JSON values", () => {
    expect(
      ProvenanceRecordV1Schema.safeParse({
        ...validProvenance,
        parameters: { transform: () => "bad" },
      }).success
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// Empty object should fail all schemas
// ──────────────────────────────────────────────────────────────
describe("All schemas reject empty objects", () => {
  const schemas = [
    { name: "EdgeRecordSchema", schema: EdgeRecordSchema },
    { name: "AssetRecordSchema", schema: AssetRecordSchema },
    { name: "ErrorRecordSchema", schema: ErrorRecordSchema },
    { name: "ResponseRecordV1Schema", schema: ResponseRecordV1Schema },
    { name: "ResourceRecordV1Schema", schema: ResourceRecordV1Schema },
    { name: "NavigationRecordV1Schema", schema: NavigationRecordV1Schema },
    { name: "RenderRecordV1Schema", schema: RenderRecordV1Schema },
    { name: "DOMSnapshotRecordV1Schema", schema: DOMSnapshotRecordV1Schema },
    { name: "AuditResultRecordV1Schema", schema: AuditResultRecordV1Schema },
    { name: "ProvenanceRecordV1Schema", schema: ProvenanceRecordV1Schema },
  ];

  for (const { name, schema } of schemas) {
    test(`${name} rejects empty object`, () => {
      expect(schema.safeParse({}).success).toBe(false);
    });
  }
});
