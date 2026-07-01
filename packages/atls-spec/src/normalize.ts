/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

import type { AssetRecord, ConsoleRecord, ComputedTextNodeRecord, PageRecord } from './types.js';

export interface LegacyPageRecord
  extends Omit<
    PageRecord,
    | "page_id"
    | "previous_page_id"
    | "content_changed"
    | "dom_changed"
    | "response_headers"
    | "cdn_indicators"
    | "compression_details"
  > {
  page_id?: string;
  pageId?: string;
  previous_page_id?: string;
  previousPageId?: string;
  content_changed?: boolean;
  contentChanged?: boolean;
  dom_changed?: boolean;
  domChanged?: boolean;
  response_headers?: PageRecord["response_headers"];
  responseHeaders?: PageRecord["response_headers"];
  cdn_indicators?: PageRecord["cdn_indicators"];
  cdnIndicators?: PageRecord["cdn_indicators"];
  compression_details?: PageRecord["compression_details"];
  compressionDetails?: PageRecord["compression_details"];
}

export interface LegacyAssetRecord extends Omit<AssetRecord, "page_id" | "asset_id" | "pageId" | "assetId"> {
  page_id?: string;
  asset_id?: string;
  pageId?: string;
  assetId?: string;
}

export interface LegacyConsoleRecord extends Omit<ConsoleRecord, "page_id" | "pageId"> {
  page_id?: string;
  pageId?: string;
}

export interface LegacyComputedTextNodeRecord extends Omit<ComputedTextNodeRecord, "page_id" | "style_id" | "pageId" | "styleId"> {
  page_id?: string;
  pageId?: string;
  style_id?: string;
  styleId?: string;
}

export function normalizeAssetRecord(record: LegacyAssetRecord): AssetRecord {
  const pageId = record.page_id ?? record.pageId;
  const assetId = record.asset_id ?? record.assetId;
  if (!pageId || !assetId) {
    throw new Error("normalizeAssetRecord: pageId and assetId are required");
  }
  // RC2 cutover: canonical keys are camelCase. Strip BOTH legacy snake spellings from
  // the spread so they can't linger as forbidden keys; emit the camelCase ids.
  const { page_id, asset_id, ...rest } = record as LegacyAssetRecord;
  void page_id; void asset_id;
  // TS can't verify completeness from the loose legacy shape, so assert the result.
  return { ...rest, pageId, assetId } as AssetRecord;
}

export function normalizePageRecord(record: LegacyPageRecord): PageRecord {
  return {
    ...record,
    page_id: record.page_id ?? record.pageId,
    previous_page_id: record.previous_page_id ?? record.previousPageId,
    content_changed: record.content_changed ?? record.contentChanged,
    dom_changed: record.dom_changed ?? record.domChanged,
    response_headers: record.response_headers ?? record.responseHeaders,
    cdn_indicators: record.cdn_indicators ?? record.cdnIndicators,
    compression_details: record.compression_details ?? record.compressionDetails,
  };
}

export function normalizeConsoleRecord(record: LegacyConsoleRecord): ConsoleRecord {
  const page_id = record.page_id ?? record.pageId;
  if (!page_id) {
    throw new Error("normalizeConsoleRecord: page_id is required");
  }
  const { pageId, ...rest } = record as LegacyConsoleRecord;
  return { ...rest, page_id };
}

export function normalizeComputedTextNodeRecord(record: LegacyComputedTextNodeRecord): ComputedTextNodeRecord {
  const page_id = record.page_id ?? record.pageId;
  const style_id = record.style_id ?? record.styleId;
  if (!page_id || !style_id) {
    throw new Error("normalizeComputedTextNodeRecord: page_id and style_id are required");
  }
  const { pageId, styleId, ...rest } = record as LegacyComputedTextNodeRecord;
  return { ...rest, page_id, style_id };
}
