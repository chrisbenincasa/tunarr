# Streaming

*Last Updated: 2026-10-02*

Streaming code is organized by session type, not by media source. Source-specific behavior lives
in stream details fetchers and play-status plugins.

## Request to bytes

```
api/streamApi.ts
  └─ stream/SessionManager.ts          one session per channel + session type, shared by viewers
       ├─ stream/hls/HlsSession.ts       segmenting HLS (extends BaseHlsSession)
       ├─ stream/hls/HlsSlowerSession.ts
       └─ stream/ConcatSession.ts        MPEG-TS concat (extends DirectStreamSession)
            └─ stream/VideoStream.ts / ProgramStreamFactory.ts
                 └─ stream/ProgramStream.ts   one lineup item + its transcode
                      ├─ StreamProgramCalculator.ts       which program is on now, and its offset
                      ├─ ProgramStreamDetailsFetcher.ts   probe the media (Plex/Jellyfin/Emby/local)
                      │  └─ ExternalStreamDetailsFetcher.ts, FfprobeStreamDetails.ts
                      └─ ffmpeg/FfmpegStreamFactory.ts → ffmpeg/FfmpegProcess.ts
```

- Base classes: `stream/Session.ts` → `stream/DirectStreamSession.ts` (shared direct stream) and
  `stream/hls/BaseHlsSession.ts`.
- Session lifecycle: `init → starting → started → stopping → stopped` (or `error`).
  `SessionManager` replaces a `stopping`/`stopped` session instead of handing it to new viewers.
- HLS working directories are per session instance: `stream_<channelUuid>_<instanceId>`
  (`BaseHlsSession`). Stop kills ffmpeg, waits up to 30s for it to exit, then deletes the
  directory. Server shutdown skips the wait (`stop({ waitForExit: false })`).
  `SessionManager.endSession` drops the session from the map under the channel lock but stops it
  outside the lock, so re-tunes don't queue behind a slow ffmpeg exit. Fragment requests to a
  stopping session get a 404. `services/startup/ClearStreamDirectoriesStartupTask.ts` sweeps
  leftover `stream_<uuid>[_<uuid>]` directories before the server listens.
- Playlists: `stream/hls/HlsPlaylistCreator.ts`, `HlsPlaylistMutator.ts`,
  `HlsMasterPlaylistMutator.ts`.
- Viewer tracking: `stream/ConnectionTracker.ts`. Rate control: `stream/StreamThrottler.ts`.
- Subtitles: `stream/ExternalSubtitleDownloader.ts`, `ffmpeg/SubtitleStreamPicker.ts`.
- Stream selection (audio/subtitle language rules): `ffmpeg/StreamSelector.ts`,
  `ffmpeg/StreamSelectionEvaluator.ts`, `services/StreamSelectionProfileResolver.ts`.
- Play-status reporting back to Plex/Jellyfin: `stream/plugins/ProgramStreamPlugin.ts` and its
  two implementations.

## FFmpeg pipeline builder (`server/src/ffmpeg/builder/`)

- `FfmpegCommandGenerator.ts` turns a built pipeline into arguments.
- `pipeline/` picks a builder: `software/`, `nvidia/`, and `hardware/` (VAAPI, QSV,
  VideoToolbox).
- Building blocks: `decoder/`, `encoder/`, `filter/` (per-accelerator subfolders plus
  `watermark/`), `input/`, `options/`, `format/`.
- `capabilities/` detects what the local FFmpeg and hardware support.
- `state/` holds the frame state that each step updates as the pipeline is built.
- Use the `/pipeline-feature` command when adding a pipeline step.

Playback parameters (resolution, bitrate, codec targets) come from
`ffmpeg/FfmpegPlaybackParamsCalculator.ts` and the channel's transcode config
(`db/TranscodeConfigDB.ts`).
