# Security Policy

## Supported versions

Security fixes apply to the latest date-based release line of the packages and to format 1.x archives. The `1.0.0-rc.1` release candidate of `@caifrazier/atls-spec` and `@caifrazier/atls-sdk` on npm is unsupported.

| Version | Supported |
| ------- | --------- |
| `@caifrazier/atls-spec` 26.11.x | Yes |
| `@caifrazier/atls-sdk` 26.11.x | Yes |
| Format 1.x | Yes |
| `@caifrazier/atls-spec` 1.0.0-rc.1 | No |
| `@caifrazier/atls-sdk` 1.0.0-rc.1 | No |
| Earlier package releases | No |

## Threat model

`@caifrazier/atls-sdk` is a read-side library that parses `.atls` archives, which may come
from untrusted sources. The primary risks it defends against:

- **Decompression amplification.** All ZIP, Zstandard, and JSON Lines reads are
  bounded by default. Oversized entries, dataset parts, blobs, root JSON files,
  and JSONL lines throw `AtlasResourceLimitError` instead of exhausting memory.
  Raising limits is an explicit, opt-in decision via the `limits` option.
- **Malformed records.** Strict mode throws `MalformedRecordError`; non-strict
  mode counts and skips. Neither mode executes content from an archive.
- **Path traversal.** Archive entry names are treated as opaque dataset keys;
  nothing from an archive is written to disk by the SDK.

`@caifrazier/atls-spec` contains schemas, types, and validators only; it performs no I/O.

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Email **bugs@caifrazier.com** with a description of the issue, steps to
reproduce (a minimal `.atls` file that triggers the problem is ideal), and the
version affected. You will get an acknowledgment within 3 business days.

Please give us a reasonable window to ship a fix before public disclosure.
