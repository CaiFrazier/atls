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

import { describe, expect, test } from 'vitest';
import { ATLAS_DATASET_KEYS } from '../src/index.js';

describe('Atlas dataset registry', () => {
  test('is exported from the package entry point and keys every dataset by its own name', () => {
    for (const [key, name] of Object.entries(ATLAS_DATASET_KEYS)) expect(name).toBe(key);
  });

  test('names datasets in snake_case, once each', () => {
    const names = Object.values(ATLAS_DATASET_KEYS);
    for (const name of names) expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(21);
  });
});
