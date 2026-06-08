/**
 * Copyright © 2025 Cai Frazier.
 * 
 * Render Metadata Schema - Atlas v1.0
 * Captures deterministic render metadata for reproducible audits
 */

import { z } from 'zod';

export const RenderRecordV1Schema = z.object({
  page_id: z.string().uuid(),
  
  // Render configuration
  mode: z.enum(['raw', 'import', 'prerender', 'full']),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  user_agent: z.string(),
  
  // Render timing
  render_started_at: z.string().datetime(),
  render_completed_at: z.string().datetime(),
  render_duration_ms: z.number().int().nonnegative(),
  
  // Page lifecycle
  dom_content_loaded: z.boolean(),
  load_event_fired: z.boolean(),
  network_idle: z.boolean(),
  
  // Determinism metadata
  scripts_enabled: z.boolean(),
  styles_enabled: z.boolean(),
  images_enabled: z.boolean(),
  
  // Console messages
  console_errors: z.array(z.object({
    type: z.enum(['error', 'warning']),
    message: z.string(),
    location: z.object({
      url: z.string().optional(),
      line: z.number().int().optional(),
      column: z.number().int().optional()
    }).optional()
  })).default([]),
  
  // Network activity
  request_count: z.number().int().nonnegative(),
  failed_requests: z.number().int().nonnegative(),
  
  // Metrics
  first_paint_ms: z.number().int().nonnegative().optional(),
  first_contentful_paint_ms: z.number().int().nonnegative().optional(),
  dom_interactive_ms: z.number().int().nonnegative().optional()
});

export type RenderRecordV1 = z.infer<typeof RenderRecordV1Schema>;
