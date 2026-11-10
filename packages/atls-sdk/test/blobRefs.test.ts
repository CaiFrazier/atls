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
  openAtlas,
  readBlob,
  screenshotBlobRefs,
  statBlob,
  validate,
} from "../src/index.js";
import { createFixtureArchive } from "./helpers/fixtureArchive.js";

function tile(src: string) {
  return { src, height: 400, width: 800, y: 0 };
}

function tiled(src: string) {
  return { tiles: [tile(src)], totalWidth: 800, totalHeight: 1200 };
}

describe("screenshot ref shapes", () => {
  test("a plain string screenshot ref resolves both blob spellings", async () => {
    const fixture = await createFixtureArchive({
      formatVersionValue: "1.1.0",
      decoratePage(page, refs) {
        page.media = {
          screenshots: {
            desktop: refs.canonical,
            desktopFullPage: refs.legacy,
          },
        };
      },
      extraDatasets(refs) {
        return {
          reconstruction_index: [
            {
              pageId: refs.pageId,
              url: refs.pageUrl,
              finalUrl: refs.pageUrl,
              sourceBodyBlobRef: refs.canonical,
              domSnapshotPresent: false,
              stylesheets: [],
              scripts: [],
              fonts: [],
              images: [],
              internalLinks: [],
              screenshotDesktopBlobRef: refs.canonical,
              faviconBlobRef: refs.legacy,
              bodyBlobRef: refs.legacy,
            },
          ],
        };
      },
    });

    try {
      const atlas = await openAtlas(fixture.path);
      try {
        const pages = [];
        for await (const page of atlas.readers.pageMetadata()) pages.push(page);
        expect(pages).toHaveLength(1);
        const screenshots = pages[0]?.media?.screenshots;
        expect(screenshots?.desktop).toBe(fixture.blobRef);
        expect(screenshots?.desktopFullPage).toBe(fixture.legacyBlobRef);

        const indexes = [];
        for await (const row of atlas.readers.dataset("reconstruction_index")) indexes.push(row);
        expect(indexes).toHaveLength(1);
        const index = indexes[0] as {
          screenshotDesktopBlobRef: string;
          faviconBlobRef: string;
          bodyBlobRef: string;
        };
        expect(index.screenshotDesktopBlobRef).toBe(fixture.blobRef);
        expect(index.faviconBlobRef).toBe(fixture.legacyBlobRef);
        expect(index.bodyBlobRef).toBe(fixture.legacyBlobRef);

        const canonicalBytes = await atlas.getBlob(fixture.blobRef);
        const legacyBytes = await atlas.getBlob(fixture.legacyBlobRef);
        expect(canonicalBytes.equals(fixture.blobBody)).toBe(true);
        expect(legacyBytes.equals(fixture.blobBody)).toBe(true);
        expect((await readBlob(fixture.path, index.bodyBlobRef)).equals(fixture.blobBody)).toBe(true);
        expect((await statBlob(fixture.path, index.faviconBlobRef)).exists).toBe(true);
      } finally {
        atlas.close();
      }

      const result = await validate(fixture.path);
      expect(result.valid, JSON.stringify(result.issues, null, 2)).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  test("a tiled screenshot ref resolves tile src in both spellings", async () => {
    const fixture = await createFixtureArchive({
      formatVersionValue: "1.1.0",
      decoratePage(page, refs) {
        page.media = {
          screenshots: {
            desktop: tiled(refs.canonical),
            desktopFullPage: tiled(refs.legacy),
          },
        };
      },
      extraDatasets(refs) {
        return {
          reconstruction_index: [
            {
              pageId: refs.pageId,
              url: refs.pageUrl,
              finalUrl: refs.pageUrl,
              sourceBodyBlobRef: refs.canonical,
              domSnapshotPresent: false,
              stylesheets: [],
              scripts: [],
              fonts: [],
              images: [],
              internalLinks: [],
              screenshotDesktopBlobRef: tiled(refs.legacy),
              faviconBlobRef: tiled(refs.canonical),
              bodyBlobRef: tiled(refs.legacy),
            },
          ],
        };
      },
    });

    try {
      const atlas = await openAtlas(fixture.path);
      try {
        const pages = [];
        for await (const page of atlas.readers.pageMetadata()) pages.push(page);
        const screenshots = pages[0]?.media?.screenshots;
        expect(screenshots?.desktop).toEqual(tiled(fixture.blobRef));
        expect(screenshots?.desktopFullPage).toEqual(tiled(fixture.legacyBlobRef));

        const indexes = [];
        for await (const row of atlas.readers.dataset("reconstruction_index")) indexes.push(row);
        const index = indexes[0] as {
          screenshotDesktopBlobRef: unknown;
          faviconBlobRef: unknown;
          bodyBlobRef: unknown;
        };
        expect(index.screenshotDesktopBlobRef).toEqual(tiled(fixture.legacyBlobRef));
        expect(index.faviconBlobRef).toEqual(tiled(fixture.blobRef));
        expect(index.bodyBlobRef).toEqual(tiled(fixture.legacyBlobRef));

        const refs = [
          ...screenshotBlobRefs(screenshots?.desktop),
          ...screenshotBlobRefs(screenshots?.desktopFullPage),
          ...screenshotBlobRefs(index.screenshotDesktopBlobRef),
          ...screenshotBlobRefs(index.faviconBlobRef),
          ...screenshotBlobRefs(index.bodyBlobRef),
        ];
        expect(refs).toContain(fixture.blobRef);
        expect(refs).toContain(fixture.legacyBlobRef);
        for (const ref of refs) {
          const bytes = await atlas.getBlob(ref);
          expect(bytes.equals(fixture.blobBody)).toBe(true);
          expect((await statBlob(fixture.path, ref)).path).toBe(`blobs/${fixture.blobRef}.zst`);
        }
      } finally {
        atlas.close();
      }

      const result = await validate(fixture.path);
      expect(result.valid, JSON.stringify(result.issues, null, 2)).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });
});
