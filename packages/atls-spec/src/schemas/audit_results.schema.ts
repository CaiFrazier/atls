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
 * 
 * Audit Results Schema
 * Placeholder for Horizon accessibility audit results
 * This dataset is written by Horizon, not Cartographer
 */

import { z } from 'zod';

export const AuditResultRecordV1Schema = z.object({
  auditId: z.string().uuid(),
  pageId: z.string().uuid(),

  // Audit metadata
  auditedAt: z.string().datetime(),
  auditorVersion: z.string(), // "horizon-1.0.0"

  // WCAG level
  wcagLevel: z.enum(['A', 'AA', 'AAA']),

  // Violation details
  ruleId: z.string(), // "1.1.1", "1.4.3", etc.
  ruleName: z.string(),
  severity: z.enum(['critical', 'serious', 'moderate', 'minor']),

  // Location
  selector: z.string().optional(),
  xpath: z.string().optional(),
  htmlSnippet: z.string().optional(),

  // Description
  description: z.string(),
  impact: z.string(),
  remediation: z.string().optional(),

  // Context
  nodeCount: z.number().int().positive(), // How many elements affected

  // Related issues
  relatedRuleIds: z.array(z.string()).default([])
});

export type AuditResultRecordV1 = z.infer<typeof AuditResultRecordV1Schema>;
