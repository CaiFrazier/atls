/**
 * Copyright © 2025 Cai Frazier.
 * 
 * Audit Results Schema - Atlas v1.0
 * Placeholder for Horizon accessibility audit results
 * This dataset is written by Horizon, not Cartographer
 */

import { z } from 'zod';

export const AuditResultRecordV1Schema = z.object({
  audit_id: z.string().uuid(),
  page_id: z.string().uuid(),
  
  // Audit metadata
  audited_at: z.string().datetime(),
  auditor_version: z.string(), // "horizon-1.0.0"
  
  // WCAG level
  wcag_level: z.enum(['A', 'AA', 'AAA']),
  
  // Violation details
  rule_id: z.string(), // "1.1.1", "1.4.3", etc.
  rule_name: z.string(),
  severity: z.enum(['critical', 'serious', 'moderate', 'minor']),
  
  // Location
  selector: z.string().optional(),
  xpath: z.string().optional(),
  html_snippet: z.string().optional(),
  
  // Description
  description: z.string(),
  impact: z.string(),
  remediation: z.string().optional(),
  
  // Context
  node_count: z.number().int().positive(), // How many elements affected
  
  // Related issues
  related_rule_ids: z.array(z.string()).default([])
});

export type AuditResultRecordV1 = z.infer<typeof AuditResultRecordV1Schema>;
