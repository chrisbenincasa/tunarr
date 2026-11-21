# ErsatzTV Next Backend

*Last Updated: 2026-11-07*

An alternative streaming pipeline. Tunarr hands a channel to `ersatztv-channel`, a standalone
worker binary from [ErsatzTV/next](https://github.com/ErsatzTV/next), instead of running its own
FFmpeg pipeline. Tunarr owns the worker process. No ErsatzTV server runs.

All server code lives in `server/src/stream/etv/`. User docs are
`docs/configure/ffmpeg/ersatztv-next.md`.

## When a channel uses it

- `EtvNextRouting.ts` `routesToEtvNext` decides per request.
- Either switch enrolls a channel:
  - the `ersatzTvNextEnabled` feature flag (env `TUNARR_ERSATZTV_NEXT_ENABLED`), for every channel
  - the channel's `useEtvNext` column (migration `0054`), for one channel
- Only the `hls`, `hls_direct_v2` and `mpegts` stream modes route to it.
- `mpegts` runs as `etv_next_concat`, a concat session that reads the worker's HLS playlist.

## Request to bytes

```
api/streamApi.ts                         /stream/channels/:id.m3u8, /:sessionType/:file
  └─ stream/SessionManager.ts            getOrCreateEtvNextSession (session type etv_next)
       └─ EtvNextSession.ts              extends Session, not BaseHlsSession
            ├─ EtvNextBinaryResolver     find the binary, check pin + describe contract
            ├─ EtvNextChannelConfigMapper   transcode config → channel.json
            ├─ EtvNextWorkspace          etv_<key>/ directory, .ready / .heartbeat files
            ├─ EtvNextDynamicPlayout     one placeholder item the worker resolves per item
            └─ spawn: ersatztv-channel run channel.json --output-folder out/ --number <n>
                    │
                    └─ GET /api/etv/playout-item (bearer token) ─► api/etvApi.ts
                         └─ EtvNextPlayoutWriter.resolveDynamicItem
                              └─ EtvNextPlayoutItemMapper.toPlayoutItem
```

- `streamApi` serves the worker's `out/` files as found. `EtvNextPlaylistCreator.ts` builds the
  master playlist around the worker's `live.m3u8`.
- Viewer heartbeats touch `out/.heartbeat`. The worker reaps itself when the file is older than
  90 s, so Tunarr's staleness window (`DefaultStalenessMs`, 60 s) sits below it.

## Playout modes

| Mode | How the worker learns what to play | Used by |
| ---- | ---------------------------------- | ------- |
| `dynamic` (default) | One placeholder item per 12 h window. The worker calls `/api/etv/playout-item` for each item, so an edit lands at the next item. | Live channels |
| `materialized` | `EtvNextPlayoutWriter.materializeWindow` writes the schedule to `playout/<start>_<finish>.json` ahead of time, rebuilt on a timer | The `playoutMode` session option. No caller sets it today. |

- `EtvNextDynamicTokenRegistry.ts` mints one bearer token per session. The worker reads it from the
  `TUNARR_ETV_TOKEN` env var, and the channel comes from the token, never from the request header.
- `resolveDynamicItem` keys each item `${channel.uuid}-${startMs}`, skips items under 1 s, rate
  limits a spinning channel, and always answers with something playable (an error screen at worst),
  because the worker turns a 5xx into silent black video.
- A watchdog ends a session whose worker stops calling back for 5 minutes past an item's end.

## Worker binary

| File | Role |
| ---- | ---- |
| `server/package.json` `ersatztvNext` | Pinned release tag, commit, and sha256 per target archive |
| `server/scripts/download-ersatztv-next.ts` | `pnpm download-ersatztv-next`; also run by `predev` and `server/scripts/make-bin.ts` |
| `EtvNextVersion.ts` | Pinned version, `--version` parsing |
| `EtvNextBinaryResolver.ts` | Search order (`TUNARR_ERSATZTV_NEXT_PATH`, `bin/`, cwd), `resolveChecked` |
| `EtvNextDescribe.ts` | Parses `ersatztv-channel describe`, checks the contract |

`resolveChecked` runs before the first session:

- A bundled worker off the pinned version is refused. One found through
  `TUNARR_ERSATZTV_NEXT_PATH` only warns.
- Any worker whose `describe` contract does not accept Tunarr's playout and channel config versions,
  output file names, or callback headers is refused.
- A worker from the env var that predates `describe` runs unchecked.

The Docker image symlinks the bundled binary to `/tunarr/bin/ersatztv-channel`.

## Schemas

- `schema/` holds JSON Schemas vendored from the pinned commit, with sha256 hashes in
  `schema/manifest.json`:
  - `playout.json`, `channel_config.json`, `lineup_config.json`, `describe.json`
  - `example-playout.json`, plus `example-describe.json` (the pinned worker's real `describe` output) as contract fixtures
- `server/scripts/generate-etv-schemas.ts` (`pnpm generate-etv-schemas`) emits Zod schemas into
  `generated/`. Written documents use `z.strictObject`. `describe.json` uses `z.object`, because
  upstream adds fields without a version bump.
- `generated.test.ts` ties the vendored files to the manifest and the pinned commit, and the
  `ChannelConfigVersion` and `PlayoutVersion` constants to the schemas' `$id`.
- Bumping the worker means a new pin and hashes, re-vendored schemas and manifest, regenerated
  output, and the version constants. See PR #2415 or #2443.

## Transcode config compatibility

- `EtvNextChannelConfigMapper.ts`:
  - `findUnsupportedSettings` lists settings that refuse the config (audio format, accel mode)
  - `findIgnoredSettings` lists settings the worker drops (thread count, preset, volume)
  - `findHardwareSelection` gives the accel, format, bit depth and VAAPI device and driver the config sends
- `EtvNextHardwareProbe.ts` runs `describe --probe` with a partial channel config and caches the
  result for 10 minutes. `EtvNextHardwareCheck.ts` turns the result into warnings.
- Routes in `api/etvApi.ts`:
  - `/etv/transcode_configs/:id/compatibility`, for the static check
  - `/etv/transcode_configs/:id/hardware`, for the probe (takes seconds)
- The web shows both in `web/src/components/settings/ffmpeg/EtvNextCompatibilityNotice.tsx`, in
  the transcode config editor and in the channel editor's **Use ErsatzTV next Backend** section.

## Diagnostics

- The worker writes a dossier per failure into the channel's reports folder.
  `EtvNextDossiers.ts` keeps the newest 5 and redacts media-server tokens for the zip.
- Routes `/etv/channels/:id/diagnostics` and `/diagnostics.zip` serve them. The web Troubleshoot
  page links the zip.
- `EtvNextTroubleshootRunner.ts` runs `ersatztv-channel run --troubleshoot` for the Troubleshoot
  page. It uses `materializeProgram` and its own workspace, so it never touches a live channel.

## Lifecycle and cleanup

- Each worker run gets `etv_<key>/` (`channel.json`, `worker.pid`, `playout/`, `out/`), keyed per
  session instance or troubleshoot run.
- `services/startup/ClearStreamDirectoriesStartupTask.ts` kills orphaned workers from `worker.pid`
  and deletes leftover `etv_*` directories before the server listens.
- `StreamModule.ts` binds the resolver and hardware probe as singletons, and builds sessions and
  the troubleshoot runner through factories. The token registry is a singleton through its own
  `@injectable` decorator. `EtvNextPlayoutWriter` autobinds, because binding it there creates an
  import cycle with `container.ts`.
