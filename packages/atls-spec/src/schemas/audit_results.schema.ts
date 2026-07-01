/**
 * Copyright © 2025 Cai Frazier.
 * 
 * Audit Results Schema - Atlas v1.0
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
