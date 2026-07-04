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
 * Render Metadata Schema
 * Captures deterministic render metadata for reproducible audits
 */

import { z } from 'zod';

export const RenderRecordV1Schema = z.object({
  pageId: z.string().uuid(),
  
  // Render configuration
  mode: z.enum(['raw', 'import', 'prerender', 'full']),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  userAgent: z.string(),
  
  // Render timing
  renderStartedAt: z.string().datetime(),
  renderCompletedAt: z.string().datetime(),
  renderDurationMs: z.number().int().nonnegative(),
  
  // Page lifecycle
  domContentLoaded: z.boolean(),
  loadEventFired: z.boolean(),
  networkIdle: z.boolean(),
  
  // Determinism metadata
  scriptsEnabled: z.boolean(),
  stylesEnabled: z.boolean(),
  imagesEnabled: z.boolean(),
  
  // Console messages
  consoleErrors: z.array(z.object({
    type: z.enum(['error', 'warning']),
    message: z.string(),
    location: z.object({
      url: z.string().optional(),
      line: z.number().int().optional(),
      column: z.number().int().optional()
    }).optional()
  })).default([]),
  
  // Network activity
  requestCount: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(),
  
  // Metrics
  firstPaintMs: z.number().int().nonnegative().optional(),
  firstContentfulPaintMs: z.number().int().nonnegative().optional(),
  domInteractiveMs: z.number().int().nonnegative().optional()
});

export type RenderRecordV1 = z.infer<typeof RenderRecordV1Schema>;
