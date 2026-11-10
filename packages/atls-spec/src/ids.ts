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

import { createHash } from "node:crypto";
import { sha256Hex } from "./integrity.js";
import { normalizeUrl } from "./urlIdentity.js";

/**
 * RFC 4122 URL namespace, `6ba7b811-9dad-11d1-80b4-00c04fd430c8`.
 * Used for UUID v5 asset ids.
 */
export const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function uuidBytes(namespace: string): Buffer {
  const hex = namespace.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error(`UUID namespace is not 16 bytes: ${namespace}`);
  }
  return Buffer.from(hex, "hex");
}

/**
 * RFC 4122 UUID version 5 (SHA-1), lowercase hex with hyphens.
 * `name` is hashed as UTF-8. The default namespace is {@link URL_NAMESPACE}.
 */
export function uuidV5(name: string, namespace: string = URL_NAMESPACE): string {
  const hash = createHash("sha1").update(uuidBytes(namespace)).update(name, "utf8").digest();
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Asset id for spec 1.2: UUID v5 in the URL namespace of the identity-normalized
 * asset URL. Returns null when the URL is not eligible for `normalizeUrl`.
 *
 * Spec 1.1 hashed the raw URL string with the same namespace and did not
 * normalize it first. `https://example.com/a.png` and `https://example.com/a.png/`
 * were different asset ids. From 1.2 they are the same id.
 */
export function assetId(assetUrl: string): string | null {
  const normalized = normalizeUrl(assetUrl);
  if (normalized === null) {
    return null;
  }
  return uuidV5(normalized);
}

function compareCodeUnit(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * `manifest.datasetId`: the first 16 hex characters of SHA-256 of
 * `JSON.stringify` of `{ crawlId, crawlStartedAt, origin, seeds }`.
 *
 * Key order is that order. `seeds` are sorted by UTF-16 code unit and are not
 * passed through `normalizeUrl`. The digest identifies the raw seed list plus
 * the crawl id and start time. Readers do not recompute it as a validity check.
 */
export function datasetId(input: {
  crawlId: string;
  crawlStartedAt: string;
  origin: string;
  seeds: readonly string[];
}): string {
  const payload = {
    crawlId: input.crawlId,
    crawlStartedAt: input.crawlStartedAt,
    origin: input.origin,
    seeds: [...input.seeds].sort(compareCodeUnit),
  };
  return sha256Hex(JSON.stringify(payload)).slice(0, 16);
}

/**
 * `manifest.crawlConfigHash`: SHA-256 of `JSON.stringify` of an object whose
 * keys, in this order, are `seeds`, `renderMode`, `replayTier`, `robotsRespect`,
 * and `privacyConfig`. Seeds are sorted by UTF-16 code unit and are not
 * normalized. `privacyConfig` keeps the key order of the object the caller
 * passes. This digest is not part of `contentSha256`.
 */
export function crawlConfigHash(input: {
  seeds: readonly string[];
  renderMode: string;
  replayTier: string;
  robotsRespect: boolean;
  privacyConfig: Record<string, unknown>;
}): string {
  const payload = {
    seeds: [...input.seeds].sort(compareCodeUnit),
    renderMode: input.renderMode,
    replayTier: input.replayTier,
    robotsRespect: input.robotsRespect,
    privacyConfig: input.privacyConfig,
  };
  return sha256Hex(JSON.stringify(payload));
}
