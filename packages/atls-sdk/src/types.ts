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
 * Atlas type definitions for the SDK
 * 
 * Re-exports types from @caifrazier/atls-spec for use in the SDK.
 */

// Import types for use in union and re-export
import type {
  AtlasManifest,
  AtlasSummary,
  AtlasManifestV1,
  AtlasSummaryV1,
  AtlasPack,
  AtlasPackName,
  AtlasPackState,
  ResponseRecordV1,
  AssetRecord,
  EventRecord, // Phase 7: Event log
  AccessibilityRecord,
  ResourceRecordV1,
} from '@caifrazier/atls-spec';

// Re-export for convenience
export type {
  AtlasManifest,
  AtlasSummary,
  AtlasManifestV1,
  AtlasSummaryV1,
  AtlasPack,
  AtlasPackName,
  AtlasPackState,
  ResponseRecordV1,
  AssetRecord,
  EventRecord, // Phase 7: Event log
  AccessibilityRecord,
  ResourceRecordV1,
};

/**
 * Canonical dataset names
 */
export type CanonicalDatasetName =
  | "navigation"
  | "page_metadata"
  | "content"
  | "structured_data"
  | "technology"
  | "render_state"
  | "security"
  | "pipeline_failures"
  | "pipeline_alerts"
  | "assets"
  | "responses"
  | "events"
  | "accessibility"
  | "performance"
  | "resources";

/**
 * Legacy dataset aliases kept for backward compatibility.
 */
export type LegacyDatasetName =
  /** @deprecated Use "page_metadata" */
  | "pages"
  /** @deprecated Use "navigation" */
  | "edges"
  /** @deprecated Use "pipeline_failures" */
  | "errors"
  /** @deprecated Use "pipeline_failures" */
  | "failed_pages";

/**
 * Dataset names accepted by the SDK.
 */
export type DatasetName =
  | CanonicalDatasetName
  | LegacyDatasetName
  | (string & {});

/**
 * Union of all record types
 */
export type AnyRecord =
  | AssetRecord
  | EventRecord
  | AccessibilityRecord
  | ResponseRecordV1
  | ResourceRecordV1
  | Record<string, unknown>;

export interface PackView {
  all: AtlasPack[];
  embedded: AtlasPack[];
  sidecar: AtlasPack[];
  missing: AtlasPack[];
  get(name: AtlasPackName): AtlasPack | undefined;
  has(name: AtlasPackName): boolean;
  hasEmbedded(name: AtlasPackName): boolean;
  sidecarUri(name: AtlasPackName): string | undefined;
  state(name: AtlasPackName): AtlasPackState | undefined;
}
