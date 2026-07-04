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
 * Generator Output Check (BUG-0232)
 *
 * Regenerates the JSON Schema files and asserts none of them contain a bare
 * empty-object subschema (`{}`, i.e. "accept anything") — the symptom of the
 * generator's `$refStrategy` failing to represent a recursive Zod type.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, describe, test, expect } from 'vitest';
import { schemaMap, generateJSONSchemas } from '../src/schemas/generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '../dist/schemas');

/**
 * Datasets with a known, unrelated source of `{}` — a genuine `z.unknown()`
 * field (not JsonValueSchema recursion), which has no better JSON Schema
 * representation. Tracked as a separate follow-up, not part of BUG-0232.
 */
const KNOWN_UNKNOWN_FIELD_RESIDUALS = new Set(['manifest.v1', 'summary.v1']);

/** Recursively count bare `{}` (empty-object) subschema values in a JSON Schema tree. */
function countEmptyObjectSubschemas(node: unknown): number {
  if (Array.isArray(node)) {
    return node.reduce((sum: number, child) => sum + countEmptyObjectSubschemas(child), 0);
  }
  if (node !== null && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length === 0) {
      return 1;
    }
    return entries.reduce((sum, [key, value]) => {
      // `{ "not": {} }` is a legitimate, unrelated JSON Schema idiom for
      // "matches nothing" (e.g. from z.never()) — not an accept-anything
      // degradation, so don't count the {} nested directly under "not".
      if (key === 'not') {
        return sum;
      }
      return sum + countEmptyObjectSubschemas(value);
    }, 0);
  }
  return 0;
}

beforeAll(async () => {
  await generateJSONSchemas();
});

describe('JSON Schema generator output (BUG-0232)', () => {
  for (const { name } of schemaMap) {
    test(`${name}.schema.json has no accept-anything empty-object subschemas`, () => {
      const content = readFileSync(join(schemasDir, `${name}.schema.json`), 'utf-8');
      const parsed = JSON.parse(content);
      const emptyCount = countEmptyObjectSubschemas(parsed);

      if (KNOWN_UNKNOWN_FIELD_RESIDUALS.has(name)) {
        // Not part of BUG-0232's scope (JsonValueSchema recursion) — these
        // come from genuine z.unknown() fields. Flagged as a follow-up.
        expect(emptyCount).toBeGreaterThan(0);
      } else {
        expect(emptyCount).toBe(0);
      }
    });
  }
});
