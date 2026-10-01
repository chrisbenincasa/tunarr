# ErsatzTV next — B3 tagged releases

> **Status (10/01/2026):** Planned and grilled. Pin moved to `570d136` in `a21a254bb`, and the exact-string version check landed. Upstream state re-verified at `570d136`. Nothing filed. Next steps are the notices issue in §4 and the upstream conversation in §3, with the workflow PR in §2 ready to send.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md). B3 is the ship gate.

## 1. Verified state at `570d136`

- `ci.yml` is the only caller of `artifacts.yml`. It runs on push to `main` and on `workflow_dispatch`, always passes `release_tag: develop`, and calls `artifacts.yml@main` rather than the local file.
- `ci.yml` also builds Docker images through `docker.yml`.
- `artifacts.yml` is `workflow_call` only. Nothing triggers it on a tag push.
- `artifacts.yml:283` deletes the previous asset per target only when `release_tag == 'develop'`. A tagged release keeps its assets.
- **No step creates a GitHub release.** `artifacts.yml:294` runs `gh release upload <tag>`, which fails if the release does not exist.
- Tag `v0.1.0` exists with no release object. A tag alone fixes nothing, so a small caller workflow is needed.
- `release_version` comes from `git describe --tags --abbrev=0` plus the short SHA. Every `develop` asset is named `v0.1.0-<sha>`. After a `v0.2.0` tag, `develop` builds print `0.2.0-<sha>`.
- **A `develop` pin dies on the next upstream push.** The `091e174` asset was deleted when `570d136` landed on 10/01/2026, so the download 404'd and `make-bin.ts:166` threw.
- No checksum file is published. GitHub's release API exposes a `digest` (`sha256:…`) per asset.
- Upstream is MIT. Mirroring and bundling are allowed if the copyright notice ships with the binary.

## 2. Upstream change

One PR, `ci: publish tagged releases`.

- New `.github/workflows/release.yml`, triggered on `push: tags: ['v*']`.
- Job `create_release` runs `gh release create "$TAG" --verify-tag --draft --prerelease --generate-notes`. Use `--prerelease` while the version is `0.x`.
- Job `build_and_upload` has `needs: create_release` and calls `./.github/workflows/artifacts.yml` (the local file, so the tag builds with its own workflow) with:
  - `release_tag: ${{ github.ref_name }}`
  - `release_version: ${{ github.ref_name }}`
  - `info_version`: the tag without its leading `v`
  - the same secrets block `ci.yml` passes.
- Job `publish` has `needs: build_and_upload` and runs `gh release edit "$TAG" --draft=false`. A failed target leaves an invisible draft, never a partial public release.
- No Docker images on tags. Say so in the PR description so it reads as intentional.
- No change to `artifacts.yml`. Its delete step already skips non-`develop` tags.
- Optional, ask first: upload a `SHA256SUMS` asset. Tunarr reads the API `digest` instead, so this is a convenience.

Test by pushing a throwaway tag such as `v0.1.1-rc.1` to a fork with the signing secrets stubbed. The test must confirm that `gh release upload` works against a draft. Alternatively, ask the maintainer to cut the first tag and watch the run.

## 3. Upstream conversation

- Open a short issue, or message the maintainer, before the PR. The PR is trivial, but the cadence is his call.
- Ask for one thing, which is a tag after each batch of fixes Tunarr depends on.
- Offer to do the asking, so the habit costs him one `git tag` and one `git push`.
- Mention that `v0.1.0` has no release object, so the first tag also proves the workflow.

## 4. Tunarr follow-up

### 4.1 Decisions

| #   | Question                        | Decision                                                                                                                     |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Refuse or warn on version drift | Warn until the first tag. After it, refuse the bundled binary. Under `ERSATZTV_NEXT_PATH`, warn only                         |
| 2   | What builds use before a tag    | Hold the gate. No ErsatzTV next work merges into `main` or `dev` until a tag exists. Developers use `ERSATZTV_NEXT_PATH`     |
| 3   | When the release goes public    | Draft first. Publish after all six targets upload                                                                            |
| 4   | What the startup check compares | Exact string. `--version` output equals `assetVersion` without its `v`, the rule `needsToDownloadNewBinary` already uses     |
| 5   | MIT notice in Tunarr's bundle   | Separate issue, covering Meilisearch too. Prerequisite for the first release that bundles `ersatztv-channel`                 |
| 6   | Where a fallback mirror lives   | A separate Tunarr-owned repo with GitHub releases, never the Tunarr repo, whose release events fire Docker and binary builds |

### 4.2 Changes

| When                | Change                                                                                                                                                                                                 | Where                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Done 10/01          | Pin moved to `570d136`. The channel config now carries `ChannelConfigVersion`, which the worker requires                                                                                               | `a21a254bb`                                      |
| Done 10/01          | Replaced `matchesPinnedCommit` with the exact-string check in `EtvNextVersion.ts`, shared with the download script. Keep warning on mismatch. `commit` stays in `package.json` as the vendoring record | `server/src/stream/etv/EtvNextVersion.ts`        |
| Now                 | File the third-party notices issue (decision 5)                                                                                                                                                        | GitHub issue                                     |
| After the first tag | Set `releaseTag` and `assetVersion` to the tag. Drop the `note` that says the pin is not durable                                                                                                       | `server/package.json`                            |
| After the first tag | Add `sha256` per target, filled from the release API `digest`. Verify after download and fail on mismatch. Hashing a `develop` asset is pointless, because it 404s first                               | `server/scripts/download-ersatztv-next.ts`       |
| After the first tag | Flip the resolver from warn to refuse for the bundled binary. Keep warning under `ERSATZTV_NEXT_PATH`                                                                                                  | `server/src/stream/etv/EtvNextBinaryResolver.ts` |
| After the first tag | Run the full pin bump from blockers plan §5. Schemas, generated Zod and both version constants move in the same commit                                                                                 | `server/src/stream/etv/schema/`, `generated/`    |

`--version` prints `ersatztv_core::VERSION`, which is `info_version`. A tagged build prints `0.2.0`. A `develop` build prints `0.2.0-<sha>`.

## 5. If tags don't come

- **Deadline:** 10/31/2026.
- **Where:** a separate repo, for example `chrisbenincasa/ersatztv-next-builds`, with one release per mirrored commit.
- **What:** upstream's six signed `develop` assets, copied byte for byte. No rebuild, so the macOS and Windows signatures survive.
- **Tunarr side:** the download script changes only the owner and repo. URL shape and the API `digest` stay the same.
- **Tooling:** a short script that copies the assets and records their hashes. Write it only if the fallback triggers.
- **Cost:** Tunarr becomes the release manager for someone else's binary.

## 6. Done when

- An upstream `v*` tag has a published release with all six targets attached (`windows-x64`, `linux-x64`, `linux-musl-x64`, `linux-arm64`, `macos-x64`, `macos-arm64`).
- `server/package.json` pins that tag plus per-target SHA-256.
- Tunarr refuses a bundled binary whose `--version` differs from `assetVersion`, and warns under `ERSATZTV_NEXT_PATH`.
- Prerequisite, tracked separately: Tunarr's bundle ships third-party notices for `ersatztv-channel` and Meilisearch.
