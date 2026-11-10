# Reading Atlas Archives

How to read an `.atls` archive. Dataset directories use the long names in `ATLAS_DATASET_KEYS`.

Current schema tag: `2026-09-04`.

_Verified against the Zod schemas and `@caifrazier/atls-sdk` on 2026-11-10._

---

## Start with the manifest

Every archive's `manifest.json` is plain JSON at the root — read it first to learn what's inside
without unpacking anything:

```python
import zipfile, json
with zipfile.ZipFile("crawl.atls") as z:
    manifest = json.loads(z.read("manifest.json"))
    summary  = json.loads(z.read("summary.json"))

print(manifest["schemaVersion"])              # "2026-09-04"
# manifest identity accepts primary_origin and primaryOrigin; summary identity is primaryOrigin
print(manifest.get("identity", {}).get("primaryOrigin") or manifest.get("identity", {}).get("primary_origin"))
print(summary["identity"]["primaryOrigin"])
print(list(manifest.get("datasets", {})))     # which datasets are present
```

`manifest.datasets` tells you which datasets exist and their record counts; `manifest.parts` lists
the exact part files per dataset. Prefer these over globbing directories.

---

## Reading archives without the SDK (Python)

Python 3 is a dependency-light way to read any archive. Read each
`<dataset>/*.jsonl` part as UTF-8. Decompress each `<dataset>/*.jsonl.zst`
part, then parse JSON Lines:

```python
import zipfile, subprocess, json

def read_dataset(archive_path, dataset_name):
    """Read all records of a dataset from a current-format .atls archive."""
    with zipfile.ZipFile(archive_path) as z:
        prefix = f"{dataset_name}/"
        parts = sorted(
            n for n in z.namelist()
            if n.startswith(prefix) and (n.endswith(".jsonl") or n.endswith(".jsonl.zst"))
        )
        rows = []
        for part in parts:
            raw = z.read(part)
            if part.endswith(".jsonl.zst"):
                out = subprocess.run(
                    ["zstd", "-d", "-", "--stdout"],
                    input=raw, capture_output=True,
                )
                out.check_returncode()
                raw = out.stdout
            rows += [json.loads(line) for line in raw.decode().splitlines() if line.strip()]
        return rows

pages     = read_dataset("crawl.atls", "page_metadata")   # NOT "pages"
responses = read_dataset("crawl.atls", "responses")

# Join page_metadata to responses on pageId for status codes
resp_by_pid = {r["pageId"]: r for r in responses if not r.get("isRedirect")}
for p in pages:
    status = resp_by_pid.get(p["pageId"], {}).get("statusCode")
    print(status, p["url"], p.get("core", {}).get("title"))
```

Key points:

- Use the **long** dataset directory names (`page_metadata`, `navigation`, …). Writers must use
  those names. The reference reader also accepts `pages`, `edges`, and `failed_pages` as a
  fallback and prefers the long directory when both exist. Manifest keys stay the long names.
- Join across datasets on **`pageId`**, not `url`. See [identity-and-keys.md](./identity-and-keys.md).
- Read **all** parts in a directory and concatenate. The reference reader accepts
  `*.jsonl.zst` and uncompressed `*.jsonl`.

### Resolving a blob

```python
def read_blob(z, blobRef):
    # blobRef like "sha256/ab/cd/abcd…ef"
    data = z.read(f"blobs/{blobRef}.zst")
    out = subprocess.run(["zstd","-d","-","--stdout"], input=data, capture_output=True)
    out.check_returncode()
    return out.stdout
```

Resolve `sha256/<2>/<2>/<64 hex>` by reading `blobs/<ref>.zst`. Also accept a reference that
already includes `blobs/` and `.zst`. Decompress, SHA-256 the uncompressed bytes, and compare
to the hash in the path. A value that is not that shape may be a live URL. See
[storage-and-encoding.md](./storage-and-encoding.md).

---

## Reading archives with the SDK (TypeScript)

Install the current SDK from the GitHub Release. `npm pack` names the files `caifrazier-atls-spec-26.11.2.tgz` and `caifrazier-atls-sdk-26.11.2.tgz`. Install both so the SDK's spec dependency resolves to the spec tarball.

```bash
npm install https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-spec-26.11.2.tgz https://github.com/CaiFrazier/atls/releases/download/v26.11.2/caifrazier-atls-sdk-26.11.2.tgz
```

npm currently has only the old 1.0.0-rc.1 release candidate. Use the GitHub release.

pnpm needs the spec-tarball override in the [repository README](https://github.com/CaiFrazier/atls/blob/main/README.md). You can also clone the repository and build it with `pnpm install` and `pnpm build`.

The high-level reader is the standard path for TypeScript/JavaScript users:

```ts
import { openAtlas } from "@caifrazier/atls-sdk";

const atlas = await openAtlas("./crawl.atls");
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url, page.title);   // flattened by pageMetadataMapping
}
atlas.close();
```

Full API details can be found in the [Atlas SDK reference](https://github.com/CaiFrazier/atls/blob/main/packages/atls-sdk/docs/API.md).

---

_Last verified against the Zod schemas and `@caifrazier/atls-sdk`: 2026-11-10._
