import { describe, it, expect } from "vitest";
import {
  openAtlas,
  readBlob,
  AtlasPathError,
  AtlasAbortError,
} from "../src/index.js";
import { iterateParts } from "../src/reader.js";

describe("BUG-0229: typed read-path errors", () => {
  it("throws AtlasPathError (code ATLAS_INVALID_PATH) for a non-.atls path", async () => {
    await expect(openAtlas("not-an-archive.zip")).rejects.toMatchObject({
      name: "AtlasPathError",
      code: "ATLAS_INVALID_PATH",
    });
  });

  it("throws AtlasPathError for an empty path, with the original message preserved", async () => {
    await expect(openAtlas("")).rejects.toThrow("Atlas path must be a non-empty string.");
    const err = await openAtlas("").catch((e) => e);
    expect(err).toBeInstanceOf(AtlasPathError);
  });

  it("throws AtlasPathError for an empty blob ref", async () => {
    await expect(readBlob("some.atls", "")).rejects.toMatchObject({
      name: "AtlasPathError",
      code: "ATLAS_INVALID_PATH",
    });
  });

  it("throws AtlasAbortError (code ATLAS_ABORTED) when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const iterate = async () => {
      for await (const _ of iterateParts("some.atls", "page_metadata" as any, { signal: controller.signal })) {
        // no-op
      }
    };
    const err = await iterate().catch((e) => e);
    expect(err).toBeInstanceOf(AtlasAbortError);
    expect(err.code).toBe("ATLAS_ABORTED");
    expect(err.message).toBe("Operation aborted.");
  });
});
