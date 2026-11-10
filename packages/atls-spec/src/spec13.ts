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
 * Spec 1.3 constants that more than one schema shares.
 *
 * `skipReason` on `frontier_ledger` stays an open string. The robots values
 * below are the spellings a 1.3 writer uses. They are not added to a closed
 * enum, so a 1.2 reader that accepts any string still accepts them.
 */

export const FRONTIER_SKIP_SOURCES = ["page", "scout", "sitemap", "warmup"] as const;
export type FrontierSkipSource = (typeof FRONTIER_SKIP_SOURCES)[number];

export const ROBOTS_SKIP_REASONS = ["ROBOTS_DISALLOWED", "ROBOTS_UNREACHABLE"] as const;
export type RobotsSkipReason = (typeof ROBOTS_SKIP_REASONS)[number];

export const END_REASONS = [
  "complete",
  "pageCap",
  "timeBudget",
  "circuitOpen",
  "schemaBudget",
  "manualStop",
  "aborted",
] as const;
export type EndReason = (typeof END_REASONS)[number];

export const COMPLETION_REASONS = [
  "finished",
  "capped",
  "error_budget",
  "schema_budget_exhausted",
  "manual",
] as const;
export type CompletionReason = (typeof COMPLETION_REASONS)[number];

/**
 * Normative map from `summary.crawlContext.endReason` to the existing
 * `completionReason`. Applied only when both fields are present.
 */
export const END_REASON_TO_COMPLETION_REASON: Record<EndReason, CompletionReason> = {
  complete: "finished",
  pageCap: "capped",
  timeBudget: "capped",
  circuitOpen: "error_budget",
  schemaBudget: "schema_budget_exhausted",
  manualStop: "manual",
  aborted: "manual",
};

export function completionReasonForEndReason(endReason: string): CompletionReason | null {
  if (!Object.prototype.hasOwnProperty.call(END_REASON_TO_COMPLETION_REASON, endReason)) {
    return null;
  }
  return END_REASON_TO_COMPLETION_REASON[endReason as EndReason];
}
