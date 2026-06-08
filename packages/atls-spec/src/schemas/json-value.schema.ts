/**
 * Copyright © 2025 Cai Frazier.
 * Canonical JsonValue type and Zod schema for Atlas archives.
 *
 * This is the single definition used by all dataset, provenance,
 * and runtime-core schemas. `undefined` is intentionally excluded
 * because it is not a valid JSON value.
 */

import { z } from "zod";

export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(JsonValueSchema), z.array(JsonValueSchema)])
);
