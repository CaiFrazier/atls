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
 * @caifrazier/atls-spec - Atlas Archive Specification
 * 
 * Core types, schemas, and validators for Atlas (.atls) archives.
 * Used by both the Cartographer engine and Atlas SDK.
 */

// Export all types
export * from './types.js';
// Export split record type entrypoints
export * from './types/records/index.js';
// Export normalization utilities
export * from './normalize.js';
// Export page metadata mapping (nested ↔ flat adapter)
export * from './pageMetadataMapping.js';

// Export Zod schemas and types
export * from './schemas/index.js';
