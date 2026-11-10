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

/** A parsed content-addressed blob reference. */
export interface ParsedBlobRef {
  /** Lowercase SHA-256 hex of the uncompressed bytes. */
  hash: string;
  /** Canonical record spelling: `sha256/<2>/<2>/<hash>`. */
  canonical: string;
  /** Legacy record spelling: `blobs/sha256/<2>/<2>/<hash>.zst`. */
  legacy: string;
  /** ZIP entry path: `blobs/sha256/<2>/<2>/<hash>.zst`. */
  archivePath: string;
}

const BLOB_REF_RE =
  /^(?:blobs\/)?sha256\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{64})(?:\.zst)?$/;

/**
 * Parse a blob reference.
 *
 * Accepts the canonical spelling and the legacy `blobs/.../<hash>.zst`
 * spelling, plus the same path with the prefix or the suffix alone.
 * Shard directories must equal the first four hex characters of the hash.
 * Returns null for any other string, including a live URL.
 */
export function parseBlobRef(value: string): ParsedBlobRef | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = BLOB_REF_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const shardA = match[1]!;
  const shardB = match[2]!;
  const hash = match[3]!;
  if (hash.slice(0, 2) !== shardA || hash.slice(2, 4) !== shardB) {
    return null;
  }
  const canonical = `sha256/${shardA}/${shardB}/${hash}`;
  return {
    hash,
    canonical,
    legacy: `blobs/${canonical}.zst`,
    archivePath: `blobs/${canonical}.zst`,
  };
}

/**
 * Blob-ref strings carried by a screenshot reference.
 *
 * A plain string is included when it is a blob ref. A tiled manifest contributes
 * each `tiles[].src`, and a top-level `src`, when that string is a blob ref.
 * The original spelling is preserved (`sha256/<2>/<2>/<hash>` or
 * `blobs/sha256/<2>/<2>/<hash>.zst`). Live URLs and other strings are skipped.
 */
export function screenshotBlobRefs(value: unknown): string[] {
  const refs: string[] = [];
  const push = (candidate: unknown): void => {
    if (typeof candidate !== "string") return;
    if (parseBlobRef(candidate)) refs.push(candidate);
  };
  if (typeof value === "string") {
    push(value);
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  const record = value as { src?: unknown; tiles?: unknown };
  push(record.src);
  if (Array.isArray(record.tiles)) {
    for (const tile of record.tiles) {
      if (tile && typeof tile === "object") {
        push((tile as { src?: unknown }).src);
      }
    }
  }
  return refs;
}

/** Archive path for uncompressed bytes whose SHA-256 hex is `hash`. */
export function blobArchivePath(hash: string): string {
  const parsed = parseBlobRef(`sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`);
  if (!parsed || parsed.hash !== hash) {
    throw new Error(`Not a lowercase SHA-256 hex digest: ${hash}`);
  }
  return parsed.archivePath;
}
