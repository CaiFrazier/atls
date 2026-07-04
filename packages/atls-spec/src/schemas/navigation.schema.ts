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
 * Atlas navigation Dataset Schema
 *
 * The canonical navigation record is a per-page envelope containing an array
 * of outbound edges plus redirect/hreflang/pagination metadata.
 * Flat edge records are represented by EdgeRecordSchema in runtime-core.
 */

import { z } from 'zod';
import { NavigationDatasetRecordV1Schema } from './cartographer-datasets.schema.js';

/**
 * @deprecated Import {@link NavigationDatasetRecordV1Schema} from
 * `cartographer-datasets.schema` directly. This re-export exists only for
 * backward compatibility.
 */
export const NavigationRecordV1Schema = NavigationDatasetRecordV1Schema;

export type NavigationRecordV1 = z.infer<typeof NavigationRecordV1Schema>;
