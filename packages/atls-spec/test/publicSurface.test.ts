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
 * Public API surface guard.
 *
 * EngineConfig/CrawlConfig (the crawl engine's internal tuning surface —
 * concurrency, retries, proxy rotation, etc.) were removed from this public
 * package because they are not part of the Atlas archive format and had no
 * internal usage here. This guards against them silently coming back.
 *
 * Note: TypeScript interfaces/type aliases are erased at runtime, so a
 * `'EngineConfig' in someModuleObject` check would trivially pass regardless
 * of whether the type is declared — this test instead greps the source text
 * directly, which is the only reliable way to assert a *type-level* export
 * doesn't exist without adding a separate type-check pass over test files
 * (this package's tsconfig only includes `src/**`, not `test/**`).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typesSource = readFileSync(join(__dirname, '../src/types.ts'), 'utf-8');

describe('Public API surface (BUG-0234)', () => {
  test('EngineConfig is not declared in types.ts', () => {
    expect(typesSource).not.toMatch(/\bexport\s+interface\s+EngineConfig\b/);
  });

  test('CrawlConfig is not declared in types.ts', () => {
    expect(typesSource).not.toMatch(/\bexport\s+type\s+CrawlConfig\b/);
  });
});
