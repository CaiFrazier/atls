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
 * Atlas Schema Exports
 */

// Shared JSON value schema
export { JsonValueSchema, type JsonValue } from './json-value.schema.js';

// Canonical datasets
export { PageMetadataRecordV1Schema, type PageMetadataRecordV1 } from './page_metadata.schema.js';
export { NavigationRecordV1Schema, type NavigationRecordV1 } from './navigation.schema.js';

// Responses dataset
export { ResponseRecordV1Schema, type ResponseRecordV1 } from './responses.schema.js';

// Resources dataset
export { ResourceRecordV1Schema, type ResourceRecordV1, ResourceTypeEnum } from './resources.schema.js';

// Reconstruction Index dataset
export { ReconstructionIndexRecordV1Schema, type ReconstructionIndexRecordV1 } from './reconstruction_index.schema.js';

// Optional full-mode schemas
export { DOMSnapshotRecordV1Schema, type DOMSnapshotRecordV1 } from './dom_snapshot.schema.js';

// Accessibility Tree dataset
export { 
  AccTreeRecordV1Schema, 
  type AccTreeRecordV1,
  type Landmark,
  type TabOrderEntry,
  LandmarkSchema,
  TabOrderEntrySchema
} from './acc_tree.schema.js';

// Legacy renderer capture schema (still emitted by runtime checks)
export { RenderRecordV1Schema, type RenderRecordV1 } from './render.schema.js';

// Audit Results dataset
export { AuditResultRecordV1Schema, type AuditResultRecordV1 } from './audit_results.schema.js';

// Manifest
export { 
  AtlasManifestV1Schema, 
  type AtlasManifestV1, 
  type DatasetMetadata,
  DatasetMetadataSchema,
  BlobStorageMetadataSchema,
  PrivacyPolicySchema,
  RobotsPolicySchema
} from './manifest.schema.js';

// Summary
export { AtlasSummarySchema, type AtlasSummaryV1 } from './summary.schema.js';

// Capabilities
export { 
  AtlasCapabilitiesV1Schema, 
  type AtlasCapabilitiesV1,
  CompatibilitySchema,
  CapabilitiesSealSchema,
  type CapabilitiesSeal,
  ExtractorManifestEntrySchema,
  type ExtractorManifestEntry,
  SealReconciliationSchema,
} from './capabilities.schema.js';

// Provenance
export { 
  ProvenanceRecordV1Schema, 
  type ProvenanceRecordV1,
  ProducerSchema,
  InputReferenceSchema,
  OutputMetadataSchema
} from './provenance.schema.js';

// Runtime validation (Cartographer/SDK core datasets)
export {
  PageRecordSchema,
  EdgeRecordSchema,
  AssetRecordSchema,
  ErrorRecordSchema,
  ResponseRecordSchema,
  DOMSnapshotRecordSchema
} from './runtime-core.schema.js';
export type { AssetRecordV1 } from './runtime-core.schema.js';

// Cartographer writer-facing dataset schemas
export {
  RecordMetaSchema,
  PageMetadataDatasetRecordV1Schema,
  type PageMetadataDatasetRecordV1,
  NavigationDatasetRecordV1Schema,
  type NavigationDatasetRecordV1,
  ContentDatasetRecordV1Schema,
  type ContentDatasetRecordV1,
  StructuredDataDatasetRecordV1Schema,
  type StructuredDataDatasetRecordV1,
  TechnologyDatasetRecordV1Schema,
  type TechnologyDatasetRecordV1,
  RenderStateDatasetRecordV1Schema,
  type RenderStateDatasetRecordV1,
  SecurityDatasetRecordV1Schema,
  type SecurityDatasetRecordV1,
  PerformanceDatasetRecordV1Schema,
  type PerformanceDatasetRecordV1,
  PipelineFailureRecordV1Schema,
  type PipelineFailureRecordV1,
  PipelineAlertRecordV1Schema,
  type PipelineAlertRecordV1,
  EventRecordV1Schema,
  type EventRecordV1,
  AccessibilityDatasetRecordV1Schema,
  type AccessibilityDatasetRecordV1,
  SitemapDatasetRecordV1Schema,
  type SitemapDatasetRecordV1,
  FrontierLedgerRecordV1Schema,
  type FrontierLedgerRecordV1,
  QuarantineRecordV1Schema,
  type QuarantineRecordV1
} from './cartographer-datasets.schema.js';
