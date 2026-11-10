# URL identity

Normative URL identity for spec 1.2. `urlKey` is not stored on `page_metadata`. Readers derive it with this algorithm. The fetch-time parameter blocklist and `www` folding are producer crawl policy. They are not part of identity.

Current schema tag: `2026-09-04`.

---

## One trailing-slash field

Writers set:

```json
"urlNormalization": { "trailing_slash": "append-unless-file" }
```

`append-unless-file` is the pathname rule in `normalizeUrl` below. The algorithm applies whether or not the field is present. A reader does not switch rules because the field is missing or set to something else. A spec 1.2 writer sets this value.

These older declarations are informational. Readers ignore them when computing identity:

- `urlNormalization.remove_trailing_slash`
- `urlNormalization.trailing_slash_policy` (a key the 1.1 writer emitted; not a schema field)
- `crawlContext.urlNormalization` and `crawlContext.urlNormalizationRules`, including the token `remove-trailing-slash`
- any `removeTrailingSlash` flag under compare metadata

The 1.1 writer wrote all three of the first group, and they contradicted each other. The function that produced `urlKey` was `append-unless-file`.

---

## `normalizeUrl`

```
normalizeUrl(input) -> string or null
```

Return null when the input is not eligible. Do not hash the raw string in that case.

1. If `input` is empty or longer than 8192 UTF-16 code units (`String.length`), return null. The limit is fixed. Spec 1.1 could raise it with an environment variable. Spec 1.2 does not.
2. Parse with the WHATWG URL parser. On failure, return null. The parser lowercases the scheme and the host, converts an IDN host to punycode, removes the scheme default port (80 for `http`, 443 for `https`, and the WHATWG default for any other scheme), resolves `.` and `..`, and percent-encodes the path. Hex digits in percent escapes are uppercase (`%C3%9C`, `%7E`, `%2F` stays `%2F`).
3. Strip userinfo. Spec 1.1 kept `user:pass@`.
4. Drop the fragment.
5. Replace the pathname with the `append-unless-file` rule:
   - Collapse repeated slashes to one slash.
   - The root stays `/`.
   - Take the full last segment. Lowercase it only for the extension test. Do not lowercase the path in the output.
   - If that segment has a suffix in the allowlist below, delete trailing slashes. Prefer the longest matching suffix, so `archive.tar.gz` matches `.tar.gz` and not only `.gz`. A leading-dot name matches when the whole segment is the entry: `.htaccess` is a file. Spec 1.1 required the dot to sit after the first character, so `.htaccess` gained a trailing slash, and it took the suffix from the last dot only, so the `.tar.gz` entry itself never matched (`.gz` happened to match, which hid the bug for that one name).
   - Otherwise ensure exactly one trailing slash.
6. Sort query parameters by name, then by value, in UTF-16 code unit order. The sort is stable, so pairs that compare equal keep their original order. Spec 1.1 sorted by name only, so `a=1&a=0` stayed in that order. Spec 1.2 sorts the values too, so `a=1&a=0` and `a=0&a=1` are the same identity.
7. Serialize the query with `application/x-www-form-urlencoded`. A space is `+`.
8. Return the URL serializer's string (no fragment, no userinfo).

This function does not remove `utm_source` or any other query name. It does not strip a leading `www.`. It does not consult the public suffix. `preserveTrailingSlash` is a crawl option and does not change `urlKey`.

---

## File extension allowlist

Each entry includes the leading dot. Match a suffix of the full lowercased last segment.

`.7z` `.aac` `.apng` `.asp` `.aspx` `.atom` `.avi` `.avif` `.bin` `.bmp` `.bz2` `.cgi` `.cjs` `.css` `.csv` `.cur` `.doc` `.docx` `.eot` `.flac` `.gif` `.gz` `.heic` `.heif` `.htaccess` `.htpasswd` `.htm` `.html` `.ico` `.jpeg` `.jpg` `.js` `.json` `.m4a` `.m4v` `.map` `.mjs` `.mov` `.mp3` `.mp4` `.oga` `.ogg` `.ogv` `.otf` `.pdf` `.php` `.phtml` `.png` `.ppt` `.pptx` `.rar` `.rss` `.rtf` `.shtml` `.svg` `.svgz` `.tar` `.tar.bz2` `.tar.gz` `.tar.xz` `.tgz` `.tif` `.tiff` `.tsv` `.ttf` `.txt` `.wasm` `.wav` `.webm` `.webmanifest` `.webp` `.woff` `.woff2` `.xhtml` `.xls` `.xlsx` `.xml` `.xz` `.zip`

This published list is the spec 1.2 allowlist. The 1.1 writer used a private list of the same kind (HTML, PHP, images, fonts, `.gz`, `.tar.gz`, and similar names) and the last-dot test described above. `urlKey` was not stored, so the published list is the contract going forward.

The same list is `FILE_EXTENSIONS` in `@caifrazier/atls-spec` and in `conformance/vectors/url-and-hashes.json`.

---

## `urlKey`

`urlKey` is the lowercase SHA-256 hex of the UTF-8 bytes of the `normalizeUrl` result. If `normalizeUrl` returns null, there is no `urlKey`.

Spec 1.1 used SHA-1 of its normalization and did not write the digest into the archive. Spec 1.2 uses SHA-256. `manifest.hashing.urlKeyAlgo` is `sha256` for a 1.2 writer and may be `sha1` on a 1.1 archive. The field names the algorithm. It is not the key.

Vectors, including every input where the 1.2 string differs from the 1.1 writer, are in `conformance/vectors/url-and-hashes.json`.

---

## What is crawl policy, not identity

A producer may, at fetch time:

- delete blocklisted query names (`utm_source`, `ref`, and whatever else that crawl configured)
- fold a single leading `www.` onto a preferred host for internal hosts

Those steps change the URL that is fetched. They do not change `normalizeUrl` or `urlKey`. A page fetched with the parameters removed still has an identity key of the final URL after `normalizeUrl`, which keeps tracking parameters that are still on that final URL.

`manifest.identity.publicSuffix` is a label the producer records. It is not an input to `normalizeUrl`. The 1.1 writer stored the last dot-separated host label, so `www.example.co.uk` was recorded as `uk`. That is not a public-suffix-list result. Do not use it to decide URL identity.

---

## Stored URLs and redirect rows

On a live crawl:

- `page_metadata.url` is the final URL after redirects. It is not passed through `normalizeUrl`.
- `responses.url` on the landing row is the requested URL (the URL that was fetched).
- `responses.finalUrl` is the final URL.
- A redirect hop is an additional `responses` row with `isRedirect: true`, the hop status, and `location` set to the next URL. `encoding` and `bodyBlobRef` are absent. It has no body. It shares `pageId` with the landing row, and its `url` is the requested URL of that hop.

When the page did not redirect, `page_metadata.url` and `responses.url` can still differ from `normalizeUrl(page_metadata.url)`, because the normalizer adds or removes a slash and sorts the query.

Join rules:

- Join datasets for one captured page on `pageId`.
- A join on `pageId` in `responses` returns the redirect rows and the landing row.
- Join `page_metadata` to the landing body on `responses.finalUrl` where `isRedirect` is absent, or follow `bodyBlobRef`.
- A join of `page_metadata.url` to `responses.url` misses the landing row when a redirect changed the URL.

Producers, including importers, use this pair: `page_metadata.url` is the final URL, `responses.url` is the requested URL, and a redirect row is the row with `isRedirect: true` and no body.

---

## Asset ids

From spec 1.2, `assetId` is the UUID version 5 (RFC 4122) of the `normalizeUrl` result, in the URL namespace `6ba7b811-9dad-11d1-80b4-00c04fd430c8`. An asset URL that is not eligible for `normalizeUrl` has no spec 1.2 asset id.

Spec 1.1 hashed the raw asset URL with the same namespace and did not normalize it. `https://example.com/a.png` and `https://example.com/a.png/` were different ids. In spec 1.2 they are the same id, because the normalizer drops the trailing slash on `.png`.

---

_Last verified against `src/urlIdentity.ts` and `src/ids.ts`: 2026-11-10._
