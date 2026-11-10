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
import { ATLAS_DATASET_KEYS } from "./datasetKeys.js";

/**
 * SHA-256 of a UTF-8 string or a byte buffer, lowercase hex.
 * The empty string and the empty buffer are the same digest.
 */
export function sha256Hex(input: string | Buffer): string {
  const hash = createHash("sha256");
  if (typeof input === "string") {
    hash.update(input, "utf8");
  } else {
    hash.update(input);
  }
  return hash.digest("hex");
}

/** How part paths are ordered before `contentSha256` concatenation. */
export type ContentPathOrder = "utf8" | "en-US" | "th";

/**
 * Compare two relative paths.
 *
 * `utf8` is unsigned byte order of the UTF-8 encoding. That is the spec 1.2 order.
 * `en-US` and `th` are `String.prototype.localeCompare` with that locale and no
 * options. Spec 1.1 writers used `localeCompare` with no locale argument, so the
 * order followed the process locale. See the storage chapter.
 */
export function comparePaths(a: string, b: string, order: ContentPathOrder = "utf8"): number {
  if (order === "utf8") {
    return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  }
  return a.localeCompare(b, order);
}

/**
 * `integrity.contentSha256`.
 *
 * Sort the relative part paths, concatenate the lowercase hex part checksums
 * with no separator, and SHA-256 the UTF-8 bytes of that string. The path
 * strings themselves are not hashed. An empty map hashes the empty string.
 */
export function contentSha256(
  checksums: Readonly<Record<string, string>>,
  order: ContentPathOrder = "utf8"
): string {
  const keys = Object.keys(checksums).sort((left, right) => comparePaths(left, right, order));
  let joined = "";
  for (const key of keys) {
    joined += checksums[key]!.toLowerCase();
  }
  return sha256Hex(joined);
}

export type IntegrityEdition = "1.1" | "1.2";

/**
 * Digests a reader accepts for `contentSha256`.
 *
 * Spec 1.2 accepts only UTF-8 byte order.
 * Spec 1.1 also accepts `en-US` localeCompare order and `th` localeCompare
 * order. Those are the orders that differ from byte order on paths a writer
 * can actually emit. See the storage chapter.
 */
export function acceptedContentDigests(
  checksums: Readonly<Record<string, string>>,
  edition: IntegrityEdition
): string[] {
  const byteOrder = contentSha256(checksums, "utf8");
  if (edition === "1.2") {
    return [byteOrder];
  }
  return [
    ...new Set([
      byteOrder,
      contentSha256(checksums, "en-US"),
      contentSha256(checksums, "th"),
    ]),
  ];
}

const SHORT_DIRECTORY_ALIASES = ["pages", "edges", "failed_pages"] as const;

const DATASET_DIRECTORIES: ReadonlySet<string> = new Set([
  ...Object.values(ATLAS_DATASET_KEYS),
  ...SHORT_DIRECTORY_ALIASES,
]);

/**
 * A dataset part file is `<directory>/<file>.jsonl` or `<directory>/<file>.jsonl.zst`.
 * `directory` is a long registry name. Readers also recognize the three short
 * aliases, because those archives still exist. Writers must use the long name.
 * The file name has no further slash. `provenance.v1.jsonl.zst` at the archive
 * root is not a dataset part.
 */
export function isDatasetPartPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const slash = normalized.indexOf("/");
  if (slash <= 0) {
    return false;
  }
  const directory = normalized.slice(0, slash);
  const file = normalized.slice(slash + 1);
  if (file.length === 0 || file.includes("/")) {
    return false;
  }
  if (!DATASET_DIRECTORIES.has(directory)) {
    return false;
  }
  return file.endsWith(".jsonl") || file.endsWith(".jsonl.zst");
}

/**
 * Which integrity rules apply.
 *
 * `specVersion` wins, then `formatVersion`, then `atlasVersion`.
 * A 1.x version whose minor is below 2 uses the 1.1 acceptance rule.
 * Minor 2 and later, including spec 1.3, use the byte-order rule. The
 * returned label `"1.2"` names that rule, not the archive's minor version.
 * Anything that does not parse is treated as 1.1 so older archives stay valid.
 */
export function integrityEdition(manifest: {
  specVersion?: unknown;
  formatVersion?: unknown;
  atlasVersion?: unknown;
}): IntegrityEdition {
  const candidates = [manifest.specVersion, manifest.formatVersion, manifest.atlasVersion];
  for (const value of candidates) {
    if (typeof value !== "string") {
      continue;
    }
    const match = value.trim().match(/^v?(\d+)\.(\d+)/);
    if (!match) {
      continue;
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major > 1 || (major === 1 && minor >= 2)) {
      return "1.2";
    }
    return "1.1";
  }
  return "1.1";
}

/**
 * Provenance `output.hashSha256`.
 *
 * Concatenate the uncompressed JSONL SHA-256 hex strings in part-index order
 * (the order the producer appended parts, not path order) and SHA-256 that
 * string. This is not `contentSha256`. An empty list hashes the empty string.
 */
export function provenanceOutputHash(uncompressedPartHashesInIndexOrder: readonly string[]): string {
  return sha256Hex(uncompressedPartHashesInIndexOrder.join(""));
}
