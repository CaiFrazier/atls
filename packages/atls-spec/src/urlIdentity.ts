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

import { sha256Hex } from "./integrity.js";

/**
 * Maximum URL length eligible for `normalizeUrl` and `urlKey`, in UTF-16 code
 * units (`String.length`). Spec 1.2 fixes this at 8192. It is not read from
 * the environment.
 */
export const MAX_URL_LENGTH = 8192;

/**
 * The one normative trailing-slash declaration.
 * Writers set `manifest.urlNormalization.trailing_slash` to this value.
 * The identity algorithm below applies this rule whether or not the field is
 * present. Older slash fields are informational.
 */
export const TRAILING_SLASH_POLICY = "append-unless-file";

/**
 * File extensions that keep a path from gaining a trailing slash.
 * Each entry includes the leading dot. Matching uses the full last segment.
 * Compound suffixes (`.tar.gz`) are entries, so they match even when the
 * suffix after the final dot would not.
 *
 * This list is the spec 1.2 allowlist. The 1.1 writer used a private list
 * with the same intent and a last-dot check that missed `.htaccess` and never
 * selected the `.tar.gz` entry itself.
 */
export const FILE_EXTENSIONS: readonly string[] = [
  ".7z",
  ".aac",
  ".apng",
  ".asp",
  ".aspx",
  ".atom",
  ".avi",
  ".avif",
  ".bin",
  ".bmp",
  ".bz2",
  ".cgi",
  ".cjs",
  ".css",
  ".csv",
  ".cur",
  ".doc",
  ".docx",
  ".eot",
  ".flac",
  ".gif",
  ".gz",
  ".heic",
  ".heif",
  ".htaccess",
  ".htpasswd",
  ".htm",
  ".html",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".m4a",
  ".m4v",
  ".map",
  ".mjs",
  ".mov",
  ".mp3",
  ".mp4",
  ".oga",
  ".ogg",
  ".ogv",
  ".otf",
  ".pdf",
  ".php",
  ".phtml",
  ".png",
  ".ppt",
  ".pptx",
  ".rar",
  ".rss",
  ".rtf",
  ".shtml",
  ".svg",
  ".svgz",
  ".tar",
  ".tar.bz2",
  ".tar.gz",
  ".tar.xz",
  ".tgz",
  ".tif",
  ".tiff",
  ".tsv",
  ".ttf",
  ".txt",
  ".wasm",
  ".wav",
  ".webm",
  ".webmanifest",
  ".webp",
  ".woff",
  ".woff2",
  ".xhtml",
  ".xls",
  ".xlsx",
  ".xml",
  ".xz",
  ".zip",
];

/**
 * Longest allowlist suffix of the full last path segment, or null.
 * The segment is lowercased. `.htaccess` matches the entry `.htaccess`.
 * `archive.tar.gz` matches `.tar.gz`, which is longer than `.gz`.
 */
export function matchingFileExtension(segment: string): string | null {
  const lower = segment.toLowerCase();
  let best: string | null = null;
  for (const extension of FILE_EXTENSIONS) {
    if (!lower.endsWith(extension)) {
      continue;
    }
    if (best === null || extension.length > best.length) {
      best = extension;
    }
  }
  return best;
}

/**
 * Policy A, the urlKey trailing-slash rule (`append-unless-file`).
 *
 * Collapse repeated slashes. Keep the root as `/`. If the full last segment
 * has an allowlisted extension, delete trailing slashes. Otherwise ensure
 * one trailing slash. The path's letter case is preserved.
 */
export function canonicalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  let collapsed = pathname.replace(/\/{2,}/g, "/");
  if (!collapsed.startsWith("/")) {
    collapsed = `/${collapsed}`;
  }
  const withoutTrailing = collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
  if (withoutTrailing === "" || withoutTrailing === "/") {
    return "/";
  }
  const lastSegment = withoutTrailing.slice(withoutTrailing.lastIndexOf("/") + 1);
  if (matchingFileExtension(lastSegment)) {
    return withoutTrailing;
  }
  return `${withoutTrailing}/`;
}

function compareCodeUnit(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Identity normalization for spec 1.2.
 *
 * Returns the normalized URL, or null when the input is unparseable or longer
 * than {@link MAX_URL_LENGTH}. Null is not a key. Callers must not hash the
 * raw string instead.
 *
 * Steps:
 * 1. Reject a string longer than 8192 code units.
 * 2. Parse with the WHATWG URL parser. On failure, return null.
 *    The parser lowercases the scheme and host, converts an IDN host to
 *    punycode, removes the scheme's default port, resolves `.` and `..`, and
 *    percent-encodes the path with uppercase hex digits.
 * 3. Strip userinfo.
 * 4. Drop the fragment.
 * 5. Apply {@link canonicalizePathname} to the pathname.
 * 6. Sort query parameters by name, then by value, in UTF-16 code unit order.
 *    Equal pairs keep their original order (the sort is stable). Serialize
 *    with `application/x-www-form-urlencoded` (a space is `+`).
 * 7. Return the URL serializer's string (`URL.href`).
 *
 * Not part of identity: the fetch-time parameter blocklist, `www` folding,
 * `preserveTrailingSlash`, and public-suffix logic. Those are producer crawl
 * policy. `utm_source` and a leading `www.` survive this function.
 */
export function normalizeUrl(input: string): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_URL_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  url.pathname = canonicalizePathname(url.pathname);
  const pairs = [...url.searchParams.entries()];
  pairs.sort((left, right) => compareCodeUnit(left[0], right[0]) || compareCodeUnit(left[1], right[1]));
  const params = new URLSearchParams();
  for (const [name, value] of pairs) {
    params.append(name, value);
  }
  url.search = params.toString();
  return url.href;
}

/**
 * `urlKey` for spec 1.2: lowercase SHA-256 hex of the normalized URL's UTF-8
 * bytes. Returns null when {@link normalizeUrl} returns null.
 *
 * Spec 1.1 derived a SHA-1 of a different normalization and did not store it
 * on `page_metadata`. Moving the digest to SHA-256 does not change bytes in
 * existing archives.
 */
export function urlKey(input: string): string | null {
  const normalized = normalizeUrl(input);
  if (normalized === null) {
    return null;
  }
  return sha256Hex(normalized);
}
