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
 * Atlas Summary Schema
 */

import { z } from 'zod';

const RenderModeEnum = z.enum(['raw', 'import', 'prerender', 'full']);
const ParamPolicyEnum = z.enum(['sample', 'strip', 'keep']);

const StatusCodeKeySchema = z.string().regex(/^\d+$/);

export const AtlasSummarySchema = z.object({
  identity: z.object({
    seedUrls: z.array(z.string().url()),
    primaryOrigin: z.string().url(),
    domain: z.string(),
    publicSuffix: z.string(),
  }),
  crawlContext: z.object({
    specLevel: z.number().int().nonnegative(),
    completionReason: z.enum(['finished', 'capped', 'error_budget', 'schema_budget_exhausted', 'manual']),
    frontierEmptyAtStop: z.boolean().optional(),
    stopConditionsTriggered: z.array(z.string()).optional(),
    completionInputs: z.object({
      errorBudgetExceeded: z.boolean(),
      budgetStopReason: z.string().optional(),
      gracefulShutdown: z.boolean(),
      maxPages: z.number().int(),
      pageCount: z.number().int().nonnegative(),
      queueHasPending: z.boolean(),
      enqueuedCount: z.number().int().nonnegative(),
      visitedCount: z.number().int().nonnegative(),
    }).optional(),
    config: z.object({
      maxPages: z.number().int().optional(),
      maxDepth: z.number().int().optional(),
      robotsRespect: z.boolean(),
      followExternal: z.boolean(),
      concurrency: z.number().int().optional(),
      rps: z.number().optional(),
      userAgent: z.string().optional(),
      paramPolicy: ParamPolicyEnum.optional(),
      blockList: z.array(z.string()).optional(),
      allowUrls: z.array(z.string()).optional(),
      denyUrls: z.array(z.string()).optional(),
    }),
    captureLimits: z.object({
      maxBytesPerPage: z.number().nonnegative().optional(),
      maxRequestsPerPage: z.number().int().nonnegative().optional(),
      maxAssetsPerPage: z.number().int().nonnegative().optional(),
      maxStructuredDataItems: z.number().int().nonnegative().optional(),
      renderTimeoutMs: z.number().nonnegative().optional(),
      networkIdleMs: z.number().nonnegative().optional(),
    }).optional(),
  }),
  stats: z.object({
    totalPages: z.number().int().nonnegative(),
    totalEdges: z.number().int().nonnegative(),
    totalAssets: z.number().int().nonnegative(),
    totalResponses: z.number().int().nonnegative().optional(),
    totalErrors: z.number().int().nonnegative(),
    totalAlerts: z.number().int().nonnegative().optional(),
    totalEvents: z.number().int().nonnegative().optional(),
    totalAccessibilityRecords: z.number().int().nonnegative().optional(),
    totalAxeAuditRecords: z.number().int().nonnegative().optional(),
    totalConsoleRecords: z.number().int().nonnegative().optional(),
    totalStyleRecords: z.number().int().nonnegative().optional(),
    totalStyleDefinitionRecords: z.number().int().nonnegative().optional(),
    totalPerfRecords: z.number().int().nonnegative().optional(),
    totalVectorPerformanceRecords: z.number().int().nonnegative().optional(),
    totalPerformanceDatasetRecords: z.number().int().nonnegative().optional(),
    totalNavigationRecords: z.number().int().nonnegative().optional(),
    totalSecurityRecords: z.number().int().nonnegative().optional(),
    totalDOMSnapshots: z.number().int().nonnegative().optional(),
    totalResourceRecords: z.number().int().nonnegative().optional(),
    totalContentRecords: z.number().int().nonnegative().optional(),
    totalStructuredDataRecords: z.number().int().nonnegative().optional(),
    totalTechnologyRecords: z.number().int().nonnegative().optional(),
    totalRenderRecords: z.number().int().nonnegative().optional(),
    totalAccTreeRecords: z.number().int().nonnegative().optional(),
    totalSitemapRecords: z.number().int().nonnegative().optional(),
    totalSitemapUrlRecords: z.number().int().nonnegative().optional(),
    totalExtractionRecords: z.number().int().nonnegative().optional(),
    totalQuarantineRecords: z.number().int().nonnegative().optional(),
    totalRobotsRecords: z.number().int().nonnegative().optional(),
    statusCodes: z.record(StatusCodeKeySchema, z.number().int().nonnegative()),
    renderModes: z.record(RenderModeEnum, z.number().int().nonnegative()),
    paramPolicy: ParamPolicyEnum.optional(),
  }),
  performance: z.object({
    avgRenderMs: z.number().nonnegative().optional(),
    maxDepthReached: z.number().int().nonnegative(),
  }),
  configSnapshot: z
    .object({
      requested: z.record(z.string(), z.unknown()).optional(),
      effective: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  timestamps: z.object({
    crawlStartedAt: z.string().datetime(),
    crawlCompletedAt: z.string().datetime(),
    crawlDurationMs: z.number().int().nonnegative(),
  }),
});

export type AtlasSummaryV1 = z.infer<typeof AtlasSummarySchema>;
