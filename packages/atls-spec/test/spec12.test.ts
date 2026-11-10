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
  assetId,
  contentSha256,
  crawlConfigHash,
  datasetId,
  matchingFileExtension,
  normalizeUrl,
  provenanceOutputHash,
  sha256Hex,
  urlKey,
  uuidV5,
} from "../src/index.js";

const SAME_AS_WRITER_11: Array<[string, string]> = [
  ["HTTP://Example.COM/About", "http://example.com/About/"],
  ["https://example.com", "https://example.com/"],
  ["https://example.com/", "https://example.com/"],
  ["https://example.com/about", "https://example.com/about/"],
  ["https://example.com/about/", "https://example.com/about/"],
  ["https://example.com/about/index.html", "https://example.com/about/index.html"],
  ["https://example.com/file.html/", "https://example.com/file.html"],
  ["https://example.com/a/../b/./c", "https://example.com/b/c/"],
  ["https://example.com/docs/#section", "https://example.com/docs/"],
  ["https://example.com/docs#section", "https://example.com/docs/"],
  ["https://example.com:443/a", "https://example.com/a/"],
  ["http://example.com:80/a", "http://example.com/a/"],
  ["http://example.com:8080/a", "http://example.com:8080/a/"],
  ["https://example.com/a%2Fb", "https://example.com/a%2Fb/"],
  ["https://example.com/a%7E", "https://example.com/a%7E/"],
  ["https://münchen.example/Über", "https://xn--mnchen-3ya.example/%C3%9Cber/"],
  ["https://example.com/path?utm_source=x&b=2&a=1", "https://example.com/path/?a=1&b=2&utm_source=x"],
  ["https://example.com/q?b=1&", "https://example.com/q/?b=1"],
  ["https://WWW.Example.com/a/", "https://www.example.com/a/"],
  ["https://example.com/archive.tar.gz", "https://example.com/archive.tar.gz"],
  ["https://example.com/archive.tar.gz/", "https://example.com/archive.tar.gz"],
  ["https://example.com/a?sp%20ace=b+c", "https://example.com/a/?sp+ace=b+c"],
];

describe("normalizeUrl spec 1.2", () => {
  test("matches the 1.1 writer where the 1.2 fixes do not apply", () => {
    for (const [input, expected] of SAME_AS_WRITER_11) {
      expect(normalizeUrl(input), input).toBe(expected);
      expect(urlKey(input), input).toBe(sha256Hex(expected));
    }
  });

  test("strips userinfo", () => {
    expect(normalizeUrl("https://user:pass@example.com/a")).toBe("https://example.com/a/");
  });

  test("treats .htaccess as a file and does not add a slash", () => {
    expect(matchingFileExtension(".htaccess")).toBe(".htaccess");
    expect(normalizeUrl("https://example.com/.htaccess")).toBe("https://example.com/.htaccess");
  });

  test("matches .tar.gz as a compound suffix of the full last segment", () => {
    expect(matchingFileExtension("archive.tar.gz")).toBe(".tar.gz");
    expect(normalizeUrl("https://example.com/archive.tar.gz/")).toBe("https://example.com/archive.tar.gz");
  });

  test("sorts duplicate query names by value", () => {
    expect(normalizeUrl("https://example.com/About?b=2&a=1&a=0")).toBe(
      "https://example.com/About/?a=0&a=1&b=2"
    );
    expect(normalizeUrl("https://example.com/About?a=0&a=1&b=2")).toBe(
      "https://example.com/About/?a=0&a=1&b=2"
    );
  });

  test("keeps www and tracking parameters", () => {
    expect(normalizeUrl("https://WWW.Example.com/a/?utm_source=ad")).toBe(
      "https://www.example.com/a/?utm_source=ad"
    );
  });

  test("rejects unparseable and overlong URLs", () => {
    expect(normalizeUrl("not a url")).toBeNull();
    expect(urlKey("not a url")).toBeNull();
    const overlong = `https://example.com/${"a".repeat(9000)}`;
    expect(overlong.length).toBeGreaterThan(8192);
    expect(normalizeUrl(overlong)).toBeNull();
    expect(urlKey(overlong)).toBeNull();
  });

  test("collapses duplicate slashes", () => {
    expect(normalizeUrl("https://example.com/a//b")).toBe("https://example.com/a/b/");
  });
});

describe("integrity digests", () => {
  test("sha256 of the empty string and hello", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(Buffer.alloc(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  test("contentSha256 matches the 1.1 writer vectors for lowercase paths", () => {
    const page = "60d76b438010849e23ab6f0d9f788ae0c75aa47c1ebe9a9828bf958fab076d18";
    const responses = "087b7df123527fa54a65034dff6339755c24b446c188e37746ae99aeaa730294";
    expect(contentSha256({})).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(contentSha256({ "page_metadata/part-001.jsonl.zst": page })).toBe(
      "14799be27b54261e38343a50b4e0c242f081cfc497f0e315b1ca0b8157bb4438"
    );
    const both = {
      "responses/part-001.jsonl.zst": responses,
      "page_metadata/part-001.jsonl.zst": page,
    };
    expect(contentSha256(both)).toBe("46bf71cfb164f3f857ff1dd0980a85d76631a22dcad2f92b12819452cbba1ec2");
    expect(contentSha256(both, "en-US")).toBe(contentSha256(both, "utf8"));
  });

  test("mixed case and Thai collation differ from UTF-8 byte order", () => {
    const files = {
      "Responses/part-001.jsonl.zst": "a".repeat(64),
      "assets/part-001.jsonl.zst": "b".repeat(64),
    };
    expect(contentSha256(files, "utf8")).not.toBe(contentSha256(files, "en-US"));

    const realistic = {
      "sitemap_urls/part-001.jsonl.zst": "a".repeat(64),
      "sitemaps/part-001.jsonl.zst": "b".repeat(64),
    };
    expect(contentSha256(realistic, "utf8")).toBe(contentSha256(realistic, "en-US"));
    expect(contentSha256(realistic, "utf8")).not.toBe(contentSha256(realistic, "th"));
  });

  test("provenance hash follows part-index order, not path order", () => {
    const partA = "97c997abbe81fcfd9fc8a063cd185ac11c14fdc6e83e5f802d22bf1356fa37af";
    const partB = "264e7885097e8724813e361dc96ebbdcdfdf7999e744b6482be591fa109468c5";
    expect(provenanceOutputHash([])).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(provenanceOutputHash([partA])).toBe("0baa940d9c61ea6381b26aae7f5493520c11a288a62a5a88822e782dcc4172f9");
    expect(provenanceOutputHash([partA, partB])).toBe("9e903cbe37920099b88fb8c6a15c8025d629476a238c994fb5dd3ca60b3002a9");
    expect(provenanceOutputHash([partB, partA])).toBe("f9270cb218a3e9987aa6ed0db1abcf7e12a8099112b0462c1c61e63e19c619d0");
  });
});

describe("ids", () => {
  test("asset id is UUID v5 of the normalized URL in the URL namespace", () => {
    expect(uuidV5("https://example.com/a.png")).toBe("c01a4429-4703-5b6a-8726-7982c1849d2a");
    expect(uuidV5("https://example.com/b.png")).toBe("79e10e7a-676c-559f-bf2b-ac2acbb99813");
    expect(assetId("https://example.com/a.png")).toBe("c01a4429-4703-5b6a-8726-7982c1849d2a");
    expect(assetId("https://example.com/a.png/")).toBe("c01a4429-4703-5b6a-8726-7982c1849d2a");
    expect(uuidV5("https://example.com/a.png/")).not.toBe(assetId("https://example.com/a.png/"));
    expect(assetId("not a url")).toBeNull();
  });

  test("datasetId and crawlConfigHash match the writer vectors", () => {
    expect(datasetId({
      crawlId: "crawl_vector",
      crawlStartedAt: "2026-01-02T03:04:05.000Z",
      origin: "https://example.com",
      seeds: ["https://Example.com/about", "https://example.com/"],
    })).toBe("765c90de198faa64");
    expect(crawlConfigHash({
      seeds: ["https://Example.com/about", "https://example.com/"],
      renderMode: "raw",
      replayTier: "html",
      robotsRespect: true,
      privacyConfig: { stripCookies: false, stripAuthHeaders: true },
    })).toBe("c574460f31f0ee80d0f66ad5dcc04c34fd60a44aac84deb85959583f49b18154");
  });
});
