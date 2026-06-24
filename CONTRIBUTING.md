# Contributing to Atlas

Thanks for your interest in the Atlas format and SDK.

## Licensing of contributions

This repository is dual-licensed:

- **Code** (the `@atls/spec` and `@atls/sdk` packages and all other source) —
  **Apache License 2.0** ([`LICENSE`](./LICENSE)).
- **Specification & JSON Schemas** — additionally **CC BY 4.0**
  ([`LICENSE-SPEC.md`](./LICENSE-SPEC.md)).

By submitting a contribution, you agree that your contribution is licensed
under the same terms as the part of the repository it touches.

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/)
instead of a CLA. It's a lightweight statement that you have the right to submit
your work under the project's license.

Certify your contribution by adding a `Signed-off-by` line to each commit:

```
Signed-off-by: Your Name <you@example.com>
```

`git commit -s` adds this automatically. The name and email must be real and
match the commit author.

## Before you open a PR

- `pnpm install`
- `pnpm build` — builds `@atls/spec` then `@atls/sdk` (topological order)
- `pnpm test` — the full suite must pass
- `pnpm lint`

Keep changes focused, and update or add tests for any behavior change.
