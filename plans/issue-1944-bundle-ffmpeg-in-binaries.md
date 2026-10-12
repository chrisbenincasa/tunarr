# Bundle ffmpeg with binary releases (#1944)

> **Status (10/09/2026):** Draft, revised after review. Nothing implemented. No open decisions except the Meilisearch slim build (lever 1).

## Goal

- Linux and Windows binary releases ship ffmpeg/ffprobe, the same way the Docker image does.
- macOS users install ffmpeg 7.x with Homebrew, and Tunarr finds it automatically.
- Docker and binaries always run the same ffmpeg version, read from one pin.
- A fresh install works with no ffmpeg setup.
- Users can still point Tunarr at their own ffmpeg. Tunarr never rewrites that path, but warns when it differs from the bundled one.
- Shrink the release archives so bundling ffmpeg doesn't make them unreasonable.

## Decisions

| Topic | Decision |
| --- | --- |
| Version | One version for Docker and binaries. Ship **7.1.1** now. Move both to **8.1.2** together as part of the etv-next work, after more testing. |
| Packaging | Always bundle. One archive per platform. No ffmpeg-free variant. |
| macOS | No bundled ffmpeg. Users run `brew install ffmpeg@7` (includes VideoToolbox). Tunarr detects the Homebrew path. |
| User paths | Never overridden. Settings › FFmpeg shows a warning banner when the configured path differs from the bundled one. |

## Current state

| Piece | Today |
| --- | --- |
| Docker | `FROM ghcr.io/ersatztv/ersatztv-ffmpeg:7.1.1`. The tag lives in the `Dockerfile` `ARG base_image_tag` and in each `base_tag` of the `build-and-push-docker.yml` matrix. |
| Binary archives | `make-bin.ts --output-archives` packs the pkg executable + `meilisearch`. No ffmpeg. |
| macOS DMG | `bundle-macos.sh` copies the executable + `meilisearch` into `Tunarr.app/Contents/MacOS`. `AppDelegate.swift` passes `TUNARR_MEILISEARCH_PATH`. |
| Settings default | `ffmpegExecutablePath` / `ffprobeExecutablePath` default to `/usr/bin/ffmpeg` / `/usr/bin/ffprobe` (`types/src/schemas/settingsSchemas.ts:89-90`). Saved to `settings.json` on first run. Wrong on Windows and on most Macs. |
| Docs | `docs/getting-started/installation.md:42` tells binary users to fetch ErsatzTV 7.1.1 themselves. |
| Precedent | Meilisearch has a download script (`server/scripts/download-meilisearch.ts`), a version pin in `server/package.json` (`meilisearch.version`), and a runtime lookup in `MeilisearchService.ts:524-555`. |

## ffmpeg source

ErsatzTV-ffmpeg GitHub releases. The Docker base image comes from the same project.

| Release | linux64 | linuxarm64 | win64 | macos64 | macosarm64 | SHA256SUMS |
| --- | --- | --- | --- | --- | --- | --- |
| `7.1.1` | 116 MB | 98 MB | 155 MB | **none** | **none** | **none** |
| `8.1.2-4` | 100 MB | 84 MB | 128 MB | 38 MB | 32 MB | yes |

- 7.1.1 has no checksum file, so we compute the hashes once and pin them in the repo.
- 8.1.2-4 linux64 was tested on this machine. It links only against base glibc libraries and supports VAAPI, QSV, NVENC, and Vulkan. 7.1.1 should be checked the same way in Phase 1.

## macOS via Homebrew

ErsatzTV publishes no macOS build of 7.1.1, so macOS follows the existing user recommendation.

- Users run `brew install ffmpeg@7`. That formula is at **7.1.5** today, a patch release on the same 7.1 line as Docker's 7.1.1. It includes VideoToolbox.
- `ffmpeg@7` is keg-only, meaning Homebrew doesn't link it onto the PATH. The binaries live at:
  - Apple Silicon: `/opt/homebrew/opt/ffmpeg@7/bin/{ffmpeg,ffprobe}`
  - Intel: `/usr/local/opt/ffmpeg@7/bin/{ffmpeg,ffprobe}`
- Docs must say `ffmpeg@7`, not `ffmpeg`. Plain `brew install ffmpeg` installs 9.0.2.
- The Homebrew build links against ~43 Homebrew packages, so it can't be copied into the DMG.
- When the pin moves to 8.1.2, ErsatzTV's macOS builds exist, and macOS can switch to bundling. The signing work is listed under Phase 4 for that move.

## Why the archives are ~130 MB

Measured on `tunarr-v2026.10.0-linux-x64.tar.gz` (131 MB):

| Part | Raw | gzip | Note |
| --- | --- | --- | --- |
| `meilisearch` | 139 MB | 96 MB | **73% of the download.** Upstream binary, not stripped. |
| `tunarr-*` executable | 110 MB | 35 MB | Node 22.20 runtime (74 MB) plus ~36 MB of pkg payload. |

- Meilisearch is large mainly because the upstream build includes every language tokenizer, and the CJK dictionaries are big. Stripping it saves only ~2 MB compressed.
- The pkg payload packs all of `./dist/**/*`. That includes web source maps (~15 MB raw) and the esbuild `meta.json` (3.7 MB), and neither is needed at runtime.
- xz compresses better than gzip here. It brings Meilisearch to 88 MB (−8 MB) and the executable to 24 MB (−10 MB).
- Adding 7.1.1 linux64 unchanged adds ~116 MB, for a total of ~245 MB.

The reduction levers, in order of impact:

1. **Build Meilisearch ourselves without the CJK/Thai tokenizers.** Meilisearch exposes per-language tokenizer cargo features. This needs to be confirmed against the pinned version, and the savings measured. Cost: we own a Rust build for 5 targets plus the CI time, and search loses CJK segmentation. Check whether Tunarr users need CJK search before doing this.
2. **Exclude source maps and `meta.json` from the pkg assets.** This is a small `make-bin.ts` change, saving ~5 MB compressed.
3. **Switch the Linux/macOS archives to `.tar.xz`.** This saves ~18 MB today and more once ffmpeg is in the archive. Users who script downloads against `.tar.gz` names need a release note.
4. **Repack ffmpeg with only `ffmpeg`, `ffprobe`, and `LICENSE.txt`.** This drops the upstream `doc/`, `man/`, and `presets/` directories, which saves little but is free.
5. Drop the pkg `--debug` flag, which `make-bin.ts` always passes. This doesn't change size, but it's noise in the build logs.

Levers 2–4 go in with the bundling work. Lever 1 is its own decision and its own PR.

## Design

### Single version pin

- `server/package.json` gains `"ffmpeg": { "version": "7.1.1", "assets": { "<arch>": { "name": "...", "sha256": "..." } } }`, next to `meilisearch`.
- `build-and-push-docker.yml` reads `base_tag` from that field (`jq -r .ffmpeg.version server/package.json`) instead of hardcoding it in the matrix.
- The `Dockerfile` `ARG base_image_tag` default stays for local builds. A CI check fails when it differs from the pin.
- The 8.1.2 move then changes the pin and the asset hashes, and nothing else.

### Build side

- Add a new `server/scripts/download-ffmpeg.ts`, modeled on `download-meilisearch.ts`.
  - It maps each Tunarr arch to an ErsatzTV asset (`linux-x64`→`linux64`, `linux-arm64`→`linuxarm64`, `win-x64`→`win64`, plus macOS once a build exists).
  - It verifies the pinned SHA-256 and fails the build on a mismatch.
  - It extracts only `bin/ffmpeg*`, `bin/ffprobe*`, and `LICENSE.txt` into `server/bin/ffmpeg-<arch>/`.
  - It skips the download when the cached copy's hash already matches.
  - It errors clearly for `alpine-x64`, which has no musl build.
- `make-bin.ts` always bundles ffmpeg when `--output-archives` is set. The archive layout stays flat:

  ```
  tunarr-<ver>-<arch>[.exe]
  meilisearch[.exe]
  ffmpeg[.exe]
  ffprobe[.exe]
  FFMPEG-LICENSE.txt
  FFMPEG-SOURCE.txt   # ErsatzTV release URL for the pinned tag
  ```

- `build-and-release-binary.yml` needs no new flags. The upload glob changes only if lever 3 (xz archives) lands.
- macOS DMG build is unchanged for 7.x. See the 8.1.2 row under Phases for what changes later.

### Runtime side

The "bundled ffmpeg" is whatever ships with this install. Each distribution says where it lives:

| Distribution | Bundled location comes from |
| --- | --- |
| Docker | `ENV TUNARR_BUNDLED_FFMPEG_DIR=/usr/local/bin` in the `Dockerfile` |
| macOS (7.x) | The Homebrew `ffmpeg@7` paths above, whichever exists. This is the "expected" ffmpeg, not a bundled one. |
| macOS (8.1.2 move) | `AppDelegate.swift` sets `TUNARR_BUNDLED_FFMPEG_DIR` to `Contents/MacOS` |
| Linux / Windows archive | `dirname(process.execPath)`, only when running as a pkg binary |
| Dev (`pnpm dev`) | None. No banner. |

- In `server/src/util/env.ts`, add `TUNARR_BUNDLED_FFMPEG_DIR`.
- Add a new `server/src/util/bundledFfmpeg.ts` with `findBundledFfmpeg(): Maybe<{ ffmpegPath, ffprobePath }>`.
  - On macOS it checks the two Homebrew `ffmpeg@7` locations. The function name stays the same, because callers only care where the expected ffmpeg lives.
  - It returns a pair only if both binaries exist. It never returns half a pair.
  - It uses `process.execPath` rather than `cwd`, because users often launch the binary from another directory (systemd units, Windows shortcuts).
- First-run seeding: `defaultSettings()` in `server/src/db/SettingsDB.ts` uses the bundled pair when one is found. Otherwise it uses the current schema default. This only applies when no `settings.json` exists, so nothing is overridden.
- Existing installs: no automatic changes.
- In the API, `systemApi` exposes `bundledFfmpeg: { ffmpegPath, ffprobePath, version } | null`.

### Warning banner

- The banner lives on the Settings › FFmpeg page.
- It shows when `bundledFfmpeg` is non-null and either configured path differs from the bundled one. Paths are compared after `path.resolve`, and case-insensitively on Windows.
- Suggested text: "Tunarr is using a custom ffmpeg at `<path>`. This install includes ffmpeg 7.1.1 at `<bundled path>` (on macOS: "Homebrew ffmpeg@7 is installed at `<path>`"), which is the version Tunarr is tested against. Custom builds may break streaming or hardware acceleration."
- It has a single action, "Use bundled ffmpeg". That action sets both paths through the existing settings API.
- It's a warning, so it never blocks saving.
- This covers Docker too. Today a Docker user can point at a custom ffmpeg with no warning.
- The onboarding FFmpeg step shows "Bundled ffmpeg detected" instead of download links. On macOS with no Homebrew ffmpeg found, it shows `brew install ffmpeg@7` with a copy button. Coordinate this with `~/Code/plans/tunarr/onboarding-idiot-proof-setup-and-hw-accel.md` §2.3, which plans changes to the same step.
- The `FfmpegVersionHealthCheck` missing-ffmpeg text names the bundled path when one exists.

### Docs

- Update `docs/getting-started/installation.md`. Linux and Windows binaries now include ffmpeg 7.1.1. macOS users run `brew install ffmpeg@7`, and Tunarr picks it up automatically. Explain the banner, and explain that a custom path still works.
- Cover GPL obligations. The archive carries `FFMPEG-LICENSE.txt` and points at ErsatzTV's source for the pinned tag. Tunarr itself stays zlib. Shipping the ffmpeg executable next to Tunarr is aggregation, the same arrangement the Docker image already uses.
- State that host GPU drivers (`libva`, Intel media driver, NVIDIA driver) are still the user's job.

## Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 1 | Version pin, `download-ffmpeg.ts`, always-bundle in `make-bin`, size levers 2–4, Docker workflow reads the pin | A `workflow_dispatch` run produces archives with ffmpeg 7.1.1, verified hashes, and measured sizes |
| 2 | `findBundledFfmpeg`, Docker `ENV`, first-run seeding, `systemApi` field, tests | An unpacked archive on a clean machine streams a channel with zero settings changes |
| 3 | Banner, onboarding step, health-check text, docs | The banner shows for a custom path in both Docker and a binary, and "Use bundled" clears it; the e2e route sweep passes |
| 4 | macOS Homebrew detection, plus the onboarding `brew install ffmpeg@7` hint | A Mac with `ffmpeg@7` installed streams with zero settings changes |
| — | Meilisearch slim build (lever 1) | A separate decision and PR |
| — | 8.1.2 for Docker and binaries | Part of the etv-next work. A pin and hash change for Linux/Windows. macOS switches to bundling ErsatzTV's build in the DMG, which needs `bundle-macos.sh` changes, explicit `--options=runtime` signing in `sign-macos.sh`, and the `AppDelegate` env. |

Phases 1–3 target `main`.

## Tests

- Unit tests for `findBundledFfmpeg`: env dir vs `execPath`, both macOS Homebrew paths, the pair requirement, Windows `.exe` names, and the dev case (no pkg) returning nothing.
- Unit tests for first-run seeding: it picks the bundled paths, and an existing `settings.json` is left untouched.
- Unit tests for banner logic: path normalization, Windows case-insensitivity, and a null `bundledFfmpeg` hiding the banner.
- Unit tests for `download-ffmpeg.ts`: the arch-to-asset mapping and failure on a checksum mismatch.
- CI: after `make-bin`, list the archive and run the bundled `ffmpeg -version` on Linux x64.
- CI: assert the `Dockerfile` default tag equals the pin.

## Risks

- **Archive size.** At ~245 MB before the levers, and ~210–220 MB with levers 2–4 (an estimate, measured in Phase 1), most of the remaining weight is Meilisearch, so lever 1 matters.
- **The win64 7.1.1 zip is 155 MB.** Check whether it is a static build or ships DLLs before extracting only `bin/ffmpeg.exe`.
- **macOS version skew.** Homebrew moves `ffmpeg@7` along 7.1.x on its own schedule (7.1.5 today). Patch releases on the same line should be safe, but the banner and the docs should name 7.1.x, not 7.1.1.
- **Homebrew removes `ffmpeg@7`.** Versioned formulae get deprecated eventually. The 8.1.2 move should land before that happens.
- **Upstream availability.** The pinned tag plus pinned hashes make a missing or changed asset fail loudly at build time.

## Out of scope

- Alpine/musl builds.
- Auto-updating ffmpeg separately from Tunarr releases.
- The 8.1.2 move itself (etv-next).
