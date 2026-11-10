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

import { describe, expect, test } from "vitest";
import {
  PageMetadataDatasetRecordV1Schema,
  ReconstructionIndexRecordV1Schema,
  flattenPageMetadataRecord,
  screenshotBlobRefs,
} from "../src/index.js";

const HASH = "abcd" + "e".repeat(60);
const CANONICAL = `sha256/ab/cd/${HASH}`;
const LEGACY = `blobs/${CANONICAL}.zst`;
const PAGE_ID = "550e8400-e29b-41d4-a716-446655440000";

function tile(src: string) {
  return { src, height: 400, width: 800, y: 0 };
}

function tiled(src: string) {
  return { tiles: [tile(src)], totalWidth: 800, totalHeight: 1200 };
}

function page(screenshots: Record<string, unknown>) {
  return {
    pageId: PAGE_ID,
    url: "https://example.com/",
    core: { title: "Example" },
    indexing: {},
    social: { openGraph: {}, twitterCard: {} },
    capturedAt: "2026-01-02T03:04:05.000Z",
    media: { screenshots },
  };
}

function reconstruction(overrides: Record<string, unknown>) {
  return {
    pageId: PAGE_ID,
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    sourceBodyBlobRef: CANONICAL,
    domSnapshotPresent: false,
    stylesheets: [],
    scripts: [],
    fonts: [],
    images: [],
    internalLinks: [],
    ...overrides,
  };
}

describe("screenshot ref shapes", () => {
  test("a plain string stays a string at the page and reconstruction locations", () => {
    const pageRecord = page({
      desktop: CANONICAL,
      desktopFullPage: LEGACY,
    });
    const parsedPage = PageMetadataDatasetRecordV1Schema.parse(pageRecord);
    expect(parsedPage.media?.screenshots?.desktop).toBe(CANONICAL);
    expect(parsedPage.media?.screenshots?.desktopFullPage).toBe(LEGACY);

    const flat = flattenPageMetadataRecord(pageRecord);
    expect(flat.media?.screenshots?.desktop).toBe(CANONICAL);
    expect(flat.media?.screenshots?.desktopFullPage).toBe(LEGACY);

    const index = reconstruction({
      screenshotDesktopBlobRef: CANONICAL,
      faviconBlobRef: LEGACY,
      bodyBlobRef: CANONICAL,
    });
    const parsedIndex = ReconstructionIndexRecordV1Schema.parse(index);
    expect(parsedIndex.screenshotDesktopBlobRef).toBe(CANONICAL);
    expect(parsedIndex.faviconBlobRef).toBe(LEGACY);
    expect(parsedIndex.bodyBlobRef).toBe(CANONICAL);
    expect(screenshotBlobRefs(parsedIndex.faviconBlobRef)).toEqual([LEGACY]);
  });

  test("a tiled manifest keeps tiles, totalWidth, and totalHeight", () => {
    const desktop = tiled(CANONICAL);
    const fullPage = tiled(LEGACY);
    const pageRecord = page({
      desktop,
      desktopFullPage: fullPage,
    });
    const parsedPage = PageMetadataDatasetRecordV1Schema.parse(pageRecord);
    expect(parsedPage.media?.screenshots?.desktop).toEqual(desktop);
    expect(parsedPage.media?.screenshots?.desktopFullPage).toEqual(fullPage);

    const flat = flattenPageMetadataRecord(pageRecord);
    expect(flat.media?.screenshots?.desktop).toEqual(desktop);
    expect(flat.media?.screenshots?.desktopFullPage).toEqual(fullPage);

    const index = reconstruction({
      screenshotDesktopBlobRef: desktop,
      faviconBlobRef: fullPage,
      bodyBlobRef: desktop,
    });
    const parsedIndex = ReconstructionIndexRecordV1Schema.parse(index);
    expect(parsedIndex.screenshotDesktopBlobRef).toEqual(desktop);
    expect(parsedIndex.faviconBlobRef).toEqual(fullPage);
    expect(parsedIndex.bodyBlobRef).toEqual(desktop);
    expect(screenshotBlobRefs(parsedIndex.screenshotDesktopBlobRef)).toEqual([CANONICAL]);
    expect(screenshotBlobRefs(fullPage)).toEqual([LEGACY]);
  });

  test("tile src blob refs keep their spelling and live URLs are skipped", () => {
    const manifest = {
      tiles: [tile(CANONICAL), tile(LEGACY), tile("https://example.com/shot.png")],
      totalWidth: 800,
      totalHeight: 1200,
    };
    expect(screenshotBlobRefs(manifest)).toEqual([CANONICAL, LEGACY]);
    expect(screenshotBlobRefs("https://cdn.example/image.png")).toEqual([]);
  });
});
