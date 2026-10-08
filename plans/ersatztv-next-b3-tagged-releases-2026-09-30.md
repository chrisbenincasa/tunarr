# ErsatzTV next — B3 tagged releases

> **Status (10/07/2026):** Planned and grilled. Mostly resolved upstream. #309 and #310 (merged 10/07) added computed semver, a changelog, and per-commit develop builds published as immutable releases in `ErsatzTV/next-develop-builds`. Tunarr pins `v0.2.0-96aa6cb6-develop` by tag and per-target SHA-256 in `dc4d74269`. No stable release exists yet. The workflow PR in the old §2 is obsolete and was not sent. Next step is to ask for the first stable tag once B2, B6 and B8 land (§3), and to file the notices issue (§4).

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md). B3 is the ship gate.

## 1. Verified state at `96aa6cb`

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
- `prep-release.sh:63` refers to a `release.yml` preflight. No `release.yml` is committed yet, so nothing builds or publishes on a `v*` tag.
- Only `v0.1.0` exists, still with no release object. `[Unreleased]` already holds the 0.1.0 channel config breaking change, so the first stable tag will be `v0.2.0`.

### Version string

- `artifacts.yml` sets `ETV_VERSION="${TAG#v}+${target}"`. A develop build prints `0.2.0-96aa6cb6-develop+linux-x64`, and a tagged build will print `0.2.0+linux-x64`.
- A source build without `ETV_VERSION` prints `<crate version>+local` (`crates/ersatztv-core/build.rs`).
- Confirmed by running the `linux-x64` binary from `v0.2.0-96aa6cb6-develop`.

## 2. Upstream change

None needed from Tunarr. The draft-then-publish flow this plan proposed is what `develop.yml` does, and the stable flow is in progress upstream.

Upstream is MIT. Bundling is allowed if the copyright notice ships with the binary.

## 3. Upstream conversation

- Ask for one thing, the first stable tag (`v0.2.0`) once B2, B6 and B8 are on `main`.
- Ask whether `release.yml` will publish to `ErsatzTV/next` with the same six asset names, so Tunarr's download needs only a repo and tag change.
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
| 6   | Fallback mirror                 | Dropped. Develop builds are immutable, so a pin is durable until pruned. Revisit only if no stable tag comes                   |

### 4.2 Changes

| When                       | Change                                                                                                                 | Where                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Done 10/01                 | Pin moved to `570d136`. The channel config carries `ChannelConfigVersion`                                              | `a21a254bb`                                      |
| Done 10/01                 | Exact-string version check in `EtvNextVersion.ts`, shared with the download script                                     | `f926b2b51`                                      |
| Done 10/07                 | Pin `v0.2.0-96aa6cb6-develop` by `releaseRepo`, `releaseTag`, `commit` and per-target `sha256`. `assetVersion` is gone | `dc4d74269`, `server/package.json`               |
| Done 10/07                 | Download verifies the archive's SHA-256 and writes nothing on mismatch                                                 | `server/scripts/download-ersatztv-next.ts`       |
| Done 10/07                 | Version check drops build metadata before comparing                                                                    | `server/src/stream/etv/EtvNextVersion.ts`        |
| Now                        | File the third-party notices issue (decision 5)                                                                        | GitHub issue                                     |
| After the first stable tag | Set `releaseRepo` to `ErsatzTV/next` and `releaseTag` to the tag. Fill `sha256` from the release API `digest`          | `server/package.json`                            |
| After the first stable tag | Flip the resolver from warn to refuse for the bundled binary. Keep warning under `ERSATZTV_NEXT_PATH`                  | `server/src/stream/etv/EtvNextBinaryResolver.ts` |
| After the first stable tag | Run the full pin bump from blockers plan §5                                                                            | `server/src/stream/etv/schema/`, `generated/`    |

## 5. If no stable tag comes

- Keep pinning develop builds. Each pin lasts until 100 newer develop builds publish. The maintainer triggers builds by hand, so the pace is unknown.
- Before a Tunarr release that bundles the worker, check that the pinned develop release still exists.
- A Tunarr-owned mirror is needed only if upstream stops publishing develop builds too.

## 6. Done when

- An upstream `v*` tag has a published release with all six targets attached (`windows-x64`, `linux-x64`, `linux-musl-x64`, `linux-arm64`, `macos-x64`, `macos-arm64`).
- `server/package.json` pins that tag plus per-target SHA-256.
- Tunarr refuses a bundled binary whose version differs from the pin, and warns under `ERSATZTV_NEXT_PATH`.
- Prerequisite, tracked separately: Tunarr's bundle ships third-party notices for `ersatztv-channel` and Meilisearch.
