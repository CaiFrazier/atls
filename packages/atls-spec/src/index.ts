/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

/**
 * @atls/spec - Atlas Archive Specification
 * 
 * Core types, schemas, and validators for Atlas v1.0 archives.
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
