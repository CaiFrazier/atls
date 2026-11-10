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
 * Rebuild conformance/archives and conformance/vectors from the spec 1.2
 * algorithms. Run after `pnpm --filter @caifrazier/atls-spec build`:
 *
 *   node conformance/generate.mjs
 */

import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetId,
  contentSha256,
  crawlConfigHash,
  datasetId,
  FILE_EXTENSIONS,
  normalizeUrl,
  provenanceOutputHash,
  sha256Hex,
  urlKey,
  uuidV5,
} from "../packages/atls-spec/dist/index.js";

const require = createRequire(new URL("../packages/atls-sdk/package.json", import.meta.url));
const { compress } = require("@mongodb-js/zstd");
const archiver = require("archiver");

const root = dirname(fileURLToPath(import.meta.url));
const archivesDir = join(root, "archives");
const vectorsDir = join(root, "vectors");

const PAGE_ID = "01936b6a-7c8e-7a1b-8c2d-3e4f50617283";
const CAPTURED_AT = "2026-01-02T03:04:05.000Z";
const PAGE_URL = "https://example.com/";

const WRITER_11 = [
  ["HTTP://Example.COM/About", "http://example.com/About/", "00b4e5a59c5ab025f964a32b5926ee36877411e1"],
  ["https://example.com", "https://example.com/", "b559c7edd3fb67374c1a25e739cdd7edd1d79949"],
  ["https://example.com/", "https://example.com/", "b559c7edd3fb67374c1a25e739cdd7edd1d79949"],
  ["https://example.com/about", "https://example.com/about/", "82756af2d6e74b5963d505aa78f95942d6b82e46"],
  ["https://example.com/about/", "https://example.com/about/", "82756af2d6e74b5963d505aa78f95942d6b82e46"],
  ["https://example.com/about/index.html", "https://example.com/about/index.html", "48094264a5b6eae69379fa967cabbf6096201914"],
  ["https://example.com/file.html/", "https://example.com/file.html", "4cca6fe285c98f2daaba8ce51fca2b3f15ac0e21"],
  ["https://example.com/.htaccess", "https://example.com/.htaccess/", "acfef77015d38716dd9c33cb99a02ec64a11e2d7"],
  ["https://example.com/a/../b/./c", "https://example.com/b/c/", "5ff25ea42e97b474f8f95cd0747b88d26fc87a87"],
  ["https://example.com/docs/#section", "https://example.com/docs/", "1d79f76fd572ec906a0dd26b29b3ba200fc64eac"],
  ["https://example.com/docs#section", "https://example.com/docs/", "1d79f76fd572ec906a0dd26b29b3ba200fc64eac"],
  ["https://example.com:443/a", "https://example.com/a/", "215950a8a24fd8d02c1afa43379400f574308fe6"],
  ["http://example.com:80/a", "http://example.com/a/", "b0713867e5d2acaa86f5a165a7e955b96ddfd6c5"],
  ["http://example.com:8080/a", "http://example.com:8080/a/", "03860f4503ad39c774349acdc19ec57c3154861f"],
  ["https://user:pass@example.com/a", "https://user:pass@example.com/a/", "29d05e712f6eb2d7289a45ba7c34d79cf3dba5da"],
  ["https://example.com/a%2Fb", "https://example.com/a%2Fb/", "d775e1a7abb28096f5feaeff9adb7a950810b24e"],
  ["https://example.com/a%7E", "https://example.com/a%7E/", "0088044c0be2018a9f282fe772e6e406e9944d61"],
  ["https://münchen.example/Über", "https://xn--mnchen-3ya.example/%C3%9Cber/", "e5822c6e6b5b6acfb6386dc8a6121319be689555"],
  ["https://example.com/About?b=2&a=1&a=0", "https://example.com/About/?a=1&a=0&b=2", "f7f248b229ebc56c25db3f7733d465341749dfda"],
  ["https://example.com/path?utm_source=x&b=2&a=1", "https://example.com/path/?a=1&b=2&utm_source=x", "822f5056da5d1da10f025b6b76488d806dbd1151"],
  ["https://example.com/q?b=1&", "https://example.com/q/?b=1", "a509743fdf8824b99a37bd0bc2a3cbaff86cd866"],
  ["https://WWW.Example.com/a/", "https://www.example.com/a/", "2627e0c855f03cbb4585c99ed20b321e5df1f723"],
  ["https://example.com/archive.tar.gz", "https://example.com/archive.tar.gz", "ccb1ea6fbaabb37f98d16b40ca7233a501fe0f45"],
  ["https://example.com/archive.tar.gz/", "https://example.com/archive.tar.gz", "ccb1ea6fbaabb37f98d16b40ca7233a501fe0f45"],
  ["https://example.com/a?sp%20ace=b+c", "https://example.com/a/?sp+ace=b+c", "ca058e0b03f8dfb0fc4c0e7fae2baaf0a15262a4"],
];

function reasonForDifference(input, writerNormalized, normalized) {
  if (normalized === writerNormalized) return null;
  if (input === "https://example.com/.htaccess") {
    return "1.2 treats the full last segment .htaccess as a file. 1.1 required the dot to be after the first character, so it added a trailing slash.";
  }
  if (input.startsWith("https://user:pass@")) {
    return "1.2 strips userinfo. 1.1 kept it.";
  }
  if (input.includes("a=1&a=0")) {
    return "1.2 sorts query pairs by name, then by value. 1.1 sorted by name only and kept the original order of duplicate names, so a=1 stayed before a=0.";
  }
  return "1.2 normalized URL differs from the 1.1 writer.";
}

function urlVectors() {
  const rows = WRITER_11.map(([input, writer11Normalized, writer11UrlKeySha1]) => {
    const normalized = normalizeUrl(input);
    return {
      input,
      normalized,
      urlKey: urlKey(input),
      writer11Normalized,
      writer11UrlKeySha1,
      differsFromWriter11: normalized !== writer11Normalized,
      reason: reasonForDifference(input, writer11Normalized, normalized),
    };
  });
  rows.push({
    input: "not a url",
    normalized: null,
    urlKey: null,
    writer11Normalized: "not a url",
    writer11UrlKeySha1: "d7aad9a0157a961b97833ff47c0d06f7add5a336",
    differsFromWriter11: true,
    reason: "1.2 returns null for an unparseable URL and does not hash the raw string. 1.1 returned the raw string and used SHA-1 of that string as urlKey.",
  });
  return rows;
}

function hashVectors() {
  const page = "60d76b438010849e23ab6f0d9f788ae0c75aa47c1ebe9a9828bf958fab076d18";
  const responses = "087b7df123527fa54a65034dff6339755c24b446c188e37746ae99aeaa730294";
  const lowercase = {
    "page_metadata/part-001.jsonl.zst": page,
    "responses/part-001.jsonl.zst": responses,
  };
  const mixed = {
    "Responses/part-001.jsonl.zst": "a".repeat(64),
    "assets/part-001.jsonl.zst": "b".repeat(64),
    "page_metadata/part-001.jsonl.zst": "c".repeat(64),
    "page_metadata/part-002.jsonl.zst": "d".repeat(64),
  };
  const thai = {
    "sitemap_urls/part-001.jsonl.zst": "a".repeat(64),
    "sitemaps/part-001.jsonl.zst": "b".repeat(64),
  };
  const partA = "97c997abbe81fcfd9fc8a063cd185ac11c14fdc6e83e5f802d22bf1356fa37af";
  const partB = "264e7885097e8724813e361dc96ebbdcdfdf7999e744b6482be591fa109468c5";
  return {
    description: "Spec 1.2 digest rules. contentSha256 orders paths by UTF-8 bytes. The 1.1 writer used localeCompare. For the lowercase part paths that writer emits, en-US localeCompare matches UTF-8 byte order, so the published 1.1 vectors below are also the 1.2 digests. They differ for mixed-case paths and for locale th on sitemap_urls versus sitemaps.",
    sha256Empty: sha256Hex(""),
    sha256Hello: sha256Hex("hello"),
    contentSha256: {
      empty: contentSha256({}),
      pageMetadataOnly: contentSha256({ "page_metadata/part-001.jsonl.zst": page }),
      pageMetadataAndResponses: contentSha256(lowercase),
      sameAsWriter11ForTheseLowercasePaths: true,
    },
    pathOrder: {
      mixedCase: {
        utf8: contentSha256(mixed, "utf8"),
        enUsLocaleCompare: contentSha256(mixed, "en-US"),
        differ: true,
        utf8Order: Object.keys(mixed).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))),
        enUsOrder: Object.keys(mixed).sort((a, b) => a.localeCompare(b, "en-US")),
        note: "1.1 en-US localeCompare orders Responses after assets because it folds case. UTF-8 byte order puts Responses first, because R (U+0052) is before a (U+0061). 1.1 writers emit lowercase paths, so this does not change those archives. A 1.1 reader still accepts either digest.",
      },
      thaiLocale: {
        paths: thai,
        utf8: contentSha256(thai, "utf8"),
        enUs: contentSha256(thai, "en-US"),
        th: contentSha256(thai, "th"),
        utf8MatchesEnUs: contentSha256(thai, "utf8") === contentSha256(thai, "en-US"),
        thDiffers: contentSha256(thai, "th") !== contentSha256(thai, "utf8"),
        note: "Locale th orders sitemaps/ before sitemap_urls/ because the underscore is not a primary difference. UTF-8 byte order and en-US order sitemap_urls/ first. Both names are registry datasets, so this is a realistic 1.1 versus 1.2 difference when the 1.1 process locale was th. A 1.1 reader accepts the byte-order digest, the en-US digest, and the th digest.",
      },
    },
    provenanceOutputHash: {
      empty: provenanceOutputHash([]),
      partA: provenanceOutputHash([partA]),
      partAThenPartB: provenanceOutputHash([partA, partB]),
      partBThenPartA: provenanceOutputHash([partB, partA]),
      note: "Uncompressed JSONL checksums in part-index order. Not contentSha256.",
    },
    datasetId: datasetId({
      crawlId: "crawl_vector",
      crawlStartedAt: "2026-01-02T03:04:05.000Z",
      origin: "https://example.com",
      seeds: ["https://Example.com/about", "https://example.com/"],
    }),
    crawlConfigHash: crawlConfigHash({
      seeds: ["https://Example.com/about", "https://example.com/"],
      renderMode: "raw",
      replayTier: "html",
      robotsRespect: true,
      privacyConfig: { stripCookies: false, stripAuthHeaders: true },
    }),
    assetId: {
      normalizedPng: assetId("https://example.com/a.png"),
      normalizedPngWithSlash: assetId("https://example.com/a.png/"),
      writer11RawWithSlash: uuidV5("https://example.com/a.png/"),
      note: "1.2 hashes the normalized URL. 1.1 hashed the raw URL, so a trailing slash changed the id.",
    },
    blobs: {
      helloAtlas: {
        utf8: "Hello, Atlas",
        sha256: sha256Hex("Hello, Atlas"),
        canonicalRef: "sha256/71/45/7145fc4f75d487a859dad3467b311f6e2c509219c805b05dc1463e8912a5fb3f",
        archivePath: "blobs/sha256/71/45/7145fc4f75d487a859dad3467b311f6e2c509219c805b05dc1463e8912a5fb3f.zst",
        note: "The compressed frame is not normative. Any Zstandard level is valid. Verify by decompressing, then hashing.",
      },
    },
    fileExtensions: FILE_EXTENSIONS,
  };
}

function pageRecord() {
  return {
    pageId: PAGE_ID,
    url: PAGE_URL,
    core: { title: "Example" },
    indexing: {},
    social: { openGraph: {}, twitterCard: {} },
    capturedAt: CAPTURED_AT,
  };
}

function responseRecord(bodyBlobRef) {
  return {
    pageId: PAGE_ID,
    url: PAGE_URL,
    finalUrl: PAGE_URL,
    statusCode: 200,
    encoding: "utf-8",
    ...(bodyBlobRef ? { bodyBlobRef } : {}),
  };
}

async function jsonlPart(records) {
  const jsonl = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const compressed = Buffer.from(await compress(Buffer.from(jsonl, "utf8")));
  return { compressed, sha256: sha256Hex(compressed) };
}

function summary(totalPages) {
  return {
    identity: {
      seedUrls: [PAGE_URL],
      primaryOrigin: "https://example.com",
      domain: "example.com",
      publicSuffix: "com",
    },
    crawlContext: {
      specLevel: 1,
      completionReason: "finished",
      config: { robotsRespect: true, followExternal: false },
    },
    stats: {
      totalPages,
      totalEdges: 0,
      totalAssets: 0,
      totalErrors: 0,
      statusCodes: totalPages > 0 ? { 200: totalPages } : {},
      renderModes: { raw: totalPages },
    },
    performance: { maxDepthReached: 0 },
    timestamps: {
      crawlStartedAt: CAPTURED_AT,
      crawlCompletedAt: CAPTURED_AT,
      crawlDurationMs: 1,
    },
  };
}

function manifest(options) {
  const {
    edition,
    parts,
    files,
    content,
    datasets,
    extraIntegrity = {},
    blobRefStyle,
  } = options;
  const is12 = edition === "1.2";
  return {
    atlasVersion: is12 ? "1.2" : "1.1",
    formatVersion: is12 ? "1.2.0" : "1.1.0",
    specVersion: is12 ? "1.2.0" : "1.1.0",
    schemaVersion: "2026-09-04",
    crawlId: "01936b6a-7c8e-7000-8000-000000000001",
    mode: "raw",
    incomplete: false,
    owner: { name: "Example Producer" },
    consumers: ["conformance"],
    generator: is12 ? "atls-conformance/1.2.0" : "atls-conformance/1.1.0",
    createdAt: CAPTURED_AT,
    configIncluded: false,
    redactionApplied: false,
    notes: [
      blobRefStyle === "legacy"
        ? "Response bodyBlobRef uses the legacy blobs/.../<hash>.zst spelling."
        : "Conformance fixture.",
    ],
    hashing: {
      algorithm: "sha256",
      urlKeyAlgo: is12 ? "sha256" : "sha1",
      rawHtmlHash: "sha256 of the raw HTTP body bytes",
      domHash: "sha256 of the decoded HTML string in raw mode",
    },
    urlNormalization: is12
      ? { trailing_slash: "append-unless-file" }
      : {
          remove_trailing_slash: false,
          trailing_slash_policy: "append",
        },
    crawlContext: is12
      ? { mode: "raw" }
      : { mode: "raw", urlNormalizationRules: ["remove-trailing-slash"] },
    parts,
    schemas: Object.fromEntries(Object.keys(parts).map((name) => [name, `schemas/${name}.v1.schema.json#1`])),
    datasets,
    coverage: {
      matrix: [],
      totalPages: datasets.page_metadata?.recordCount ?? 0,
      totalEdges: 0,
      totalAssets: 0,
      successfulPages: datasets.page_metadata?.recordCount ?? 0,
      failedStatusPages: 0,
      pagesWithErrors: 0,
      incomplete: false,
    },
    integrity: {
      algorithm: "sha256",
      contentSha256: content,
      files,
      ...extraIntegrity,
    },
  };
}

function writeZip(filePath, entries) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = archiver("zip", { zlib: { level: 0 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const entry of entries) {
      archive.append(entry.data, { name: entry.name, store: true });
    }
    archive.finalize();
  });
}

async function buildArchive(fileName, spec) {
  const entries = [
    { name: "manifest.json", data: Buffer.from(`${JSON.stringify(spec.manifest, null, 2)}\n`) },
    { name: "summary.json", data: Buffer.from(`${JSON.stringify(spec.summary, null, 2)}\n`) },
  ];
  for (const part of spec.parts) {
    entries.push({ name: part.path, data: part.compressed });
  }
  if (spec.blob) {
    entries.push({ name: spec.blob.path, data: spec.blob.compressed });
  }
  await writeZip(join(archivesDir, fileName), entries);
}

async function helloBlob() {
  const plain = Buffer.from("Hello, Atlas", "utf8");
  const hash = sha256Hex(plain);
  const compressed = Buffer.from(await compress(plain));
  return {
    hash,
    canonical: `sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`,
    path: `blobs/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.zst`,
    compressed,
  };
}

async function main() {
  await mkdir(archivesDir, { recursive: true });
  await mkdir(vectorsDir, { recursive: true });

  const vectors = {
    specVersion: "1.2.0",
    description: "URL identity and digest vectors for Atlas spec 1.2. urlKey is SHA-256 of the normalized URL. Where 1.2 output differs from the 1.1 writer, differsFromWriter11 is true and reason says why. Every urlKey differs from writer11UrlKeySha1 because 1.1 used SHA-1 and did not store the key.",
    notIdentity: {
      parameterBlocklist: "Fetch-time removal of utm_source, ref, and the rest of the producer blocklist is crawl policy. normalizeUrl keeps those parameters.",
      wwwFolding: "Folding one leading www. onto a preferred host is crawl policy. normalizeUrl lowercases www and keeps it.",
    },
    urlNormalization: urlVectors(),
    overlong: {
      limit: 8192,
      normalized: null,
      urlKey: null,
      writer11: "threw URL exceeds maximum length of 8192",
      reason: "1.2 returns null. The length is fixed. It is not read from the environment.",
    },
    hashes: hashVectors(),
  };
  await writeFile(join(vectorsDir, "url-and-hashes.json"), `${JSON.stringify(vectors, null, 2)}\n`);

  const blob = await helloBlob();
  const wrongHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const wrongBlobPath = `blobs/sha256/${wrongHash.slice(0, 2)}/${wrongHash.slice(2, 4)}/${wrongHash}.zst`;

  async function sealed(edition, records, blobRef, blobEntry) {
    const parts = [];
    const files = {};
    const partLists = {};
    const datasets = {};
    for (const [name, rows] of Object.entries(records)) {
      const built = await jsonlPart(rows);
      const path = `${name}/part-001.jsonl.zst`;
      parts.push({ path, compressed: built.compressed });
      files[path] = built.sha256;
      partLists[name] = [path];
      datasets[name] = {
        recordCount: rows.length,
        integrity: { algorithm: "sha256", checksums: { [path]: built.sha256 } },
      };
    }
    return {
      parts,
      files,
      partLists,
      datasets,
      content: contentSha256(files, "utf8"),
      blobRef,
      blob: blobEntry,
      edition,
    };
  }

  const canonicalRef = blob.canonical;
  const legacyRef = `blobs/${blob.canonical}.zst`;

  const valid12 = await sealed("1.2", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(canonicalRef)],
  }, canonicalRef, blob);
  const valid11 = await sealed("1.1", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(canonicalRef)],
  }, canonicalRef, blob);
  const legacy = await sealed("1.2", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(legacyRef)],
  }, legacyRef, blob);
  const legacy11 = await sealed("1.1", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(legacyRef)],
  }, legacyRef, blob);
  const badChecksum = await sealed("1.2", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(canonicalRef)],
  }, canonicalRef, blob);
  const badDigest = await sealed("1.2", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(canonicalRef)],
  }, canonicalRef, blob);
  const corruptBlob = await sealed("1.2", {
    page_metadata: [pageRecord()],
    responses: [responseRecord(`sha256/${wrongHash.slice(0, 2)}/${wrongHash.slice(2, 4)}/${wrongHash}`)],
  }, null, { path: wrongBlobPath, compressed: blob.compressed });
  const missingPage = await sealed("1.2", {
    responses: [responseRecord(canonicalRef)],
  }, canonicalRef, blob);

  const flipped = (hex) => (hex.endsWith("0") ? `${hex.slice(0, -1)}1` : `${hex.slice(0, -1)}0`);
  const pagePart = "page_metadata/part-001.jsonl.zst";
  badChecksum.files = { ...badChecksum.files, [pagePart]: flipped(badChecksum.files[pagePart]) };
  badDigest.content = flipped(badDigest.content);

  const cases = [
    ["minimal-valid-1.1.atls", valid11, {}],
    ["minimal-valid-1.2.atls", valid12, {}],
    ["legacy-blob-ref.atls", legacy, {}],
    ["legacy-blob-ref-1.1.atls", legacy11, {}],
    ["corrupted-part-checksum.atls", badChecksum, {}],
    ["bad-content-sha256.atls", badDigest, {}],
    ["corrupted-blob.atls", corruptBlob, {}],
    ["missing-required-dataset.atls", missingPage, { omitPage: true }],
  ];

  const expected = [];
  for (const [fileName, built, flags] of cases) {
    const extraIntegrity = built.edition === "1.1"
      ? { archiveSha256: built.content, auditHash: built.content }
      : {};
    const spec = {
      manifest: manifest({
        edition: built.edition,
        parts: built.partLists,
        files: built.files,
        content: built.content,
        datasets: built.datasets,
        extraIntegrity,
        blobRefStyle: fileName.startsWith("legacy") ? "legacy" : "canonical",
      }),
      summary: summary(flags.omitPage ? 0 : 1),
      parts: built.parts,
      blob: built.blob,
    };
    if (flags.omitPage) {
      delete spec.manifest.parts.page_metadata;
      delete spec.manifest.datasets.page_metadata;
    }
    await buildArchive(fileName, spec);
    expected.push(fileName);
  }

  const verdicts = {
    description: "Expected validate() verdicts for conformance/archives. valid is the reference reader with default options. strictValid is validate({ strict: true }). Error codes are the only error codes default validation reports.",
    archives: [
      { file: "minimal-valid-1.1.atls", valid: true, strictValid: true, errorCodes: [], note: "Spec 1.1. archiveSha256 and auditHash are present and ignored. contentSha256 uses the same byte order as en-US localeCompare for these lowercase paths." },
      { file: "minimal-valid-1.2.atls", valid: true, strictValid: true, errorCodes: [], note: "Spec 1.2. No archiveSha256 or auditHash. urlNormalization.trailing_slash is append-unless-file. Blob ref is the canonical spelling." },
      { file: "legacy-blob-ref.atls", valid: true, strictValid: true, errorCodes: [], note: "bodyBlobRef is blobs/sha256/<2>/<2>/<hash>.zst. Readers accept that spelling. The blob hash still matches." },
      { file: "legacy-blob-ref-1.1.atls", valid: true, strictValid: true, errorCodes: [], note: "Spec 1.1. bodyBlobRef uses the legacy blobs/sha256/<2>/<2>/<hash>.zst spelling. getBlob() reads that ref. archiveSha256 and auditHash are present and ignored." },
      { file: "corrupted-part-checksum.atls", valid: false, strictValid: false, errorCodes: ["PART_CHECKSUM_MISMATCH"], note: "integrity.files for page_metadata/part-001.jsonl.zst does not match the stored part bytes. contentSha256 still matches the real checksums." },
      { file: "bad-content-sha256.atls", valid: false, strictValid: false, errorCodes: ["CONTENT_SHA256_MISMATCH"], note: "Part checksums match the stored bytes. contentSha256 does not match their UTF-8 path-order rollup." },
      { file: "corrupted-blob.atls", valid: false, strictValid: false, errorCodes: ["BLOB_HASH_MISMATCH"], note: "The blob frame decompresses, and SHA-256 of those bytes is not the hash in the path." },
      { file: "missing-required-dataset.atls", valid: false, strictValid: false, errorCodes: ["MANIFEST_MISSING_PARTS"], note: "page_metadata is not declared. The responses part and its checksums are fine. The presence-by-mode matrix is not what fails this archive." },
    ],
  };
  await writeFile(join(root, "expected.json"), `${JSON.stringify(verdicts, null, 2)}\n`);
  console.log(`wrote ${expected.length} archives and vectors`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
