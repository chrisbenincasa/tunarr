# ErsatzTV next — B3 tagged releases

> **Status (10/07/2026):** Planned and grilled. Done upstream. #312 added `release.yml`, and `v0.2.0` (`b340569`) was published 10/07 as an immutable release with all six targets. It carries the same code as `96aa6cb`, the develop build Tunarr pins in `dc4d74269`. Next steps are to pin `v0.2.0` from `ErsatzTV/next`, flip the resolver from warn to refuse (decision 1), and file the notices issue (§4).

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md). B3 is the ship gate.

## 1. Verified state at `v0.2.0`

### Develop builds

- `develop.yml` runs on `workflow_dispatch` from `main` only. The maintainer triggers it by hand.
- It creates a draft release in `ErsatzTV/next-develop-builds`, uploads all six targets through `artifacts.yml`, checks them with `verify-draft.sh`, then publishes.
- Tags look like `v0.2.0-96aa6cb6-develop`. The version is the next release's, computed by `next-version.sh` from `CHANGELOG.md` and schema bumps, so develop builds sort below the release they precede.
- Releases are marked immutable. GitHub's API exposes a `digest` (`sha256:…`) per asset.
- `prune-develop.sh` keeps the newest 100 develop releases (`DEVELOP_KEEP`) and deletes older ones with their tags. **A develop pin eventually 404s.**
- `ci.yml` still runs on every push to `main`, but with `publish: false`. It no longer uploads anywhere.
- The old rolling `develop` release in `ErsatzTV/next` still exists with zero assets. Every URL under it 404s.

### Stable releases

- `prep-release.sh` moves `[Unreleased]` into a dated section, sets the workspace version, and prints the `git tag` and `git push` commands.
- `release.yml` (#312) runs on a `v*` tag push or `workflow_dispatch`. It runs a preflight, creates a draft, uploads the six targets, builds Docker images, and publishes with `--latest`.
- `v0.2.0` (`b340569`, 10/07/2026) is published, immutable, and has all six targets. Asset names follow `ersatztv-next-v0.2.0-<target>`.

### Version string

- `artifacts.yml` sets `ETV_VERSION="${TAG#v}+${target}"`. A develop build prints `0.2.0-96aa6cb6-develop+linux-x64`, and a tagged build will print `0.2.0+linux-x64`.
- A source build without `ETV_VERSION` prints `<crate version>+local` (`crates/ersatztv-core/build.rs`).
- Confirmed by running the `linux-x64` binary from `v0.2.0-96aa6cb6-develop`.

## 2. Upstream change

None needed from Tunarr. Upstream built the draft-then-publish flow this plan proposed, for both develop builds and stable tags.

Upstream is MIT. Bundling is allowed if the copyright notice ships with the binary.

## 3. Upstream conversation

- Ask for a tag once B2, B6 and B8 are on `main`. Tunarr ships on that tag.
- No need to offer to manage cadence. The tooling makes a release cheap for the maintainer.

## 4. Tunarr follow-up

### 4.1 Decisions

| #   | Question                        | Decision                                                                                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Refuse or warn on version drift | Warn while pinned to a develop build. After the first stable tag, refuse the bundled binary. Under `ERSATZTV_NEXT_PATH`, warn  |
| 2   | What builds use before a tag    | Hold the gate. No ErsatzTV next work merges into `main` or `dev` until a stable tag exists. Developers may pin a develop build |
| 3   | When the release goes public    | Draft first, publish after all six targets upload. Upstream does this for develop builds                                       |
| 4   | What the startup check compares | `--version` without its build metadata (`+…`) equals `releaseTag` without its `v`                                              |
| 5   | MIT notice in Tunarr's bundle   | Separate issue, covering Meilisearch too. Prerequisite for the first release that bundles `ersatztv-channel`                   |
| 6   | Fallback mirror                 | Dropped. Upstream publishes immutable stable releases                                                                          |

### 4.2 Changes

| When       | Change                                                                                                                 | Where                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Done 10/01 | Pin moved to `570d136`. The channel config carries `ChannelConfigVersion`                                              | `a21a254bb`                                      |
| Done 10/01 | Exact-string version check in `EtvNextVersion.ts`, shared with the download script                                     | `f926b2b51`                                      |
| Done 10/07 | Pin `v0.2.0-96aa6cb6-develop` by `releaseRepo`, `releaseTag`, `commit` and per-target `sha256`. `assetVersion` is gone | `dc4d74269`, `server/package.json`               |
| Done 10/07 | Download verifies the archive's SHA-256 and writes nothing on mismatch                                                 | `server/scripts/download-ersatztv-next.ts`       |
| Done 10/07 | Version check drops build metadata before comparing                                                                    | `server/src/stream/etv/EtvNextVersion.ts`        |
| Now        | File the third-party notices issue (decision 5)                                                                        | GitHub issue                                     |
| Now        | Set `releaseRepo` to `ErsatzTV/next` and `releaseTag` to `v0.2.0`. Fill `sha256` from the release API `digest`         | `server/package.json`                            |
| Now        | Flip the resolver from warn to refuse for the bundled binary. Keep warning under `ERSATZTV_NEXT_PATH`                  | `server/src/stream/etv/EtvNextBinaryResolver.ts` |
| Now        | Run the full pin bump from blockers plan §5                                                                            | `server/src/stream/etv/schema/`, `generated/`    |

## 5. Done when

- ✅ An upstream `v*` tag has a published release with all six targets attached. `v0.2.0`, 10/07/2026.
- `server/package.json` pins that tag plus per-target SHA-256.
- Tunarr refuses a bundled binary whose version differs from the pin, and warns under `ERSATZTV_NEXT_PATH`.
- Prerequisite, tracked separately: Tunarr's bundle ships third-party notices for `ersatztv-channel` and Meilisearch.
