/**
 * Copyright © 2025 Cai Frazier.
 * Atlas v1.0 navigation Dataset Schema
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

