# Custom Error Screen and Audio (#1292)

> **Status (11/09/2026):** Proposed. Scope settled 11/09/2026 (settings on the transcode config, file/URL/upload only, legacy bugs fixed separately). No code yet. Next step: build phase 1.

Issue: https://github.com/chrisbenincasa/tunarr/issues/1292. Asks for a custom error image or looping video, plus custom audio, from a file or a media server.

## Decisions

| Question                | Decision                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where the setting lives | Transcode config, next to `errorScreen` / `errorScreenAudio`. Shared across channels.                                                                                          |
| Media sources           | Local path, http(s) URL, or upload.                                                                                                                                            |
| Media-server items      | Deferred. Error screens often play because the media server is unreachable, so a server-hosted clip fails when it is needed. A later version can copy the picked item locally. |
| Image vs. video         | One `custom` value. Probe the file to tell a still image from a video.                                                                                                         |
| Target branch           | `main`. Medium feature with one migration.                                                                                                                                     |
| Legacy-path bugs        | Separate PRs. See "Out of scope".                                                                                                                                              |

## Current state

- `errorScreen`: `static | pic | blank | testsrc | text | kill`. `errorScreenAudio`: `silent | sine | whitenoise`.
  - Drizzle enums and CHECK constraints: `server/src/db/schema/TranscodeConfig.ts:108-119`, `:186-225`
  - Duplicated in `types/src/schemas/settingsSchemas.ts:33` (`SupportedErrorScreens`, `SupportedErrorAudioTypes`)
- `pic` always plays the bundled `/images/generic-error-screen.png`.
- Two error renderers:
  - Legacy ffmpeg: `createErrorSession` and `createPlaceholderAudioInput`, `server/src/ffmpeg/FfmpegStreamFactory.ts:786`, `:1080`
  - ErsatzTV next: `errorVideo` / `errorAudio`, `server/src/stream/etv/EtvNextPlayoutItemMapper.ts:287-330`. Inputs come from `screenOptions`, `EtvNextPlayoutWriter.ts:338`.
- Parts to reuse:
  - Offline soundtrack loop, legacy: `createOfflineSoundtrackInput`, `FfmpegStreamFactory.ts:1030` (probe, then loop via `loopableInputLocation`)
  - Offline soundtrack loop, ETV next: `loopedSoundtrack`, `EtvNextPlayoutItemMapper.ts:114` (`amovie=...:loop=0`)
  - Image source, ETV next: `fileOrHttpSource`
  - Input looping, legacy: `InfiniteLoopInputOption` (used for watermarks)
  - Uploads: `/upload/image`, `/upload/audio` in `server/src/api/index.ts:174,207`
  - Upload UI: `FileUploadInput`, used by `web/src/components/channel_config/ChannelFlexConfig.tsx`

## Design

### Schema

- Add `'custom'` to `ErrorScreenTypes` and `ErrorScreenAudioTypes`, and to both lists in `settingsSchemas.ts`.
- New nullable text columns on `transcode_config`:
  - `error_screen_path`: image or video, path or URL
  - `error_screen_audio_path`: audio file, path or URL
- Zod refinement on the transcode config schema: `custom` requires a non-empty matching path.
- Migration via `/new-migration`. The CHECK constraints change, so Drizzle rebuilds the table (same shape as `0047_eac3_audio_format_constraint.sql`).

### Media resolution

New helper, shared by both paths, e.g. `server/src/stream/ErrorScreenMediaResolver.ts`:

- Input: the transcode config.
- Probe `error_screen_path` with `ffmpegInfo.probeFile` and a short timeout (match `SoundtrackProbeTimeoutMs`).
- Classify:
  - still image when the video stream's codec is an image codec (`png`, `mjpeg`, `bmp`, `webp`, `gif` with one frame) or the format has no duration
  - otherwise video
- Probe `error_screen_audio_path` and require an audio stream.
- Output: `{ video: { kind: 'image' | 'video', location } | undefined, audio: location | undefined }`.
- Probe failure or missing file: log a warning and return `undefined` for that half. Callers fall back to `pic` / `silent`. An error screen must never error.
- Cache results per path and file mtime, so a channel that errors in a loop doesn't re-probe every item.

### Legacy ffmpeg path

- `createErrorSession`, new `case 'custom'`:
  - image: same as `pic`, but with the configured location
  - video: `VideoInputSource` with a video stream from the probe, plus `InfiniteLoopInputOption`. Use `cache:` for http through `loopableInputLocation`.
  - unresolved: fall through to the `pic` input
- `createPlaceholderAudioInput`, new `case 'custom'`: build the audio input the same way `createOfflineSoundtrackInput` does. Pull the shared body into a helper that takes a location, rather than copying it.
- The method becomes async, so update its caller.

### ErsatzTV next path

- `ScreenOptions` gains the resolved media from the helper. `screenOptions` in `EtvNextPlayoutWriter.ts` becomes async, or the writer resolves once per playout write.
- `errorVideo`, new `case 'custom'`:
  - image: `fileOrHttpSource(location)`
  - video: lavfi `movie=filename=<escaped>:loop=0,setpts=N/FRAME_RATE/TB`. This is the video twin of `loopedSoundtrack`. Playout sources have no loop flag.
  - unresolved: the generic picture, with a reason pushed to `ignored`
- `errorAudio`, new `case 'custom'`: `loopedSoundtrack(location)`, or `silentAudio` when unresolved.
- `EtvNextChannelConfigMapper.ts:386` (`show_error`) needs no change.

### Web

`web/src/components/settings/ffmpeg/TranscodeConfigErrorOptions.tsx`:

- Add `custom` to both dropdowns ("Custom image or video", "Custom audio").
- Show a path field with an upload button under each dropdown when `custom` is selected. Image upload goes to `/upload/image`. Video needs an upload route (see Phase 3).
- Update `defaultNewTranscodeConfig.ts` (paths default to `null`).
- Regenerate the client with `/regen-api`.

### Docs

- `docs/configure/ffmpeg/transcode_config.md`: describe the new options and fallback behavior.
- `docs/configure/ffmpeg/ersatztv-next.md`: update if it lists error screen support.
- Blog post for the release that ships it.

## Phases

| Phase | Contents                                                                                                                      | Ships alone? |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1     | Schema, migration, resolver, custom image and custom audio on both paths, web fields using path + existing image/audio upload | Yes          |
| 2     | Looping video on both paths                                                                                                   | Yes          |
| 3     | `/upload/video` route (MIME prefix `video/`, size cap) and an upload button for video                                         | Yes          |

Phase 2 holds the only new mechanism, `movie=...:loop=0`. Phases 1 and 3 reuse existing code.

## Tests

- Resolver: image vs. video classification, missing file, probe timeout, no audio stream, cache hit.
- `EtvNextPlayoutItemMapper`: `custom` image, video, and unresolved, for video and audio. Assert the lavfi string escapes paths with `:` and `'`.
- `FfmpegStreamFactory`: `custom` builds the expected inputs. Unresolved falls back to `pic` / `silent`.
- Schema: `custom` without a path is rejected. Round-trip through the transcode config DB layer.
- Web: the path field appears only for `custom`. The form submits the path.
- stream-repro (phase 2): a 3 s clip as error video on a channel with a broken program, on both paths. Check that the loop has no timestamp gaps or overlaps across a 30 s capture.

## Risks

- **Pixel format and frame rate of user videos.** A 10-bit or VFR clip must pass the same normalization real programs get. On the legacy path, build the stream from the probe as `buildVideoInput` does. On ETV next, the worker normalizes.
- **`movie` on http URLs.** It reads through ffmpeg's protocols, so `cache:` should work as it does for `amovie`. Verify in phase 2.
- **Uploaded video size.** Phase 3 needs a size cap so an upload can't fill the disk.
- **Moved or deleted files.** The resolver falls back. The UI could also warn on save if the probe fails.

## Out of scope

Separate PRs:

- Legacy `blank` throws `new Error('')` (`FfmpegStreamFactory.ts:827`) instead of playing black.
- Legacy `kill` sends `SIGTERM` to the whole Tunarr process (`FfmpegStreamFactory.ts:838`). ETV next throws `StreamTerminationRequestedError` instead.

Also out of scope: per-channel error overrides, and using media-server items as error media.
