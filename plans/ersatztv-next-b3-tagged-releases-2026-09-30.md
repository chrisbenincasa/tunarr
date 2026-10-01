# ErsatzTV next — B3 tagged releases

> **Status (09/30/2026):** Planned. Verified against upstream `091e174`. Nothing filed. Next step is the upstream conversation in §3, with the workflow PR in §2 ready to send.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md). B3 is the ship gate.

## 1. Verified state at `091e174`

- `ci.yml` is the only caller of `artifacts.yml`. It runs on push to `main` and on `workflow_dispatch`, and it always passes `release_tag: develop`.
- `artifacts.yml` is `workflow_call` only. Nothing triggers it on a tag push.
- `artifacts.yml:283` deletes the previous asset per target only when `release_tag == 'develop'`. A tagged release keeps its assets.
- **No step creates a GitHub release.** `artifacts.yml:294` runs `gh release upload <tag>`, which fails if the release does not exist.
- Tag `v0.1.0` exists, but `gh release view v0.1.0` returns "release not found". So the register's claim that a tag "fixes it with no new pipeline" was wrong. A small caller workflow is needed.
- `release_version` comes from `git describe --tags --abbrev=0` plus the short SHA. Every `develop` asset since March is therefore named `v0.1.0-<sha>`.
- `artifacts.yml:201` uses SHA-256 only for Windows Authenticode signing. No checksum file is published. GitHub's release API does expose a `digest` (`sha256:…`) per asset.

## 2. Upstream change

One PR, `ci: publish tagged releases`.

- New `.github/workflows/release.yml`, triggered on `push: tags: ['v*']`.
- Job `create_release` runs `gh release create "$TAG" --verify-tag --prerelease --generate-notes`. Use `--prerelease` while the version is `0.x`.
- Job `build_and_upload` calls `artifacts.yml` with:
  - `release_tag: ${{ github.ref_name }}`
  - `release_version: ${{ github.ref_name }}`
  - `info_version`: the tag without its leading `v`
  - the same secrets block `ci.yml` passes.
- No change to `artifacts.yml`. Its delete step already skips non-`develop` tags.
- Optional, ask first: upload a `SHA256SUMS` asset. Tunarr can read the API `digest` instead, so this is a convenience.

Test by pushing a throwaway tag such as `v0.1.1-rc.1` to a fork with the signing secrets stubbed, or ask the maintainer to cut the first tag and watch the run.

## 3. Upstream conversation

- Open a short issue, or message the maintainer, before the PR. The PR is trivial, but the cadence is his call.
- Ask for one thing, which is a tag after each batch of fixes Tunarr depends on.
- Offer to do the asking, so the habit costs him one `git tag` and one `git push`.
- Mention that `v0.1.0` has no release object, so the first tag also proves the workflow.

## 4. Tunarr follow-up

Some of this can land before upstream moves, because main plan §12 says to pin by content regardless.

| When                | Change                                                                                                                                            | Where                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Now                 | Add `sha256` per target to `ersatztvNext` in `server/package.json`. Verify after download and fail on mismatch. The script does no hashing today. | `server/scripts/download-ersatztv-next.ts`       |
| Now                 | Exec `ersatztv-channel --version` at startup and refuse the backend on mismatch, naming both versions.                                            | `server/src/stream/etv/EtvNextBinaryResolver.ts` |
| After the first tag | Set `releaseTag` and `assetVersion` to the tag. Drop the `note` that says the pin is not durable.                                                 | `server/package.json`                            |
| After the first tag | Fill the hashes from the release API `digest` field instead of downloading each asset by hand.                                                    | small script, or a step in the bump procedure    |
| After the first tag | Run the full pin bump from blockers plan §5. Schemas, generated Zod and the playout schema constant move in the same commit.                      | `server/src/stream/etv/schema/`, `generated/`    |

`--version` prints `ersatztv_core::VERSION`, which is `info_version`. A tagged build prints `0.2.0`. A `develop` build prints `0.1.0-<sha>`. The startup check should compare against the tag without its `v`.

## 5. If tags don't come

Mirror one SHA-256-verified `develop` asset per target into storage Tunarr controls, and point the download script there. This works, but Tunarr becomes the release manager for someone else's binary. Decide by 10/31/2026 whether to fall back.

## 6. Done when

- An upstream `v*` tag has a release with all six targets attached (`windows-x64`, `linux-x64`, `linux-musl-x64`, `linux-arm64`, `macos-x64`, `macos-arm64`).
- `server/package.json` pins that tag plus per-target SHA-256.
- Tunarr refuses a binary whose `--version` differs from the pin.
