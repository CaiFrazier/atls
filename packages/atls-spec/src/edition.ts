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
 * Documented current `manifest.schemaVersion` tag.
 *
 * The prose spec, the versioning chapter, and the drift guard all read this
 * constant. `AtlasManifestV1Schema` still accepts any string in `schemaVersion`:
 * an older tag remains valid. Do not use this value to reject archives.
 */
export const ATLAS_SCHEMA_VERSION = "2026-09-04" as const;

/**
 * Specification contract version documented by this edition (`manifest.specVersion`).
 * Archives stamped 1.1.0 and 1.2.0 stay valid. A writer stamps 1.3.0 only when
 * the archive emits a spec 1.3 field. See docs/versioning.md.
 */
export const ATLAS_SPEC_VERSION = "1.3.0" as const;

/**
 * Container version a spec 1.3 writer stamps in `manifest.formatVersion`.
 * Readers accept every `1.x` container. A writer stamps 1.3.0 only when the
 * archive emits a spec 1.3 field.
 */
export const ATLAS_FORMAT_VERSION = "1.3.0" as const;

/**
 * Public Atlas line a spec 1.3 writer stamps in `manifest.atlasVersion`.
 * `"1.1"` and `"1.2"` remain valid. A writer stamps `"1.3"` only when the
 * archive emits a spec 1.3 field.
 */
export const ATLAS_VERSION = "1.3" as const;
