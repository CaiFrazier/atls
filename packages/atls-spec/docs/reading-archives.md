# Reading Atlas Archives

How to read an `.atls` archive correctly, including the current SDK incompatibility and the
supported workaround.

_Verified against `packages/atls-sdk/src/` and the cartographer writer on 2026-06-04._

---

## Start with the manifest

Every archive's `manifest.json` is plain JSON at the root — read it first to learn what's inside
without unpacking anything:

```python
import zipfile, json
with zipfile.ZipFile("crawl.atls") as z:
    manifest = json.loads(z.read("manifest.json"))
    summary  = json.loads(z.read("summary.json"))

print(manifest["schemaVersion"])              # "2025-10-22"
print(manifest["identity"]["primary_origin"]) # snake_case in manifest
print(summary["identity"]["primaryOrigin"])   # camelCase in summary
print(list(manifest.get("datasets", {})))     # which datasets are present
```

`manifest.datasets` tells you which datasets exist and their record counts; `manifest.parts` lists
the exact part files per dataset. Prefer these over globbing directories.

---

## ⚠️ The SDK reader returns 0 records on current archives

The `@atls/sdk` reader methods (`pageMetadata()`, `navigation()`, …) return **0 records** for
archives at `schemaVersion 2025-10-22` — which is what the current cartographer writer emits.

**Root cause.** `NEWER_FORMAT_FOLDER_MAP` (`packages/atls-sdk/src/index.ts:55`) maps canonical
dataset names to the **short** folder names `pages`/`edges`/`failed_pages`, i.e. the SDK assumes a
"newer" archive uses short folder names. But the writer's canonical output uses the **long** names
`page_metadata/`/`navigation/`/`pipeline_failures/` — the short names are *removed legacy*
(`io/atlas/datasets.ts`, and the comment at `ArtifactWriter.ts:880`: "legacy pages/edges removed").
The map is effectively backwards, so dataset detection finds nothing and iteration yields zero
records **silently** — no error is thrown.

Until this is fixed, do **not** rely on the SDK's high-level readers for current archives.

---

## Supported workaround: Python + zstd

`zstd` and Python 3 are the dependency-light way to read any current archive. Decompress each
`<dataset>/part-*.jsonl.zst` and parse JSON Lines:

```python
import zipfile, subprocess, json

def read_dataset(archive_path, dataset_name):
    """Read all records of a dataset from a current-format .atls archive."""
    with zipfile.ZipFile(archive_path) as z:
        parts = sorted(
            n for n in z.namelist()
            if n.startswith(f"{dataset_name}/") and n.endswith(".zst")
        )
        rows = []
        for part in parts:
            out = subprocess.run(
                ["zstd", "-d", "-", "--stdout"],
                input=z.read(part), capture_output=True,
            )
            if out.returncode == 0:
                rows += [json.loads(line) for line in out.stdout.decode().splitlines() if line.strip()]
        return rows

pages     = read_dataset("crawl.atls", "page_metadata")   # NOT "pages"
responses = read_dataset("crawl.atls", "responses")

# Join page_metadata to responses on pageId for status codes
resp_by_pid = {r["pageId"]: r for r in responses}
for p in pages:
    status = resp_by_pid.get(p["pageId"], {}).get("statusCode")
    print(status, p["url"], p.get("core", {}).get("title"))
```

Key points:

- Use the **long** dataset folder names (`page_metadata`, `navigation`, …). See
  [datasets.md](./datasets.md).
- Join across datasets on **`pageId`**, not `url`. See [identity-and-keys.md](./identity-and-keys.md).
- Read **all** parts in a directory and concatenate.

### Resolving a blob

```python
def read_blob(z, blobRef):
    # blobRef like "sha256/ab/cd/abcd…ef"
    data = z.read(f"blobs/{blobRef}.zst")
    return subprocess.run(["zstd","-d","-","--stdout"], input=data, capture_output=True).stdout
```

Validate that `blobRef` matches `sha256/<2>/<2>/<64hex>` before treating it as an internal path —
see [storage-and-encoding.md](./storage-and-encoding.md).

---

## When the SDK is fixed

Once the folder-map bug is resolved, the high-level reader is the ergonomic path:

```ts
import { openAtlas } from "@atls/sdk";

const atlas = await openAtlas("./crawl.atls");
for await (const page of atlas.readers.pageMetadata()) {
  console.log(page.url, page.title);   // flattened by pageMetadataMapping
}
atlas.close();
```

The SDK's low-level `iterateParts(zipHandle, "page_metadata")` already works today if you pass the
long folder name explicitly — it bypasses the broken folder resolution. Full API in the
[Atlas SDK reference](../../atlas-sdk/README.md).

---

_Last verified against codebase: 2026-06-04._
