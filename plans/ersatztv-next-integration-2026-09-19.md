**ErsatzTV `next` as an alternate streaming backend — 19 September 2026**

Tunarr can adopt [ErsatzTV/next](https://github.com/ErsatzTV/next) today as a feature-flagged, per-channel streaming backend without touching the scheduler, the guide, the library, or the existing FFmpeg pipeline. The integration is a bundled sidecar process plus two JSON contracts, not a linked library — `next` is a Rust workspace that produces binaries, and it has no C ABI or Node binding. Tunarr already ships a third-party Rust binary this exact way (Meilisearch), so the packaging path is a copy of one that works.

The recommended shape is: **spawn `ersatztv-channel` directly from `SessionManager`, one process per active session, and answer its `DynamicSource` callbacks from `StreamProgramCalculator`.** That keeps every playback-time decision Tunarr makes — on-demand resume, channel redirects, filler picking against play history, error degradation — in Tunarr, and hands `next` only the job it claims: normalize and transcode one item, keep the segment clock honest. It is also the option that requires no new supervision, port allocation, or URL-rewriting machinery.

This is a design and source-inspection plan against `next` at `ed95077` and Tunarr at `b7cd3f45`. Nothing was built or run; effort and risk judgments are estimates from the integration points cited below.

> **Status: design review complete. Implementation not yet authorized.**
>
> The review happened and changed the document. Read §15 before the sections above it — the defect register carries 28 source-verified findings, the decisions taken are in §15.F, and the corrections table at the end of §15 records where earlier drafts were wrong. Every question on the §13 agenda is now marked answered in place.
>
> **The posture changed most.** This was written as a cautious integration with a third-party project. It is now a **migration**, pursued as a co-development partnership with upstream, entered as an evaluation spike built to permanent standards (F1). Changes to `next` are in scope to design and propose. The governing constraint is that Tunarr regresses or abandons as little existing behaviour as possible, which is why the default disposition for a gap is to add the capability upstream rather than to block the config or document the limitation.
>
> **What still gates shipping**, as opposed to starting:
>
> 1. **Tagged upstream releases (B3).** The `develop` release deletes each target's previous asset on every push to `main`, so nothing stays pinnable. The delete step is already conditional on the tag being `develop`, so cutting a version tag fixes it with no new pipeline.
> 2. **The B-series blockers.** B2 — a failed callback costs 60 seconds of black with no retry and no failure budget. And B6–B8, three silent regressions found by the §15.G sweep: hardcoded `fast_bilinear` scaling that degrades every scaled frame for every viewer, DTS/TrueHD not being rewritten to AC-3 under copy so Apple clients lose audio, and no silent-audio synthesis so video-only files stop playing.
>
> Phase 0 (§11) is a throwaway spike and is exempt.

---

## 1. What `next` actually is

`next` is a complete Rust rewrite of ErsatzTV that deliberately drops library management and scheduling. Its README is explicit: "Library and metadata management, scheduling and playout creation **are not in scope for this project**." It consumes **playouts** — JSON documents describing what to play and when — and produces a normalized HLS stream.

The workspace builds three binaries relevant to us:

| Binary                       | Role                                                                                                                                                                                                                                                                                                                                                                                         | Relevance to Tunarr                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ersatztv`                   | Axum HTTP server. Serves `/channels.m3u`, `/channel/{N}.m3u8`, `/xmltv.xml`, `/session/{ch}/{file}`; supervises one `ersatztv-channel` child per active channel.                                                                                                                                                                                                                             | Duplicates work Tunarr already owns. Not used. |
| `ersatztv-channel`           | Per-channel worker. Reads playout JSON, builds FFmpeg pipelines, writes HLS segments to an output folder. Buffering is a 2×2 lattice of Seek/Zero × WorkAhead/Realtime, not a linear chain. The Seek/Zero axis is driven by whether the previous chunk completed the item; the WorkAhead/Realtime axis is driven independently by buffer depth (`next_state`, `channel_session.rs:841-866`). | **This is the piece we want.**                 |
| `ersatztv-playout-generator` | Dev tool that makes playout JSON from a folder of videos. Upstream states scheduling feature requests will not be accepted.                                                                                                                                                                                                                                                                  | Reference only.                                |

The two crates behind them, `ffpipeline` (probing, hardware-accel selection, filter-chain construction) and `ersatztv-playout` (the schema models), are where the feature richness lives: AMF/CUDA/QSV/VAAPI/VideoToolbox/Vulkan/RKMPP acceleration with FFI capability probing and graceful fallback, HDR10 and Dolby Vision detection, tonemapping via `libplacebo`/`vpp_qsv`/`tonemap_opencl`, interlacing detection, and a graphics compositing layer. The last three months of commits are almost entirely hardware-pipeline work (`amf mpeg2 decoder`, `fuse libplacebo and scale_cuda into libplacebo`, `tonemap hdr10 using vpp_qsv`, `probe for hdr10 metadata`). That development velocity on exactly the surface Tunarr finds hardest to maintain is the whole case for this integration.

**What it is not:** it is not importable. "Bundle this library" resolves in practice to "ship the binaries and talk to them over JSON files, a directory of segments, and one HTTP callback." A future `napi-rs` binding over `ffpipeline` is conceivable but is not a today move and is not planned here.

---

## 2. The contract surface

`next` is configured in three tiers plus the playout documents.

**`lineup.json`** — server bind address, output folder, channel list, optional XMLTV folder. Only consumed by the `ersatztv` binary. **We do not write this file.**

**`channel.json`** (schema: `schema/channel_config.json`) — playout folder, FFmpeg paths, and the normalization target: video format/bit depth/resolution/bitrate/buffer/accel/scaling mode/deinterlace/per-filter options, audio format/bitrate/channels/sample rate/loudnorm, subtitle mode. Supports config **overlays**: `ChannelConfig::from_sources()` deep-merges a base file with overlay files, and `null` in an overlay removes a key. That maps cleanly onto Tunarr's split between a shared `TranscodeConfig` row and per-channel overrides.

**Playout JSON** — named `{start}_{finish}.json`. `parse_playout_filename` (`crates/ersatztv-playout/src/playout.rs:428`) accepts either compact ISO 8601 **or Unix epoch seconds/milliseconds**, which is much easier to emit from Node. A file is selected when `now` falls inside its window; the item is then found with `rfind(|i| now >= i.start && now < i.finish)`.

The playout item model is the real integration contract, and it is a good fit:

| Playout concept                                                            | Tunarr equivalent                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `LocalSource { path, in_point_ms, out_point_ms }`                          | `FileStreamSource` + `lineupItem.startOffset` / `streamDuration`                                                                |
| `HttpSource { uri, headers, user_agent, is_live, reconnect, ... }`         | `HttpStreamSource` with `extraHeaders` — the Plex/Jellyfin/Emby direct paths in `ProgramStreamDetailsFetcher.getStreamSource()` |
| `LavfiSource { params }`                                                   | `FilterStreamSource` — offline/flex/error screens                                                                               |
| `ProbeHint { video[], audio[], subtitle[], format_name, duration_ms }`     | `StreamDetails` from `ProgramStreamDetailsFetcher` — **when present, `ffprobe` is skipped entirely**                            |
| `tracks.{video,audio,subtitle}` with per-track `source` and `stream_index` | Tunarr's per-program stream selection and sidecar subtitles                                                                     |
| `watermark` / `graphics[]` with `PeriodicTiming`                           | `Watermark` including `fadeConfig`                                                                                              |
| `DynamicSource { uri, headers, user_agent, timeout_us }`                   | The hook that lets Tunarr keep its scheduler                                                                                    |

`ProbeHint` deserves emphasis. Tunarr already stores full probe metadata per media version (`mediaStreams` rows: codec, profile, pixel format, colour range/space/transfer/primaries, bit depth, channels, frame rate, scan kind). Supplying it as a hint means `next` opens each source **once**, at playback, instead of twice. For remote Plex/Jellyfin sources that is a direct latency win over an ffprobe-then-play round trip.

Version compatibility is enforced: `from_file` parses the `version` URI and rejects a playout whose breaking digit differs or whose compatible digit exceeds the binary's `SUPPORTED_SCHEMA` (currently `0.0.4`). The version string Tunarr emits is therefore coupled to the bundled binary version, and both must move together.

---

## 3. Architecture: spawn the channel worker, skip the server

Two shapes were considered.

**Option A — run `ersatztv` as a sidecar server.** Tunarr writes `lineup.json` and one `channel.json` per channel, starts `ersatztv` on a loopback port, and reverse-proxies `/stream/channels/:id.m3u8` to `http://127.0.0.1:<port>/channel/<n>.m3u8`.

**Option B — spawn `ersatztv-channel run` per session.** Tunarr's `SessionManager` owns the process lifetime; the output folder becomes the session's working directory; Tunarr's existing static routes serve the playlist and segments.

**Option B is the recommendation, and the deciding factor is not process count — it is that Option A has _more_ processes, not fewer.** The `ersatztv` server does not transcode. `ChannelSession::spawn` (`crates/ersatztv/src/channel_session.rs:17`) shells out to the very same `ersatztv-channel` binary, one child per active channel. Option A is therefore `1 server + N workers`; Option B is `N workers`. Running the server adds a supervisor, it does not remove one.

What the server would save us is genuinely small — roughly 90 lines, of which Tunarr already has better versions of half:

| Server responsibility                         | Lines | Tunarr's position                                                                                                           |
| --------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| Spawn child, watch exit, drop from active map | ~30   | New, but `ChildProcessHelper` already does the hard parts                                                                   |
| `.ready` file watcher                         | ~15   | New, trivial                                                                                                                |
| `.heartbeat` touch middleware                 | ~25   | Tunarr's `ConnectionTracker` is strictly better — per-IP heartbeats, segment-request tracking, staleness, scheduled cleanup |
| Multivariant playlist synthesis               | ~20   | Must be ported either way; Option A's version emits ETV-shaped URLs we would have to rewrite                                |
| Static segment serving                        | —     | `/stream/channels/:id/:sessionType/:file` already does this                                                                 |

Against that, Option A carries one hard operational cliff. **The channel roster is boot-time-only.** `LineupState.channels` is built once from `lineup.json` in `run()` and then `Arc`'d immutably; there is no control API, no config-reload endpoint, no file watch, and no `SIGHUP` handler anywhere in `crates/ersatztv/src/` (verified by grep). The only way to make the server aware of a new channel number is to rewrite `lineup.json` and restart the process — and startup calls `empty_folder(&output_folder)` on the **shared** output root, recursively deleting every channel's segments. So adding, deleting, or renumbering one channel in the Tunarr UI tears down every in-flight stream on the server.

To be fair to Option A, that cliff is narrower than it first looks: `channel.json` is read by the **child** at spawn time (`ChannelConfig::from_sources` in `crates/ersatztv-channel/src/main.rs`), so transcode-setting and watermark edits are picked up on the next session with no restart. Only roster changes — add, delete, renumber — require the bounce. For an appliance with a static lineup that is tolerable. For Tunarr, where channels are created and renumbered from the UI, it is not.

The remaining Option A costs are ordinary but real: a second loopback port to allocate, `x-forwarded-proto`/`x-forwarded-host` rewriting so the multivariant playlist emits Tunarr URLs rather than ETV ones, a second channel-number namespace to keep in sync, two competing idle-timeout mechanisms, and `/channels.m3u` plus `/xmltv.xml` endpoints that duplicate — and could drift from — Tunarr's own.

**Worth reconsidering if** upstream adds a roster-reload or channel-registration endpoint (B4). At that point Option A becomes a reasonable trade: one long-lived supervisor to babysit instead of `SessionManager` owning spawn semantics directly. It is worth asking for, because it is a small change on their side.

Option B is also a smaller diff than it sounds, because `ersatztv-channel run` is a documented first-class entry point and its output folder is shaped exactly like a Tunarr HLS session working directory:

```
ersatztv-channel run --output-folder <dir> --number <N> <channel.json> [overlay.json ...]
```

It writes into `<dir>`: `live.m3u8` (the served media playlist, relative segment paths), `live_sub.m3u8` (WebVTT rendition), `ffmpeg.m3u8` (internal), `live%06d.ts`, matching `.vtt` files, plus two signal files. `BaseHlsSession` (`server/src/stream/hls/BaseHlsSession.ts:20`) already models "a working directory of m3u8 + segments", and `/stream/channels/:id/:sessionType/:file` (`server/src/api/streamApi.ts:256`) already serves it.

What Option B obliges Tunarr to reimplement is small and fully visible in `crates/ersatztv/src/main.rs`:

- **The `.ready` protocol.** The worker writes `.ready` into the output folder once at least four segments are published. Poll for it before serving the playlist, with the upstream 30s deadline (`READY_FILE_TIMEOUT`). Roughly the `tokio::spawn` watcher block at `crates/ersatztv/src/channel_session.rs:37`.
- **The `.heartbeat` protocol.** The worker reaps itself when `.heartbeat`'s mtime is older than 90s (`HEARTBEAT_FILE_TIMEOUT`), exiting **zero** — an idle reap is explicitly not a failure (`crates/ersatztv-channel/src/main.rs:53`). Tunarr touches the file on each segment or playlist request, in the same place it already calls `session.recordHeartbeat(req.ip)`. Tunarr's own `stalenessMs` should be set below 90s so Tunarr's connection tracker, not the file clock, decides when a session ends.
- **The multivariant playlist.** `live.m3u8` is a media playlist; the `#EXT-X-STREAM-INF` wrapper with the subtitle rendition is synthesized by the server (`get_multi_variant`, `crates/ersatztv/src/main.rs:219`). Port that ~20-line function into a small `EtvNextPlaylistCreator` that emits Tunarr-shaped URLs. Gate the subtitle `#EXT-X-MEDIA` line on the `webvttSidecarEnabled` flag so behaviour matches the existing HLS modes.

### Why not native bindings

Linking `next` into the Node process instead of spawning it is the intuitive way to make the sidecar problem disappear. It does not survive contact with the crate layout.

**There is nothing to link against today.** `crates/ersatztv-channel/src/lib.rs` is two lines — `pub mod config;` and `pub mod error;`. Every piece of logic we want is a _private module of the binary_: `channel_session.rs` (1,569 lines), `playlist_manager.rs`, `playout_loader.rs`, `pts_scanner.rs`, `fallback.rs`, `dossier.rs`, `local_proxy.rs` — about 3,400 lines, none of it public API. No crate in the workspace declares a `cdylib` or `staticlib` `crate-type`. Exposing a binding is therefore an upstream refactor — hoist those modules into the lib, design a public surface, and commit to keeping it stable — on a project that is pre-1.0, explicitly experimental, and moving fast. That is the lift, and it is not ours to make.

**Even if upstream did it, it would make Tunarr worse in three ways.**

_It removes no process._ `ChannelSession` spawns FFmpeg as a child (`tokio::process::Command::new(&self.ffmpeg_path)`, `channel_session.rs:752`). The transcoder is a subprocess either way; a binding moves the _supervisor_ into Node and leaves the heavy process outside. Today Tunarr runs one FFmpeg per active channel. Under Option B it runs one `ersatztv-channel` plus its FFmpeg — so the true cost of the sidecar model is **one extra lightweight Rust supervisor per active channel**, not one per server, and a binding would recover only that.

_It destroys crash isolation, at the worst possible boundary._ Nine `*-sys` crates (`libva-sys`, `libvpl-sys`, `libnvidia-sys`, `libamf-sys`, `libd3d11-sys`, `libcl-sys`, `libmpp-sys`, `libvulkan-sys`, `libvt-sys`) `dlopen` proprietary GPU driver libraries via `libloading` to probe hardware capability. A segfault or abort in a vendor driver — the single most common source of hardware-transcode instability — currently kills one channel's worker and gets reaped. In-process it takes down the Fastify server, the SQLite connection, and the web UI with it. A panic in the pipeline does the same. This is precisely the code you want behind a process boundary.

_It doubles the hardest part of Tunarr's packaging._ Tunarr ships single executables via `@yao-pkg/pkg` across six targets, and `server/scripts/make-bin.ts` already downloads per-ABI, per-platform `better-sqlite3` prebuilds because native addons and `pkg` interact badly. A napi-rs addon adds a second such matrix — Node-ABI-coupled, six targets — that Tunarr would have to **build itself**, since upstream publishes no addon. That means a Rust toolchain and cross-compilation in Tunarr's release pipeline. A plain binary is one file per platform, fetched from upstream releases, with zero ABI coupling: the Meilisearch path that already works.

**The pain to solve is supervision, not process count**, and Tunarr already solved it. `ChildProcessHelper` provides restart-on-failure with attempt limits and `AbortController` teardown; `MeilisearchService` contributes the PID-file plus `find-process` orphan-reaping pattern for children that outlive an unclean parent exit. `EtvNextSession` inherits both. A long-term napi binding over `ffpipeline` alone — the pure pipeline-construction crate, no process management, no I/O — is a more plausible future conversation, but it buys command-line generation, which is not the expensive part.

### Shape of the new session

```
server/src/stream/etv/
  EtvNextSession.ts          extends BaseHlsSession; spawns the worker, waits on .ready,
                             touches .heartbeat, tears down on stop/stale
  EtvNextChannelConfigWriter.ts   TranscodeConfig -> channel.json (+ per-channel overlay)
  EtvNextPlayoutWriter.ts    rolling-window playout files containing the dynamic placeholder
  EtvNextPlayoutItemMapper.ts     StreamLineupItem + StreamSource + StreamDetails -> PlayoutItem
  EtvNextBinaryResolver.ts   binary discovery, mirroring MeilisearchService's search order
```

`SessionManager` gains `getOrCreateEtvNextSession()` alongside the existing `getOrCreateHlsSession` / `getOrCreateHlsSlowerSession` factories, registered in `StreamModule.ts` with an `KEYS.EtvNextSession` provider. The `mode` switch in `/stream/channels/:id.m3u8` (`server/src/api/streamApi.ts:395`) gains one case.

---

## 4. Playout generation: let `next` call back

The naive integration materializes playout files from the channel lineup. That is the wrong default for Tunarr, because a large amount of what Tunarr decides is only decidable at playback time: on-demand channels shift their timeline on resume (`OnDemandChannelService.resumeChannel`), redirects resolve through other channels' lineups, filler is picked against `ProgramPlayHistoryDB`, and repeated failures degrade an item to an error screen after too many attempts. Materializing forces all of that to be predicted ahead and re-predicted on every lineup edit.

`DynamicSource` removes the problem. It is a placeholder resolved at transcode time by fetching a `PlayoutItem` over HTTP (`resolve_dynamic_item`, `crates/ersatztv-channel/src/channel_session.rs:1158`). The worker sends:

| Header             | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `x-etv-channel`    | the `--number` passed at spawn                                           |
| `x-etv-now`        | RFC3339 transcode position (**ahead of wall clock** while working ahead) |
| `x-etv-until`      | the placeholder's `finish`, the clamp on what may be returned            |
| `x-etv-dynamic-id` | the placeholder item's `id`                                              |

The response's `start` is forced to the requested position and its `finish` clamped to `x-etv-until`; the item may not itself be dynamic. Crucially, the placeholder is **not** consumed — the next transcode tick re-runs `get_current_item` against the same window, finds the same placeholder, and resolves it again. A single long-window placeholder therefore yields a fully dynamic channel.

**The plan:** `EtvNextPlayoutWriter` maintains one rolling window file per active channel, `{nowMs}_{nowMs + 12h}.json`, containing exactly one item whose source is
`{"source_type": "dynamic", "uri": "http://<callbackHost>:<tunarrPort>/api/etv/playout-item", "headers": ["Authorization: Bearer {{TUNARR_ETV_TOKEN}}"]}`,
refreshed on a timer well before the window closes. `<callbackHost>` follows `TUNARR_BIND_ADDR` and is `127.0.0.1` only when that is a wildcard, because a bind address naming one interface leaves nothing listening on loopback and the worker answers a refused callback with silent black video. `{{VAR}}` expands from the worker's environment (`crates/ersatztv-playout/src/template.rs`), which is how the shared secret and any media-source tokens reach the child without landing in a file on disk.

The resolver endpoint is thin:

```
GET /api/etv/playout-item
  -> StreamProgramCalculator.getCurrentLineupItem({ channelId, startTime: xEtvNow })
  -> ProgramStreamDetailsFetcher.getStream({ server, lineupItem })
  -> EtvNextPlayoutItemMapper.toPlayoutItem(...)
```

Both halves already exist and are already exercised by the current HLS path. The mapper is the only genuinely new logic.

### Timing semantics, precisely

`compute_timing` (`crates/ersatztv-channel/src/channel_session.rs:975`) derives the seek point as `in_point_ms + (effective_now - item.start)`. Because `resolve_dynamic_item` sets `item.start = transcoded_until` _before_ transcoding, that elapsed term is zero on the dynamic path. So the mapper writes:

| Playout field  | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| `start`        | `x-etv-now` (the worker overwrites it anyway)               |
| `finish`       | `start + lineupItem.streamDuration`                         |
| `in_point_ms`  | `lineupItem.startOffset ?? 0`                               |
| `out_point_ms` | `(lineupItem.startOffset ?? 0) + lineupItem.streamDuration` |

which is exactly the `{ startTime, duration }` pair `ProgramStream.setupContentItem` already hands to `createStreamSession`. On the pre-materialized path (§11) the mapping differs — `start` is `programBeginMs` and the elapsed term does the seeking — so the mapper needs both modes.

**Two consequences to design for.** First, `x-etv-now` runs up to 11 segments (44s) ahead of wall clock while working ahead, so the resolver is asked about the near future. `getCurrentLineupItem` takes an arbitrary `startTime`, so this works, but any **side-effecting** decision it makes — recording filler plays to `ProgramPlayHistoryDB`, incrementing attempt counters — is now committed for a moment that has not happened. Audit those writes before enabling the mode by default; the likely answer is to pass a flag that makes the resolver's filler pick non-recording, or to record against the item's wall-clock start rather than the request time.

Second, `getCurrentLineupItem` returns `redirect` items that Tunarr resolves by recursing into the target channel. The resolver must fully resolve redirects to a content item before responding — `next` has no notion of a redirect and rejects a nested dynamic source.

---

## 5. Lineup lifecycle: what is on disk, who writes it, when it is re-read

### A terminology collision, first

"Lineup" means two different things across the two projects, and conflating them causes real confusion:

| Term        | In Tunarr                                                                                                                             | In `next`                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Lineup**  | A channel's _programming schedule_ — the ordered `LineupItem[]` in a per-channel lowdb JSON file, loaded via `channelDB.loadLineup()` | The _channel roster_ — `lineup.json`, listing which channels exist and where their configs live |
| **Playout** | (no term)                                                                                                                             | The time-windowed schedule documents a channel worker actually plays from                       |

Tunarr's lineup maps onto `next`'s **playout**, not onto `next`'s lineup. `next`'s lineup is the roster file, which we never write (§3). The rest of this section uses "playout" for the ETV-side artifact.

### What sits on disk per channel

Under Option B, one directory per active session:

```
<transcodeDirectory>/etv_<channelUuid>/
  channel.json          written by Tunarr at session start; read by the worker at spawn
  channel.overlay.json  optional per-channel deviations, deep-merged over the base
  playout/
    <startMs>_<finishMs>.json      the rolling window (§4)
  out/
    live.m3u8  live_sub.m3u8  ffmpeg.m3u8  live%06d.ts  *.vtt  .ready  .heartbeat
```

Filenames are epoch-millisecond bounds. `parse_playout_filename` (`crates/ersatztv-playout/src/playout.rs:428`) tries compact ISO 8601 first and falls back to `parse_unix_timestamp`, treating a string longer than 10 characters as milliseconds — so `1772000000000_1772043200000.json` is valid and far easier to emit from Node than ETV's separator-free ISO format.

### Re-read cadence: no restart, no signal, no watch

This is the part that makes the whole design workable, and it is worth being precise about.

**The worker re-reads the playout directory from scratch on every transcode iteration.** `PlayoutLoader::get_current_item` performs a `read_dir` of the playout folder to pick the window file, then calls `ersatztv_playout::playout::from_file` to read and parse it — every call, with no caching anywhere in `PlayoutLoader`. `ChannelSession::transcode` calls it once per chunk, and a work-ahead chunk covers at most `SEGMENT_SECONDS * 11` = **44 seconds** of content.

So the update protocol from Tunarr's side is simply: **write the file, atomically.** No restart, no IPC, no `SIGHUP`, no file watcher. A rewritten playout is picked up within one chunk boundary. Upstream's own README confirms the intent — "Playout files can be updated on disk without restarting the server." Write to a temp file in the same directory and `rename()` so the worker never observes a partial document; that is the pattern `PlaylistManager` itself uses for `live.m3u8` (`tempfile::NamedTempFile::new_in` then `tokio::fs::rename`).

Two selection semantics to respect when writing:

- **Window selection is first-match over `read_dir` order**, which is filesystem order, not sorted. Overlapping window files are therefore nondeterministic. Keep exactly one current window file per channel and delete superseded ones.
- **Item selection is `rfind`** — `now >= item.start && now < item.finish`, scanning from the end. On overlapping items, the _last_ one wins. Emit items sorted and non-overlapping and this never matters; rely on it and it will surprise you.

**Nothing fails hard.** A missing window file yields `PlayoutJsonNoFileForTime`, and a covered-but-empty moment yields `PlayoutJsonNoItem { next_start }`. Both route through `FallbackReason` to black-and-silence rather than exiting, with `show_error` optionally burning the reason into frame. That is a safety net, not a strategy: a stalled window refresher shows viewers black video instead of crashing loudly. **Emit a Tunarr-side alert when a refresh fails**, because `next` will not.

### How updates actually flow from Tunarr

Under the recommended dynamic design (§4), **channel lineup edits require no playout rewrite at all.** The window file contains a single `DynamicSource` placeholder; the programming lives behind the resolver callback and is recomputed from `StreamProgramCalculator` on every item boundary. Editing a channel's programming mid-stream is picked up on the next item, with no file written and no invalidation logic.

That leaves only two writers:

1. **Window roll.** A timer in `EtvNextPlayoutWriter` rewrites the window when its remaining span drops below a threshold — say, write `{now}_{now + 12h}` whenever less than 2h remains. This matters because `resolve_dynamic_item` **clamps** every resolved item's `finish` to the placeholder's `finish`, so a window approaching its end starts truncating items. The refresh interval must comfortably exceed the longest single program.
2. **Channel config change.** `channel.json` is read by the worker at spawn (`ChannelConfig::from_sources`), so transcode-config and watermark edits apply to the _next_ session. Applying them immediately means restarting that channel's worker — a deliberate, per-channel action, unlike Option A's all-channel bounce.

For the pre-materialized path (phase 2, and the fallback if the resolver proves problematic), invalidation does matter, and Tunarr's write paths are already funnelled tightly enough to hook. Every item-level mutation passes through `LineupRepository.saveLineup` — including `updateLineup`, `setChannelPrograms`, `removeProgramsFromLineup`, `removeProgramsFromAllLineups`, `RegenerateChannelLineupCommand`, `ReconcileProgramDurationsTask`, and `DeleteMediaSourceCommand`. There is currently **no event emitted** on save, so phase 2 would add one — an `EventService` push from `saveLineup`, or a callback registered on `ChannelDB` — that marks the channel's materialized playout stale. This is the main reason the dynamic path is the recommended default: it makes an entire class of cache-invalidation bugs unrepresentable.

---

## 6. Generating Zod schemas from `next`'s JSON Schemas

Yes — and it is worth doing, but only one of the three schemas can be trusted as machine-generated, and the off-the-shelf converters do not work on these documents. Both findings are below, with a working prototype.

### Which schemas are trustworthy

| Schema                       | Produced by                                                                                                                                                                             | Trust                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `schema/lineup_config.json`  | `schemars::schema_for!(LineupConfig)` via `gen_lineup_config_schema.rs`                                                                                                                 | Machine-generated from the Rust type |
| `schema/channel_config.json` | `schemars::schema_for!(ChannelConfig)` via `gen_channel_config_schema.rs`                                                                                                               | Machine-generated from the Rust type |
| `schema/playout.json`        | **Hand-written.** `ersatztv-playout` has no `schemars` dependency; `AGENTS.md` says "Schema at `schema/playout.json` is hand-maintained — keep it in sync when editing the Rust types." | Best-effort, can drift               |

The one we depend on most is the hand-maintained one. It is currently accurate — a field-by-field diff of all 13 named types and 7 tagged-enum variants against the serde structs in `crates/ersatztv-playout/src/playout.rs` found **zero mismatches** — but it is in sync by discipline, not by construction.

### Why this matters more than it looks

Neither document validates its own keys, so **a typo in either file is silently ignored**. Misspell `in_point_ms` as `in_point_msec` and the item plays from zero. Nothing logs, nothing errors; you notice because a viewer sees the wrong part of a movie.

It is tempting to assume `channel.json` is safer, because the channel-config types carry `#[serde(deny_unknown_fields)]` on **eleven** structs. They do — but all eleven are _video-filter option_ structs (`config.rs:150, 165-219`: `BwdifOptions`, `YadifCudaOptions`, `TonemapOpenclOptions` and siblings). The top-level `ChannelConfig` is a plain derive with no such attribute (`config.rs:22-23`), so a misspelled root key like `normalisation` is discarded in silence exactly as a playout typo is.

There is already a live instance of this in the repo: upstream's own `examples/playout/playout.json` carries a `generated_at` field that exists in **neither** the schema's root properties **nor** the Rust `Playout` struct. It is silently discarded on every load. That is the failure mode, sitting in the example file.

Validating our generated documents against a Zod schema **before writing them** therefore buys Tunarr a guarantee that `next` does not provide for itself. Because the weakness is symmetric, the validation must be too — `channel.json` needs the same `.strict()` treatment as the playout, not the lighter touch a `deny_unknown_fields` root would have justified.

### The converters do not work out of the box

`json-schema-to-zod@2.8.1` (the obvious candidate — it does target Zod 4, via `--zodVersion 4`) **does not resolve `$ref` at all**. Run against `playout.json` it emits:

```ts
export const PlayoutSchema = z.object({
  version: z.string(),
  items: z.array(z.any()),
});
```

The entire item model collapses to `z.any()`. `--depth` does not help, and neither does rewriting `definitions` to `$defs`. Against `channel_config.json` all four top-level properties come out `z.any()`.

Dereferencing first with `@apidevtools/json-schema-ref-parser` and then converting does produce a correct schema, but an unusable one: **381 KB**, because `PlayoutItemSource` — six variants, each carrying a full `ProbeHint` with video/audio/subtitle hint arrays — gets inlined at all six of its use sites.

### What does work: a ~70-line per-definition generator

Emit one named Zod export per `$defs`/`definitions` entry in topological order, with `$ref` rendered as the generated identifier rather than inlined. The schemas use a small, closed subset of JSON Schema — `object`, `array`, `string`/`integer`/`number`/`boolean`, `enum`, `const`, `oneOf`/`anyOf`, `$ref`, `["T","null"]` type arrays, and `description` — so this is a short, fully-controlled script, not a dependency.

Prototyped and verified against the real schema:

- **20 definitions → 5.6 KB** of readable output, 66× smaller than the dereferenced version, with **zero** `z.unknown()` escapes.
- It parses upstream's own example playout unmodified.
- One idiom needs explicit handling: `{"oneOf": [{"$ref": "X"}, {"type": "null"}]}` is _nullable X_, not a union with a null branch. Collapse it to `XSchema.nullable()` or you get `z.union([XSchema, z.unknown()])` at thirteen sites.

Representative output:

```ts
export const PlayoutItemSourceSchema = z.union([
  LocalSourceSchema,
  LavfiSourceSchema,
  HttpSourceSchema,
  RtspSourceSchema,
  ScriptSourceSchema,
  DynamicSourceSchema,
]);

export const PlayoutItemSchema = z.object({
  id: z.string(),
  start: z.string(),
  finish: z.string(),
  source: PlayoutItemSourceSchema.nullable().optional(),
  tracks: PlayoutItemTracksSchema.nullable().optional(),
  watermark: GraphicsLayerSchema.nullable().optional(),
  graphics: z.array(GraphicsLayerSchema).optional(),
});
```

### Recommendations for the generated output

- **Emit `.strict()` on every object.** Default Zod object mode mirrors serde's permissiveness and does _not_ catch the typo case — verified. With `.strict()` the same input fails with `Unrecognized key: "in_point_msec"`. This is the whole point of the exercise.
- **Hand-refine the tagged unions.** The generator emits `z.union([...])` for `PlayoutItemSource`; `z.discriminatedUnion('source_type', [...])` gives far better error messages and is a one-line post-pass keyed on the schema's `tag` semantics.
- **Tighten the primitives the schema cannot express.** `start`/`finish` are `z.string()` from JSON Schema but are RFC3339 in practice — `z.iso.datetime({ offset: true })` matches what Tunarr already uses in `ChannelSessionSchema`. Same for percentage bounds and `version`'s URI prefix.
- **Keep the raw generated file separate from the refined one**, the way `web/src/generated/` is separated from hand-written schemas, so regeneration never clobbers the refinements.
- **Check in the upstream schemas** alongside the binary version pin. The playout `version` field, the bundled `ersatztv-channel` build, and the vendored schema copies are one unit and must move together (§2).

### Where it lives and what it gates

Put the generator at `server/scripts/generate-etv-schemas.ts` and the output under `server/src/stream/etv/generated/`, mirroring the `pnpm generate-client` convention. Then two checks earn their keep in CI:

1. **A drift check — which belongs upstream, not here.** The field-by-field diff of `schema/playout.json` against the Rust serde structs is ~40 lines and found zero mismatches today, and it is the only mechanical defence against the hand-maintained schema falling behind. But Tunarr cannot run it in its own CI: it vendors the schema copies, not the Rust source, so the check would need a clone of `next` at the pinned commit on every build — a network fetch of a second repo that only catches drift after it has already shipped. Contribute it upstream instead (C6), where it runs at the commit that causes the drift, and keep only a hash check here that the vendored copies match the pinned release. That is a diff, not a parser, and it costs nothing.
2. **A round-trip test** — every `PlayoutItem` the mapper (§4) produces is `.strict()`-parsed in tests before it is ever written to disk, and `EtvNextPlayoutWriter` parses in development builds before `rename()`.

The channel-config schema gets the same treatment, though it matters less: `deny_unknown_fields` means `next` already rejects a malformed `channel.json` loudly. Generating it anyway is cheap and gives the config writer compile-time types for free.

---

## 7. Mapping tables

### Transcode config → `channel.json` normalization

| Tunarr `TranscodeConfig`                                                                                     | `next` normalization                            | Note                                                        |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| `videoFormat: h264 \| hevc`                                                                                  | `video.format`                                  | direct                                                      |
| `videoFormat: mpeg2video`                                                                                    | —                                               | **unsupported**; must be blocked for `etv_next` channels    |
| `resolution.{widthPx,heightPx}`                                                                              | `video.width`, `video.height`                   | direct                                                      |
| `videoBitRate`, `videoBufferSize`                                                                            | `video.bitrate_kbps`, `video.buffer_kbps`       | direct                                                      |
| `videoBitDepth`                                                                                              | `video.bit_depth`                               | direct                                                      |
| `hardwareAccelerationMode`                                                                                   | `video.accel`                                   | `none` → omit; Tunarr's four are a subset of `next`'s seven |
| `vaapiDevice`, `vaapiDriver`                                                                                 | `video.vaapi_device`, `video.vaapi_driver`      | Tunarr's `system`/`nouveau` have no counterpart             |
| `deinterlaceVideo`                                                                                           | `video.deinterlace`                             | direct                                                      |
| `FfmpegSettings.deinterlaceFilter`                                                                           | `video.filters.{yadif,bwdif,w3fdif}.mode`       | direct                                                      |
| `audioFormat: aac \| ac3`                                                                                    | `audio.format`                                  | direct                                                      |
| `audioFormat: copy \| mp3`                                                                                   | —                                               | **unsupported**; block                                      |
| `audioBitRate`, `audioBufferSize`, `audioChannels`, `audioSampleRate`                                        | corresponding `audio.*`                         | direct                                                      |
| `audioLoudnormConfig`                                                                                        | `audio.normalize_loudness` + `audio.loudness.*` | direct                                                      |
| `ffmpegExecutablePath`, `ffprobeExecutablePath`                                                              | `ffmpeg.ffmpeg_path`, `ffmpeg.ffprobe_path`     | direct                                                      |
| `FfmpegSettings.enableFileLogging`                                                                           | `ffmpeg.reports_folder`                         | direct                                                      |
| `threadCount`, `videoProfile`, `videoPreset`, `audioVolumePercent`, `normalizeFrameRate`, `scalingAlgorithm` | —                                               | **gap**, see §9                                             |
| `errorScreen`, `errorScreenAudio`                                                                            | `fallback.show_error` only                      | Tunarr supplies its own error items instead                 |
| `disableHardwareDecoder/Encoding/Filters`                                                                    | `ffmpeg.disabled_filters` (partial)             | coarser; escape hatch only                                  |

Write the shared part from the `TranscodeConfig` row as the base `channel.json`, and any per-channel deviation as an overlay file — that is what `config_paths` being variadic is for.

### Watermark → `graphics[]`

| Tunarr `Watermark`                                      | `next` `GraphicsLayer`                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `url` (resolved/cached by `ProgramStream.getWatermark`) | `source: { source_type: "local", path }`                                            |
| `position` (4 corners)                                  | `location` (9 anchors; superset)                                                    |
| `width`                                                 | `width_percent` (omit when `fixedSize`)                                             |
| `horizontalMargin`, `verticalMargin`                    | `horizontal_margin_percent`, `vertical_margin_percent`                              |
| `opacity`                                               | `opacity_percent`                                                                   |
| `duration`                                              | `timing.disable_after_ms`                                                           |
| `fadeConfig[].periodMins`                               | `PeriodicTiming { clock: "wall", frequency_ms: 2 * p * 60000, hold_ms: p * 60000 }` |
| `fadeConfig[].leadingEdge`                              | `phase_offset_ms`                                                                   |
| `disableChannelOverlay` / `disableFillerOverlay`        | omit `graphics` on the affected items                                               |

`clock: "wall"` matters: it aligns the fade cycle to wall-clock time so every viewer sees the same phase regardless of when they tuned in, which is the behaviour Tunarr's `leadingEdge` comment describes.

### Probe details → `ProbeHint`

`VideoStreamDetails` → `VideoHint` is near field-for-field (`codec`, `width`, `height`, `pixelFormat`, `framerate`, `profile`, `scanType`, `sampleAspectRatio`, `displayAspectRatio`, `colorRange/Space/Transfer/Primaries`). `AudioStreamDetails` → `AudioHint` needs only `stream_index`, `codec`, `channels`. `SubtitleStreamDetails` → `SubtitleHint` likewise. `StreamDetails.duration` → `duration_ms`. `dv_profile` and `has_hdr10_metadata` have no Tunarr counterpart today; **omitting them is safe** but forfeits `next`'s HDR handling, so the honest move is to omit the whole `ProbeHint` for sources Tunarr knows are HDR and let `next` probe, until Tunarr's scanner records those fields.

---

## 8. Feature flag and stream-mode surface

Two levels, using machinery that already exists.

**A `FeatureFlags` entry** — `ersatzTvNextEnabled`, env `TUNARR_ERSATZTV_NEXT_ENABLED`, category `experimental`, added to `types/src/FeatureFlags.ts` and `FeatureFlagMetadata`. It gates whether `EtvNextService` starts, whether the mode appears in the channel editor, and whether the resolver route is mounted. `FeatureFlagService` and `FeaturesSettingsPage.tsx` render it with no further work.

**A per-channel stream mode** — `etv_next` added to `ChannelStreamModes`, and `etv_next_concat` to `ChannelConcatStreamModes`, in `types/src/schemas/channelSchema.ts`. Both flow automatically into `ChannelStreamModeSchema`, `SessionType`, and the session-key namespace.

Note the migration: `streamMode` is `text({ enum: ChannelStreamModes })` (`server/src/db/schema/Channel.ts:45`), which SQLite enforces as a CHECK constraint, and the table is also queried with `inArray(table.streamMode, table.streamMode.enumValues)`. Adding a value requires a Drizzle migration that rebuilds the constraint — `pnpm drizzle-kit generate` via the `new-migration` skill, and `pnpm resolve-migrations` if it conflicts on merge.

**MPEG-TS clients come almost free.** `ConcatStream` (`server/src/stream/ConcatStream.ts`) already takes a channel's own `.m3u8` URL and remuxes it to MPEG-TS through FFmpeg, which is how `hls_concat` and `hls_slower_concat` serve HDHomeRun and Plex DVR today. Pointing `ConcatStreamModeToChildMode` at `etv_next` gives `etv_next_concat` for free and covers the only output format `next` does not speak.

Per the branch policy in `CLAUDE.md`, this is a large feature needing many prerelease iterations, so it belongs on **`dev`**, not `main`.

---

## 9. Feature parity gaps

| Gap                                                                                                                          | Severity | Disposition                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| No MPEG-TS output                                                                                                            | low      | `etv_next_concat` via existing `ConcatStream`                                                                                                    |
| No `hls_direct` equivalent (remux, no transcode, per-item playlist)                                                          | medium   | Out of scope; `hls_direct`/`hls_direct_v2` remain Tunarr-native modes                                                                            |
| `mpeg2video` video, `mp3`/`copy` audio                                                                                       | medium   | Validate in the channel editor and on the API; refuse `etv_next` for such configs with a clear message                                           |
| `threadCount`, `videoPreset`, `videoProfile`, `audioVolumePercent`, `normalizeFrameRate`, `scalingAlgorithm` not expressible | medium   | Add upstream (D3) — pure config surface, cheap. Until then, surface as "ignored under this backend" in the UI rather than silently dropping them |
| Rich error screens (`static`, `pic`, `testsrc`, `text`) vs. black+silence                                                    | low      | Tunarr emits its own `lavfi`/image items through the resolver; `next`'s fallback becomes a last-resort net only                                  |
| Flex/offline `pic` and `clip` modes                                                                                          | low      | Same — resolver emits an image or file item                                                                                                      |
| HDR/Dolby Vision hints absent from Tunarr's scanner                                                                          | medium   | Omit `ProbeHint` for known-HDR sources so `next` probes; add `dvProfile`/`hasHdr10Metadata` to the media-stream schema later                     |
| Troubleshooting parity with `troubleshootApi.ts`                                                                             | medium   | `ersatztv-channel debug <config>` and the `dossier.rs` output are the equivalents; wire them into the existing troubleshoot surface in phase 4   |
| Segment length fixed at 4s, keyframe at 2s (`crates/ffpipeline/src/pipeline.rs:37`)                                          | low      | Not configurable; note it, since Tunarr's HLS sessions tune this                                                                                 |
| `now_local()` in containers without `TZ`                                                                                     | low      | Set `TZ` on the child and always emit RFC3339 with explicit offsets                                                                              |

---

## 10. Packaging and distribution

Mirror `MeilisearchService` and `download-meilisearch.ts` exactly — that path is proven across all six of Tunarr's targets.

- **Version pin** in `server/package.json`: an `ersatztvNext: { version }` key beside `meilisearch`.
- **Fetch script** `server/scripts/download-ersatztv-next.ts`, pulling `ersatztv-next-<version>-<target>` archives and extracting `ersatztv-channel` (we do not need `ersatztv` or the generator).
- **`make-bin.ts`** gains the download alongside `grabMeilisearch()`. Upstream's release targets cover every Tunarr arch: `windows-x64`, `linux-x64`, `linux-musl-x64`, `linux-arm`, `linux-arm64`, `macos-x64`, `macos-arm64` map onto `win-x64`, `linux-x64`, `alpine-x64`, `linux-arm64`, `macos-x64`, `macos-arm64`.
- **Binary discovery** in `EtvNextBinaryResolver`, following the Meilisearch search order: `TUNARR_ERSATZTV_NEXT_PATH`, then `cwd/bin/<name>`, then `cwd/<name>`, with the `-<platform>-<arch>` and bare variants and a `.exe` suffix on Windows.
- **Docker** — copy the binary in the same layer as Meilisearch. Tunarr's image already builds `FROM ghcr.io/ersatztv/ersatztv-ffmpeg`, so the FFmpeg build `next` targets is the FFmpeg Tunarr already runs. That is a real de-risking factor for the hardware pipelines.
- **macOS bundle** — `macos/` picks up the extra binary the same way it does Meilisearch.

Two details in upstream's release pipeline are worth banking. The binaries are **code-signed and notarized** — Azure Trusted Signing on Windows, Apple Developer ID plus `notarytool` on macOS (`.github/workflows/artifacts.yml`). For Tunarr's macOS bundle that is a meaningful gift, though it needs verifying that the signature survives re-bundling into Tunarr's `.app`. And licensing is clean: `next` is MIT, Tunarr is Zlib, both permissive, and the binary ships as a separate executable rather than linked code. Carry upstream's MIT notice in the distribution and that is the end of it.

**The blocker is versioning, and it is large enough to have its own section — see §12.**

---

## 11. Phased work plan

**Phase 0 — spike (no product surface).** A script that writes a `channel.json` and a hand-built playout for one real Tunarr channel, runs `ersatztv-channel run` against a temp folder, and plays the result in VLC. Confirms FFmpeg compatibility, hardware accel on the target box, and the `ProbeHint` path before any Tunarr code is written. One to two days.

> **Phase 0 ran on 21 September 2026**, out of order, against `ersatztv-channel 0.1.0-ed95077` — the pinned binary, version-matched at run time. `server/scripts/etv-smoke.ts` covers the on-disk contract with a lavfi source; `server/scripts/etv-smoke-ext.ts` covers real media. Results in §11.A.

**Phase 1 — schemas and mapping layer, unit-tested, no process.** Vendor `next`'s three JSON Schemas, add `server/scripts/generate-etv-schemas.ts` and the generated Zod output (§6), plus the schema-vs-Rust drift check. Then `EtvNextChannelConfigWriter` and `EtvNextPlayoutItemMapper` with Vitest coverage over each `StreamLineupItem` variant and each `StreamSource` variant, every case `.strict()`-parsed against the generated schema. Pure functions, no I/O — this is where the timing arithmetic of §4 gets pinned down by tests rather than by debugging a live stream.

**Phase 2 — session and packaging.** `EtvNextBinaryResolver`, `EtvNextService` (binary discovery, version check, orphan reaping via the PID-file pattern), `EtvNextSession` (spawn, `.ready` wait, `.heartbeat` touch, teardown), `EtvNextPlaylistCreator`. Download script and `make-bin.ts` wiring. At the end of this phase a channel streams from a **pre-materialized** playout — simpler to debug than the callback. **This path is permanent, not scaffolding** (F9): a one-item playout is exactly what a diagnostic transcode needs, so `POST /troubleshoot` runs through it for `etv_next` channels. It also remains the fallback if the dynamic resolver proves problematic, and the thing `ersatztv-channel debug` is pointed at.

**Phase 3 — dynamic resolution.** `/api/etv/playout-item`, bearer-token auth via `{{TUNARR_ETV_TOKEN}}`, redirect flattening, the play-history side-effect audit from §4, and `EtvNextPlayoutWriter`'s rolling window with refresh-on-lineup-change. This is where on-demand channels, filler, and error degradation start working.

**Phase 4 — product surface.** Feature flag, the `streamMode` migration, channel-editor option with validation for the unsupported codec combinations, `etv_next_concat` for HDHR/Plex DVR, session reporting in `sessionApi`, troubleshooting via `ersatztv-channel debug`, and docs. Documentation lands in `docs/configure/channels/transcoding.md` plus a new page under `docs/configure/ffmpeg/`, registered in `mkdocs.yml` — required by the repo rule that behaviour changes update the docs.

Phases 1 and 2 are independently useful and independently revertable. Phase 3 is where the design risk concentrates.

### 11.A Phase 0 results

Run on an Intel CometLake-S UHD 630 with the iHD VAAPI driver, ffmpeg 6.1.1, against `ersatztv-channel 0.1.0-ed95077`. Four scenarios, each a 60-second window filled by repeating one fixture, run to `.ready`.

| Scenario              | Segments | ffprobe calls | Video codec   | Verdict                    |
| --------------------- | -------- | ------------- | ------------- | -------------------------- |
| `local-h264`          | 4        | 5             | `libx264`     | transcodes                 |
| `probe-hint-and-seek` | 4        | **0**         | `libx264`     | hint honored               |
| `hdr10-tonemap`       | 4        | 6             | `libx264`     | tonemaps                   |
| `vaapi`               | 4        | 5             | **`libx264`** | **accel silently dropped** |

**The on-disk contract holds.** The real parser accepts Tunarr's `channel.json` and the `{start}_{finish}.json` playout filename, publishes `.ready`, and writes the documented file set. Tunarr's routing already serves all of it, including the `.vtt` subtitle segments and `ffmpeg.m3u8` (`streamApi.ts:322,385`).

**Probe hints work, and the saving is real.** The hinted scenario ran ffprobe zero times against five and six for the unhinted ones. The worker trusts a supplied hint and opens the source once instead of twice, as documented.

**Segment count proves nothing on its own.** All four scenarios produced four healthy segments and reported zero ignored settings, including the one that quietly encoded in software. This is why `etv-smoke-ext.ts` has a `--trace` mode: the channel config points at a shim that logs every ffmpeg and ffprobe invocation before exec'ing the real binary. Without it the VAAPI defect below is invisible — the stream plays, it just costs a CPU it should not.

#### The VAAPI defect has a Tunarr-side half

G5 in the register predicted that `next` drops hardware acceleration unless `vaapi_device` **and** `vaapi_driver` are both set. Confirmed, and worse than recorded, because Tunarr is what omits the field.

Same channel, same fixture, differing only in whether `vaapi_driver` is present:

```
absent  ->  -vcodec libx264     scale=640:360:flags=fast_bilinear
"ihd"   ->  -vcodec h264_vaapi  -vaapi_device /dev/dri/renderD128
                                scale_vaapi=640:360,hwdownload,format=nv12,…,hwupload
```

Hardware decode, hardware scaling and hardware encode are all lost, not just the encoder.

`EtvNextChannelConfigMapper.ts:279-281` omits `vaapi_driver` when Tunarr's value is `system`, on the stated reasoning that _"`system` means 'let the driver decide', which is the same as omitting it."_ That is false against this binary. Two things make it bite rather than lurk:

- `vaapiDriver` **defaults to `system`** (`TranscodeConfig.ts:148`), so this is the stock configuration, not an unusual one.
- `findIgnoredSettings` explicitly exempts `system` from the ignored-settings warning (`:225-232`), so `EtvNextCompatibilityNotice` stays silent and the user is told nothing.

A VAAPI channel therefore keeps working under `etv_next` and simply stops being a VAAPI channel, with no warning in the UI and nothing in the log. Upstream inferring a default (G5, §14 tier 2) is the real fix; Tunarr surfacing the downgrade is the one available now. Decision pending.

---

## 12. Version coupling: the shipping blocker

This is the gate. Not because the problem is hard, but because the fix is upstream's to make, and shipping a bundled binary Tunarr cannot pin, verify, or refuse is not something to do behind a feature flag and hope.

### Six coupled surfaces, one negotiation mechanism

Tunarr and a bundled `ersatztv-channel` agree on six things. Exactly one of them can be negotiated at runtime.

| #   | Surface                                                                                                                           | Versioned?                                                                                                                                                        | What a mismatch does                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Playout schema**                                                                                                                | **Yes.** `version` URI on every document; `from_file` rejects a differing `breaking` digit or a `compatible` digit above its own `SUPPORTED_SCHEMA` (today `0.4`) | Loud, correct failure at load                                                                                                                        |
| 2   | **Channel config schema**                                                                                                         | **No.** `channel_config.json` has no version field at all — root properties are `fallback`, `ffmpeg`, `normalization`, `playout`                                  | Silently ignored. `ChannelConfig` has no `deny_unknown_fields` (`config.rs:22-23`), so a key an older binary does not know is dropped without a word |
| 3   | **Binary build**                                                                                                                  | **Yes, precisely.** `--version` reports `ETV_VERSION_STRING`, built from CI's `${tag}-${short_sha}` — e.g. `0.1.0-ed95077`                                        | Nothing checks it today; Tunarr must                                                                                                                 |
| 4   | **Output folder filenames** (`live.m3u8`, `live_sub.m3u8`, `ffmpeg.m3u8`, `live%06d.ts`, `.ready`, `.heartbeat`)                  | **No.** Internal constants in `channel_session.rs` and `ersatztv-core`                                                                                            | A rename silently produces a session that never becomes ready — Tunarr waits 30s and reports "not ready" with no clue why                            |
| 5   | **Dynamic callback contract** (`x-etv-channel`, `x-etv-now`, `x-etv-until`, `x-etv-dynamic-id`, and the clamp/no-recursion rules) | **No.**                                                                                                                                                           | A changed header name makes the resolver answer for the wrong channel or time                                                                        |
| 6   | **Segment and keyframe timing** (`SEGMENT_SECONDS = 4`, `KEYFRAME_INTERVAL_SECONDS = 2`)                                          | **No.** Compile-time constants                                                                                                                                    | Playlist and player assumptions shift under us                                                                                                       |

Surface 1 is well designed and we should use it deliberately: because the check is `found.compatible > SUPPORTED.compatible`, an **older** playout version is accepted and a newer one is rejected. Tunarr should therefore emit the **lowest** schema version carrying the features it actually uses, not the newest — that maximizes the range of binaries that accept our documents. Emitting `0.0.4` because it is current would gratuitously break against a `0.0.3` binary.

Surface 2 bites quietly rather than loudly, which is worse. A Tunarr upgrade that starts emitting a new normalization key, paired with a user's pinned older binary, does not fail at spawn — the key is dropped and the channel streams at the wrong settings. Hardware acceleration silently reverts to software, a bit-depth request is ignored, and the only symptom is a slow transcode nobody can account for. The playout path drops unknown keys the same way (§6), so both contracts fail by omission. Tunarr's `.strict()` validation is the only thing standing between a config typo and a mystery performance regression.

### What upstream publishes today, precisely

Better than "nothing," and the gap is narrower than it first appears.

- A semver tag exists: `v0.1.0`, alongside the rolling `develop` tag.
- CI computes `release_version` as `git describe --tags --abbrev=0` plus the short SHA, so **asset names are already unique per commit** — `ersatztv-next-v0.1.0-ed95077-linux-x64.tar.gz`.
- All seven targets Tunarr needs are built, signed, and notarized.

**The problem is asset garbage collection, not naming.** The publish job runs, conditional on `release_tag == 'develop'`:

```
gh release view develop --json assets --jq '.assets[].name'
  | grep '<target><ext>'
  | xargs -r gh release delete-asset develop {} --yes
```

Every push to `main` **deletes the previous commit's asset** for each target before uploading the new one. So a pinned URL resolves for exactly as long as no one merges to `main`, then 404s. That — not the absence of a version string — is what makes the `develop` release unpinnable.

And the conditional is the good news: **the delete step is skipped for any tag other than `develop`.** A real tagged release keeps its assets immutably. The machinery for versioned releases already exists upstream and is already driven correctly; it simply is not being invoked for tags yet. That makes the ask small.

### The upstream ask, sharpened

1. **Cut tagged releases** — run the existing `artifacts.yml` with `release_tag` set to a version tag rather than `develop`. No new pipeline, no new signing setup; the workflow already does the right thing when the tag is not `develop`. This alone unblocks pinning.
2. **Version the channel config** — a `version` field plus an accepted range, so surface 2 gains the negotiation surface the playout schema already has. Without it, `deny_unknown_fields` converts every forward-compatible addition into a breaking change for pinned downstreams.
3. **A `--describe` / `--capabilities` subcommand** emitting JSON: binary version, supported playout schema range, channel-config schema version, output-folder filenames, dynamic-callback version. One machine-readable handshake replaces five implicit couplings, and it is the single change that would let Tunarr detect an incompatible binary at startup instead of at first viewer.

Items 2 and 3 are nice-to-have. **Item 1 is the gate.**

### What Tunarr does regardless

These hold even if upstream never changes anything, and they should be built in phase 2 rather than retrofitted.

- **Pin by content, not by URL.** Record both the version string and a per-target SHA-256 in `server/package.json` beside the `meilisearch` key. Verify the hash after download and fail the build on mismatch. This is what makes a `develop` artifact usable at all: mirror it once into a location Tunarr controls, and the upstream GC stops mattering.
- **Verify at startup.** Exec `ersatztv-channel --version`, compare against the pin, and refuse to enable the mode on mismatch with a message naming both versions. `MeilisearchService.getMeilisearchVersion()` already establishes this pattern, including the "what do we do when they differ" question it currently answers with a `TODO`.
- **Validate the config before writing it.** `.strict()`-parse the generated `channel.json` against the Zod schema (§6) at service start. This is the single highest-value defence on this list, because nothing on the `next` side will catch the mistake — `ChannelConfig` has no `deny_unknown_fields`, and `ersatztv-channel debug` loads through the identical `from_sources` path as `run` (`main.rs:80-82`), so it validates nothing the worker would not already accept. `debug` remains worth running for its FFmpeg capability probe and its hardware-pipeline construction log, but it is a print-and-probe tool, not a validator.
- **Assert the output contract.** After `.ready` appears, check that `live.m3u8` exists; fail the session with a specific error if not. Turns surface 4 from a mystery timeout into a diagnosis.
- **Emit the minimum viable playout schema version**, per above, and keep it in one constant next to the binary pin so the two move together.
- **Treat the vendored schemas as part of the pin.** The copies of `playout.json` / `channel_config.json` under version control, the generated Zod (§6), the emitted `version` string, and the binary hash are one unit. Bumping any one without the others is the bug this whole section exists to prevent.

---

## 13. Review agenda: what to grill

Ordered roughly by how much of the design each answer could invalidate.

**1. Dynamic resolver as the default (§4).** The strongest claim in this document and the least proven. It rests on behaviour that is emergent rather than documented — a long-window placeholder being re-resolved every tick follows from `get_current_item` plus `rfind`, but upstream has not promised it. If that is wrong, or if upstream changes it, the design falls back to pre-materialized playouts and the invalidation problem returns in full. **Is a per-item HTTP round trip on the playback path acceptable at all?** What happens to a worker whose callbacks fail while Tunarr restarts — it degrades to black, and Tunarr's restart does not kill orphaned workers unless we make it. _(Answered — F2, F4, F7. The re-resolution behaviour is no longer unproven: `PlayoutLoader` is stateless, holds no cursor or consumed-set, and re-reads the window file uncached on every `transcode()` call, so a long-window placeholder is provably re-resolved. It remains undocumented, which is C5, not a correctness risk. The round trip is cheap — roughly one call per 44 seconds of scheduled content. The restart case is the real cost and is quantified in B2: 60 seconds of black per failed callback, which is what F7's failure budget exists to bound.)_

**2. What is the end state?** This document plans an alternate backend. The stated ambition is transitioning _away_ from Tunarr's own streaming code. Those are different projects. If `etv_next` is a permanent second option, Tunarr maintains two backends forever and the parity gaps in §9 must all be closed. If it is a migration path, we need deprecation criteria now — which modes die, when, and what happens to `hls_direct`/`hls_direct_v2`. _(Answered — F1. It is a migration path, pursued as a partnership, entered as an evaluation spike built to permanent standards. `hls_direct` v1 retires. The premise that the direct modes "have no `next` equivalent at all" was wrong: omitting `video.format`/`audio.format` already yields copy codecs, and `output_format.rs:37` already suppresses the keyframe options under copy. What is missing is the container and per-item playlist model — D1 — not codec passthrough.)_

**3. Work-ahead side effects (§4).** The resolver is asked about a moment up to 44s in the future. _(Largely dissolved — **Tunarr already does this, and further ahead.** `HlsSession` calls `getCurrentLineupItem` with `transcodedUntil` rather than wall clock (`HlsSession.ts:225-231`) and buffers up to 60 seconds (`:176-190`); `HlsSlowerSession` does the same (`:51-58`); `nativePlaybackApi.ts:146` deliberately asks about `now + streamDuration + 1`. Each of those already writes a `program_play_history` row with a future `playedAt` (`StreamProgramCalculator.ts:246, 256-262`). `next`'s 44 seconds is **less** lookahead than the existing HLS path. If this is a defect it is a present-day defect in `hls` and `hls_slower`, not one this integration introduces.)_

Three real issues sit underneath it, and they are pre-existing rather than new. `isProgramCurrentlyPlaying` (`ProgramPlayHistoryDB.ts:194-206`) considers only the most recent play by `playedAt desc`, so a future row becomes "most recent" and suppresses later checks; the rollback that would fix it, `deleteByChannelIdAfter` (`:122-133`), has zero non-test callers. Filler selection advances a process-global Mersenne Twister (`FillerPickerV2.ts:82, 185`), so a lookahead call changes what a later real call picks. And error degradation fires only when `req.sessionToken` is set (`StreamProgramCalculator.ts:275-287`), so **the resolver must pass a stable per-session token or `etv_next` silently loses it** — note `StreamThrottler` keys on wall clock rather than `startTime` (`StreamThrottler.ts:44`), and leaks `previous` between session tokens (`:14, 46`).

**4. Process model (§3).** One extra supervisor per active channel. _(Answered — the supervisor is cheap. Its loop sleeps in 5-second ticks whenever the buffer exceeds a minute (`channel_session.rs:267-269`), and its work per cycle is one small JSON parse per ~44 seconds of content. Eight active channels generate roughly one loopback callback every five seconds. The real cost is resident memory — a tokio runtime per channel, low tens of MB each — which phase 0 should measure on target hardware. What keeps the count bounded is orphan reaping, so this depends on A1 being fixed.)_ The Option A reconsideration hinges on B4 (a roster-reload endpoint).

**5. Subtitle and audio-rendition parity.** `next` emits one subtitle rendition (`live_sub.m3u8`) with burn-or-convert. Tunarr's `hls_direct_v2` path carries `StreamRenditions` with multiple audio tracks and language selection. What does an `etv_next` channel do for a user who switches audio tracks mid-stream? _(Answered — F3. Deferred by decision; the shape of a solution and the one thing to settle early are recorded in E.1.)_

**6. Failure semantics.** `next` degrades to black-and-silence and never exits. Tunarr's error screens are richer and its sessions fail loudly. Which behaviour wins, and how does a user tell "flex" from "broken"? _(Answered — F7. Tunarr's error screens win and survive untouched, because the resolver supplies them as ordinary items. The gap is the failed-callback case, closed by B2's failure budget.)_

**7. Configuration model.** Tunarr's `TranscodeConfig` is a shared row; `next`'s config is per-channel with overlays. _(Answered — F5, F6. The overlay mechanism turns out to have nothing to carry: Tunarr has no per-channel config deltas at all, only a many-to-one pointer at a shared named row. Compose one `channel.json` per spawn and pipe it via stdin. Validation refuses at assign time and warns at config-save time, and because configs are shared it spans config, dependent channels and their stream modes in both directions — the first cross-field validation Tunarr will have.)_

**8. Testing.** Phase 1 is pure and testable. Phases 2–4 involve a child process, FFmpeg, and real media. What does CI actually run? _(Answered — F8. The premise that Tunarr has avoided committing media fixtures was wrong: `server/src/testing/ffmpeg/fixtures/` already holds 11 MB of them.)_

**9. Support surface.** Every `etv_next` bug report arrives with a hardware pipeline Tunarr's maintainers did not write. _(Answered — F9. The premise weakened once the posture became co-development rather than consumption: a pipeline bug is fixable, not a dead end. What remained was operational, and `next` turns out to capture more per-failure detail than Tunarr does.)_

---

## 14. `next` work list

Every change needed on the `next` side, consolidated from the register in §15 so it can be worked independently of the Tunarr scaffolding. Register IDs are the cross-reference; go there for evidence and file:line.

Ordered by what to do first. Items in tiers 1 and 2 need no agreement with Tunarr and can start immediately.

### Tier 1 — independent, small, no design discussion

Start here. Each is self-contained, wrong for ErsatzTV regardless of Tunarr, and cheap enough to demonstrate the collaboration works before anything structural depends on it.

| ID      | Change                                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1 + C8 | Make work-ahead configurable. The depth is `SEGMENT_SECONDS * 11` with `11` a bare literal at one site; the 1-minute refill, 30-second realtime and 5-second idle-sleep thresholds are literals in the same loop. Fold in `SEGMENT_SECONDS`/`KEYFRAME_INTERVAL_SECONDS`. |
| A1      | Fix the `.heartbeat` self-reap hole — staleness is evaluated only when the file already exists, so a worker that never receives a segment request transcodes forever.                                                                                                    |
| A5 + C4 | Hoist the output filenames into shared constants in `ersatztv-core` beside `READY_FILE_NAME`. They are inline literals in one crate and hardcoded again in another.                                                                                                      |
| A2      | Stop swallowing mid-scan `read_dir` errors in the window-file search; an IO fault currently reports as a scheduling gap.                                                                                                                                                 |
| A6      | Reconcile `#EXT-X-VERSION:6` in the multivariant against `:7` in the media playlist.                                                                                                                                                                                     |
| A7      | Skip binding the `local_proxy` loopback socket for sessions with no `ScriptCommand`.                                                                                                                                                                                     |
| A8      | Add a `license` key to the workspace `Cargo.toml` files.                                                                                                                                                                                                                 |
| A9      | Run tests for `linux-musl-x64` and `linux-arm`, which currently compile them and never execute them.                                                                                                                                                                     |
| A3      | Distinguish epoch seconds from milliseconds by magnitude rather than string length in `parse_playout_filename`.                                                                                                                                                          |

### Tier 2 — blockers, independent

Required before `etv_next` can ship, and none of them needs Tunarr to exist first.

| ID  | Change                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B6  | Add a scaling-algorithm config field. `flags=fast_bilinear` is hardcoded at both scale sites with no configuration anywhere. **The most user-visible item on this list** — it degrades every scaled frame for every viewer.                                                                                         |
| B7  | Rewrite DTS and TrueHD to AC-3 under copy. Neither muxes for AVPlayer, so Apple clients currently lose audio outright.                                                                                                                                                                                              |
| B8  | Synthesize `anullsrc` when a source has no audio stream, instead of erroring to the fallback card. The primitive already exists in the fallback path.                                                                                                                                                               |
| B2  | Retry with backoff on a failed dynamic callback, a configurable fallback quantum instead of a hard-coded 60 seconds, and a **failure budget that exits non-zero** after N consecutive failures or M seconds of continuous fallback.                                                                                 |
| B5  | Read `in_point_ms`/`out_point_ms` from every source variant, not only `Local` and `Http`. A resolved dynamic item returning Lavfi silently seeks to zero.                                                                                                                                                           |
| G7  | Restore four implicit FFmpeg behaviours Tunarr applies today: `-preset veryfast` (needs D3's preset surface), `-sc_threshold 0`, `-muxdelay 0 -muxpreload 0`, and the QSV-specific `aresample=async=1000`.                                                                                                          |
| G5  | Infer a default VAAPI device and driver rather than silently dropping hardware acceleration when `vaapi_device` and `vaapi_driver` are not both set. **Confirmed empirically, 21 Sep 2026** (§11.A) — hardware decode, scaling and encode are all lost, and Tunarr's default `vaapiDriver` of `system` triggers it. |
| G4  | Emit `service_provider` / `service_name` output metadata. Players that surface it currently show blank.                                                                                                                                                                                                             |
| B3  | Cut tagged releases. The `develop` release deletes each target's previous asset on every push to `main`; the delete step is already gated on the tag being `develop`, so a version tag fixes it with no new pipeline. **Repo/CI work, not code.**                                                                   |

### Tier 3 — contract and schema, needs shape agreed first

These define the seam between the projects, so settle the shape before implementing.

| ID      | Change                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C9      | A `--describe` capability handshake emitting JSON: supported formats and accel modes, playout schema range, channel-config schema version, output filenames, callback contract version, timing constants and their bounds — plus a runtime layer reporting what this machine can actually do. **Highest leverage item in the register**; it subsumes C3, C4, C5 and C8 as negotiable rather than implicit. |
| C1 + C2 | Add `deny_unknown_fields` at the `ChannelConfig` root and across the playout model. Both files currently swallow typos in silence.                                                                                                                                                                                                                                                                         |
| C3      | Add a `version` field and accepted range to the channel config, mirroring the playout schema.                                                                                                                                                                                                                                                                                                              |
| C5      | Document and version the dynamic callback contract — the four `x-etv-*` headers, the shift-then-clamp rule, the no-recursion rule. Confirm that re-resolving a long-window placeholder is intended rather than incidental; the behaviour is verified but undocumented.                                                                                                                                     |
| C6      | Derive `schema/playout.json` with `schemars`, or take Tunarr's drift-check script. **It must live here** — Tunarr vendors the schemas, not the Rust source, so it cannot run the check in its own CI.                                                                                                                                                                                                      |
| C7      | Make `debug` a real validator, or retire the claim. It currently uses the identical load path as `run` and validates nothing extra.                                                                                                                                                                                                                                                                        |
| E.1     | Widen `PlayoutItemTracks.audio` to accept either a single `TrackSelection` or a list, via an untagged serde enum. **Do this early even though multi-audio ships later** — done later it is a breaking schema change forcing a lockstep release.                                                                                                                                                            |

### Tier 4 — parity features, larger

| ID  | Change                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3  | Encoder tuning surface: preset, profile, thread count, audio volume filter. Pure config, no new capability. Thread count is currently hardcoded to 0 or 1.                                                            |
| D6  | Error-screen types (`static`, `pic`, `testsrc`, `text`) and error-screen audio (`sine`, `whitenoise`) beyond the single `show_error` boolean over a fixed black-and-silence card. Plus a custom offline/flex picture. |
| —   | Per-mode hardware disable switches for decoder, encoder and filters. Acceleration is all-or-nothing today, and these are the standard escape hatch when a vendor driver is broken.                                    |
| —   | Configurable FFmpeg log level; currently hardcoded to `Error`.                                                                                                                                                        |
| D2  | Add `mpeg2video` and `mp3` output formats. Two enum variants and two `as_arg` arms each.                                                                                                                              |
| D1  | The `hls_direct_v2` equivalent: container choice (mkv/mpegts/mp4) and a per-item playlist model. Copy codecs already work, so this is the container and playlist layer, not codec passthrough.                        |
| D5  | Measure `BANDWIDTH` for the multivariant rather than estimating it from config.                                                                                                                                       |

### Tier 5 — deferred

| ID       | Change                                                                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D4 + E.1 | Multi-audio renditions: `AudioNormalizationConfig` from one triple to a list of declared renditions, `PlayoutItemTracks.audio` to a positional list, N media playlists, N `#EXT-X-MEDIA` lines. Design recorded in §15.E.1. Only the field-shape change belongs in tier 3. |
| B4       | Roster reload or channel-registration endpoint. **Only blocks Option A, which this design does not use.** Worth doing for other downstreams; not needed here. Pair with A4.                                                                                                |
| A4       | Stop `empty_folder` recursing the shared output root on startup, which deletes every channel's live segments on any restart. Pairs with B4.                                                                                                                                |
| C-ext    | A public library surface on `ersatztv-channel`, if in-process embedding ever becomes a goal. Currently `lib.rs` exports only `config` and `error`. Low priority — the process boundary is a feature for hardware-accel code (§3).                                          |
| —        | A `PlayoutItem` field meaning "do not probe, this is live or unbounded" on `LocalSource`, matching `is_live` on `HttpSource`.                                                                                                                                              |

### Not `next` work

Recorded so they are not picked up by mistake. **G6** (channel-icon-as-watermark and logo fallbacks) is Tunarr-side — the mapper resolves the icon and emits a graphics layer. The **stream-selection profile engine**, **on-demand channels**, **connection tracking** and **idle teardown** all stay in Tunarr and are unaffected by which backend encodes.

---

## 15. `next` defect register

Every row below was verified by source inspection against `next` at `ed95077`. This is the working list for the onboarding — the things to fix, upstream or locally, as part of adopting the project rather than after it.

This is the evidence. §14 is the same material reorganized as an ordered work list for the `next` side alone — go there to start work, come here for the file:line that justifies each item. Earlier drafts framed these as asks to a third party; under a co-development arrangement they are joint work items, and the ordering in §14 reflects what to contribute first rather than what to request.

### A. Upstream bugs

Wrong for ErsatzTV independent of Tunarr. Best first contributions, because they cost nothing politically and demonstrate the collaboration works.

| #   | Defect                                                                                                                                                                                                                                                    | Location                                                                            | Impact                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1  | `.heartbeat` staleness is evaluated only when the file already exists. A worker whose client fetches the multivariant and then vanishes before any segment request never gets a `.heartbeat`, so `timeout` stays false and the 90s self-reap never fires. | `playlist_manager.rs:272`; file created only at `ersatztv/src/main.rs:358-361`      | Resource leak. The worker and its FFmpeg transcode indefinitely.                                         |
| A2  | `while let Ok(Some(entry))` silently swallows a mid-scan `read_dir` error and truncates the window-file search.                                                                                                                                           | `playout_loader.rs:47-77`                                                           | An IO fault is misreported as `PlayoutJsonNoFileForTime`, so a disk problem looks like a scheduling gap. |
| A3  | `parse_playout_filename` distinguishes seconds from milliseconds by string length rather than magnitude. Zero-padded and pre-1970 negative values of 11+ characters are misread, and integer division truncates sub-second precision.                     | `playout.rs:448-456`                                                                | Latent. Bites any consumer emitting padded epochs.                                                       |
| A4  | Startup `empty_folder` recurses the shared output root, so restarting to pick up one channel deletes every other channel's live segments.                                                                                                                 | `ersatztv/src/main.rs:133`; `ersatztv-core/src/lib.rs:19-37`                        | Every active viewer re-buffers on any roster change.                                                     |
| A5  | Output filenames are bare inline literals in `ersatztv-channel` and hardcoded a second time in `ersatztv`. The two crates agree by convention, with no shared constant.                                                                                   | `ersatztv-channel/src/channel_session.rs:113-135` vs `ersatztv/src/main.rs:245,254` | A rename in one crate silently breaks the other.                                                         |
| A6  | The multivariant playlist declares `#EXT-X-VERSION:6` while the media playlist declares `#EXT-X-VERSION:7`.                                                                                                                                               | `ersatztv/src/main.rs:241-242` vs `playlist_manager.rs:286-289`                     | Spec inconsistency.                                                                                      |
| A7  | `local_proxy` binds an ephemeral loopback TCP port on every session unconditionally, including sessions with no `ScriptCommand`.                                                                                                                          | `channel_session.rs:169`; `local_proxy.rs:43-57`                                    | An unnecessary socket per active channel.                                                                |
| A8  | No `license` key in any `Cargo.toml`, despite an MIT `LICENSE` at the workspace root.                                                                                                                                                                     | workspace root and all crates                                                       | Blocks crates.io publication later.                                                                      |
| A9  | `linux-musl-x64` and `linux-arm` compile their tests but never run them.                                                                                                                                                                                  | `artifacts.yml:74-116`                                                              | Two shipped targets are untested.                                                                        |

### B. Integration blockers

These must be fixed or deliberately worked around before `etv_next` can ship.

| #   | Defect                                                                                                                                                                                                                                                                    | Location                                                                  | Disposition                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Work-ahead is not configurable. The depth is `SEGMENT_SECONDS * 11`, where `11` is a bare literal at a single site. The 1-minute refill threshold, the 30-second realtime threshold and the 5-second idle sleep are literals in the same loop.                            | literal at `channel_session.rs:1027`, block `:1024-1028`; loop `:267-269` | Small, self-contained, useful to both projects. The right first joint PR.                                                                                                                                                                                                               |
| B2  | A failed dynamic callback costs a hard-coded 60 seconds of black with no retry and no backoff. The next attempt is the next `transcode()` call. There is also no failure budget — the worker degrades to black and continues indefinitely, with no state that terminates. | `fallback.rs:25-32`; `channel_session.rs:1062`                            | Needs three things together: retry with backoff, a shorter or configurable fallback quantum, and a **failure budget that exits non-zero**. See below. **The largest operational risk in the dynamic design**, and co-location makes it worse because local Tunarr restarts are routine. |
| B3  | The `develop` release deletes each target's previous asset on every push to `main`, so no upstream artifact stays pinnable. The delete step is already gated on `release_tag == 'develop'`, so tagged releases keep their assets.                                         | `artifacts.yml:272-279`                                                   | Fixed by cutting tagged releases. No new pipeline and no new signing setup.                                                                                                                                                                                                             |
| B4  | No roster reload. `LineupState.channels` is built once and `Arc`'d. There is no reload endpoint, no filesystem watch, and no `SIGHUP` handler — only `ctrl_c` and `SIGTERM`.                                                                                              | `ersatztv/src/main.rs:115-139`, `:66-88`                                  | Only blocks Option A (§3). Pair with A4.                                                                                                                                                                                                                                                |
| B5  | `in_point_ms` and `out_point_ms` are read only from the `Local` and `Http` source variants. A resolved dynamic item returning Lavfi or Rtsp silently gets an in-point of 0.                                                                                               | `channel_session.rs:982-993`                                              | A trap for the mapper (§4). Fix upstream, or assert against it in the phase-1 tests.                                                                                                                                                                                                    |
| B6  | **Software scaling is hardcoded to `flags=fast_bilinear`** at both scale sites, and no scaling-algorithm configuration exists anywhere in the workspace. Tunarr defaults to `bicubic`.                                                                                    | `video_filter.rs:228`, `:540`                                             | Promoted from G1. Every scaled frame on every software-path channel degrades visibly, for every viewer, with nothing configured and nothing logged. Add a scaling-algorithm field to `VideoNormalizationConfig` — it is a format-string change plus a config enum.                      |
| B7  | **DTS and TrueHD are not rewritten to AC-3 under copy.** Tunarr does this because neither muxes for AVPlayer.                                                                                                                                                             | none in `crates/`; cf. `FfmpegStreamFactory.ts:699-717`                   | Promoted from G2. Apple clients lose audio outright on affected titles. Per-stream codec override in copy mode.                                                                                                                                                                         |
| B8  | **No silent-audio synthesis for video-only sources.** `select_audio_stream` errors when a source has no audio, dropping the item to the fallback card.                                                                                                                    | `input.rs:75-110`; cf. `FfmpegStreamFactory.ts:586-589`                   | Promoted from G3. Silent films and video-only files stop playing entirely. Synthesize `anullsrc` when no audio stream is present — the primitive is already there (`channel_session.rs:1080`).                                                                                          |

#### B2 in full: retry, backoff, and a failure budget

The retry half is ordinary. The failure budget is the part that preserves Tunarr behaviour, and it is why this is one change rather than two.

Tunarr today can decide a channel is broken and say so. `TranscodeConfig.errorScreen` accepts `static | pic | blank | testsrc | text | kill`, and `kill` ends the stream outright. `Session` moves to `state: 'error'` and stops immediately (`Session.ts:253-281`), which surfaces in the UI and lets the client show a connection error rather than a blank picture. `next` has no equivalent — `FallbackReason` degrades to black and the worker continues forever. Adopting it as-is would mean **`errorScreen: kill` silently stops working and loud session failure becomes impossible**, which is a regression in exactly the category this migration is meant to avoid.

The resolver already preserves the easy half. Tunarr's rich error screens survive untouched, because the resolver returns its own Lavfi or image item and `next` merely transcodes it; `next`'s own fallback drops back to being a last-resort net. The gap is only the case where the **callback itself** fails, because Tunarr cannot supply an error item when Tunarr is the thing that is down.

**The change:** after N consecutive failed callbacks, or M seconds of continuous fallback, the worker exits non-zero. Both bounds configurable, alongside B1's other knobs. Tunarr's existing `ChildProcessHelper` — restart-on-failure with attempt limits and `AbortController` teardown — then does what it already does for every other child process, and `errorScreen: kill` becomes expressible again as "let the budget expire and do not restart."

This is worth doing upstream rather than working around, because every consumer needs it. A backend that cannot distinguish "this item failed" from "this channel is dead" gives viewers no way to tell a scheduling gap from a total outage, and gives operators no signal to alert on. The distinction is not Tunarr-specific.

**Until it exists**, Tunarr infers sustained failure from the outside — the resolver going uncalled for longer than the work-ahead window is a reliable proxy — and ends the session itself. Adequate as a stopgap, and it should not survive into the steady state, because inferring a process's internal state from its output is exactly the coupling C9 exists to remove.

### C. Contract hardening

`next` was built as one application's internal machinery. A second consumer needs these seams made explicit.

| #   | Gap                                                                                                                                                                                                                                        | Location                                                       | Ask                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `ChannelConfig` carries no `deny_unknown_fields`. Only 11 of 20 structs in `config.rs` do, and all 11 are video-filter option types. A typo'd root key such as `normalisation` is silently ignored by both `run` and `debug`.              | `config.rs:22-23` vs `:150`, `:165-219`                        | Add it at the root, or accept that Tunarr validates with Zod before writing.                                                                                                                    |
| C2  | The playout model carries `deny_unknown_fields` nowhere. Playout typos are silently ignored end to end. Upstream's own `examples/playout/playout.json` carries a `generated_at` key that exists in neither the schema nor the Rust struct. | zero occurrences in `playout.rs`                               | Same treatment as C1.                                                                                                                                                                           |
| C3  | `channel_config.json` has no version field, so the channel config has no negotiation surface at all. Only `playout.json` is versioned.                                                                                                     | `config.rs:22-38`; `schema/channel_config.json`                | Add a `version` plus an accepted range, mirroring the playout schema.                                                                                                                           |
| C4  | The output-folder filenames are undocumented internals — `live.m3u8`, `live_sub.m3u8`, `ffmpeg.m3u8`, `live%06d.ts`, `.ready`, `.heartbeat`. Option B depends on all of them.                                                              | `channel_session.rs:113-135`; `ersatztv-core/src/lib.rs:11,14` | A documented stability contract, or a `--describe` handshake. Pair with A5.                                                                                                                     |
| C5  | The dynamic callback contract is undocumented — four `x-etv-*` headers, the shift-then-clamp rule, and the no-recursion rule.                                                                                                              | `channel_session.rs:1203-1302`                                 | Document and version it. Also confirm that re-resolution of a long-window placeholder is intended rather than incidental. The behaviour is verified, but it is emergent.                        |
| C6  | `schema/playout.json` is hand-maintained per `AGENTS.md`. `ersatztv-playout` has no `schemars` dependency, unlike the two machine-generated schemas.                                                                                       | `crates/ersatztv-playout/`                                     | Derive it with `schemars`, or take Tunarr's drift-check script. It **must** live upstream — Tunarr vendors the schemas, not the Rust source, so it cannot run the check in its own CI (§6, F8). |
| C7  | `debug` is a print-and-probe tool that uses the identical load path as `run`, so it validates nothing extra. §12 treats it as a preflight validator, which it is not.                                                                      | `main.rs:80-105`                                               | Make it a real validator, or drop it from Tunarr's defence plan.                                                                                                                                |
| C8  | Segment and keyframe timing are fixed at 4s and 2s at compile time.                                                                                                                                                                        | `ffpipeline/src/pipeline.rs:37-38`                             | Fold into B1's configurability work.                                                                                                                                                            |
| C9  | There is no machine-readable capability document. Every one of C3, C4, C5 and C8 is a separate implicit coupling that a downstream has to hardcode and keep in sync by hand.                                                               | —                                                              | **The highest-leverage item in this table.** See below — it subsumes most of the rest.                                                                                                          |

#### C9 in full: a capability handshake

`ersatztv-channel --describe` emitting JSON would collapse four of the couplings above into one negotiated surface, and it is the single change that lets Tunarr detect an incompatible binary at startup rather than at first viewer. Two layers, and the distinction matters:

**Schema capability — what this binary can express.** Supported video and audio formats, hardware-acceleration modes, the accepted playout schema range, the channel-config schema version, the output-folder filenames, the dynamic-callback contract version, and the segment/keyframe constants along with whatever bounds B1 makes configurable.

**Runtime capability — what this machine can actually do.** The probed FFmpeg feature set and the hardware accelerators actually available here, which `next` already computes through the nine `*-sys` `dlopen` crates and already exercises in `debug` (`main.rs:86-102`). Compile-time support and runtime availability are different questions and Tunarr needs both answers.

Why this matters more than a convenience:

- **Tunarr's validation rules derive from the binary instead of being hardcoded.** Without it, Tunarr carries its own list of "`mpeg2video` is unsupported, `mp3` is unsupported" that silently goes stale the moment upstream adds a format — and a stale _refusal_ is worse than a stale permission, because it blocks a config that would now work.
- **It is the natural home for the capability probing this migration exists to retire.** Tunarr maintains its own hardware capability layer — `server/src/ffmpeg/builder/capabilities` at 1,312 lines plus `ffmpegInfo.ts` at 367. If the runtime layer of the handshake is good enough, that code retires with the rest of the pipeline rather than surviving as an orphan.
- **It replaces five implicit couplings with one versioned document**, which is the difference between a partnership with a contract and two codebases that happen to agree today.

### D. Parity gaps

| #   | Gap                                                                                                                                                                                                                     | Evidence                                                  | Note                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `OutputFormat` has exactly one variant, `Hls`. There is no MPEG-TS, no mp4, and no per-item direct output.                                                                                                              | `ffpipeline/src/output_format.rs:8-14`                    | This is the `hls_direct_v2` problem, and the groundwork is better than expected. `VideoCodec::COPY` and `AudioCodec::Copy` are already modelled, and `output_format.rs:37` already skips `-g`, `-keyint_min` and `-force_key_frames` when the video codec is copy — the same reasoning as Tunarr's `HlsDirectOutputFormat`. What is missing is the container and the per-item playlist model, not codec passthrough. |
| D2  | No `mpeg2video` video format, and no `mp3` audio format in normalization. `copy` is **not** a gap — omitting `audio.format` already yields `AudioCodec::Copy`, and omitting `video.format` yields `VideoCodec::copy()`. | `config.rs:128`, `:79`; `pipeline.rs:308`, `:335`, `:339` | Adding `mpeg2video` and `mp3` is near-trivial upstream: both are two enum variants and two `as_arg` arms, alongside the existing `H264`/`Hevc` and `Aac`/`Ac3`. Prefer adding them to blocking them — a permanently blocked config is a permanent support question. Pair with C9 so Tunarr discovers the supported set rather than hardcoding it.                                                                    |
| D3  | No encoder tuning surface for preset, profile, thread count, scaling algorithm or audio volume.                                                                                                                         | §9                                                        | Pure config surface. Cheap to add.                                                                                                                                                                                                                                                                                                                                                                                   |
| D4  | One subtitle rendition and no multi-audio-track renditions. Tunarr's `hls_direct_v2` carries `StreamRenditions` with multiple audio tracks and language selection.                                                      | `ersatztv/src/main.rs:240-260`                            | A real parity gap. Deferred by decision — see §15.E.1, which records the shape of a solution and the one thing to settle early.                                                                                                                                                                                                                                                                                      |
| D5  | The multivariant `BANDWIDTH` is a config-derived estimate of `(video_kbps + audio_kbps) * 1100`, defaulting to roughly 4.6 Mbps. It is not measured.                                                                    | `channel_model.rs:72-79`                                  | Minor, but wrong for adaptive clients.                                                                                                                                                                                                                                                                                                                                                                               |
| D6  | The fallback is black and silence only. There are no `static`, `pic`, `testsrc` or `text` error screens, and no flex `pic` or `clip` modes.                                                                             | `channel_session.rs:1062`                                 | Low priority, because Tunarr emits its own error and flex items through the resolver.                                                                                                                                                                                                                                                                                                                                |

### E. Deferred designs

Problems this integration surfaces, judged real but out of scope for it. Recorded so the shape is not rediscovered later.

#### E.1 Multi-audio renditions on a stitched stream

**Status: undesigned. Deferred past the initial integration. One decision to take early — see the schema note below.**

**The constraint.** An HLS multivariant playlist is fetched once and never refreshed. A stitched channel plays heterogeneous items whose audio tracks differ. So the rendition list must be fixed for the lifetime of the session, and every item must satisfy it.

**Why this is unsolvable in `hls_direct_v2`.** That path is passthrough. It cannot manufacture a rendition an item does not have, because no encoder is running. The requirement is unsatisfiable, which is why the feature is stuck today.

**Why `next` changes the picture.** `next` is a normalizer. It already forces every item to one video format, one resolution, one pixel format, one audio codec, channel count and sample rate. Going from "normalize to one audio track" to "normalize to N declared audio tracks" is the same operation at a different arity, not a new capability.

**The model.** The rendition set is **declared per channel**, not derived from content. Under the dynamic resolver it could not be derived in any case — the playout holds a single `DynamicSource` placeholder, so there are no items to scan until the worker asks for each one. The mapper's question inverts from "what tracks does this item have" to "what fills declared slot N for this item," answered per item from:

- the item's real stream index for that language,
- an external audio file (`TrackSelection.source` is already `Option<PlayoutItemSource>`, so a slot may point at a different source than the video),
- the item's default track, or
- `anullsrc` (already the fallback primitive, `channel_session.rs:1080`).

**Default the fallback to the item's own default track, not silence.** Silence is indistinguishable from "broken" to a viewer, which lands straight in the flex-versus-failure confusion of §13.6. Falling back to default audio turns the feature into "_prefer_ Japanese," which is both honest and probably what users of a mixed-source channel want.

**Where the declaration comes from.** Channels default to a single rendition, matching today's behaviour. Users who care opt in per channel. The channel editor offers a helper proposing the union of audio languages across that channel's current programs — a starting point, not a binding derivation. Tunarr already stores per-stream language on `mediaStreams`, so the list is cheap to compute.

**The one thing to settle early.** `PlayoutItemTracks.audio` (`playout.rs:120`) is `Option<TrackSelection>`. Widening it to a list is a breaking playout-schema change, and `from_file` rejects any differing `breaking` digit (`playout.rs:411`). If it lands after Tunarr ships a mapper, every pinned Tunarr/`next` pair must move in lockstep. Agree the field shape with upstream now — an untagged serde enum accepting either a single `TrackSelection` or a list — so the multi-audio version is additive. One attribute today, no coordinated release later.

#### E.2 Worker survival across a Tunarr restart

**Status: opt-in, deferred. Default matches Tunarr's current behaviour — children die with the parent.**

Under the sidecar model the transcoder is no longer a child of the Node process, so what happens on a Tunarr restart becomes a choice rather than a consequence. The timings make the opportunity concrete. A worker works ahead until its buffer exceeds 60 seconds, then idles in 5-second sleeps (`channel_session.rs:267-269`), so a worker with a full buffer makes no callback at all for up to a minute. **A Tunarr restart that completes inside that window is invisible to viewers** — something Tunarr's current architecture cannot do, because FFmpeg dies with the parent.

The default stays kill-and-reap: workers are terminated on shutdown, and orphans are reaped at startup using the `MeilisearchService` PID-file plus `find-process` pattern. That path is needed regardless — the crash case demands orphan cleanup whichever model is chosen — and it is the one that makes phase 2 debuggable.

Survival becomes a user-facing option later. Two prerequisites:

- **A1 must be fixed first.** A worker whose Tunarr never returns is reaped only by the `.heartbeat` path, and that path has a hole — staleness is evaluated only when the file already exists (`playlist_manager.rs:272`), so a worker that never received a segment request never self-reaps. Survival without A1 is a process leak by design.
- **`EtvNextSession` must keep its process handle recoverable from disk**, not only in memory, so reattachment is a later addition rather than a rewrite. Shape this in phase 2 even though survival ships later.

**One trap to design around now, in either model.** The callback timeout defaults to 10 seconds (`channel_session.rs:1232-1234`), and a failed callback costs 60 seconds of black (B2). So a _fast_ failure is far more expensive than a slow one. If Tunarr's HTTP port is listening before the resolver can answer — Fastify up, database not ready — the worker takes an instant 500 and immediately burns a minute. Do not bind the port until the resolver is genuinely ready, or hold the connection rather than answering 500 during startup.

### F. Decisions taken in review

**The governing constraint, stated once because it decides most of the rest: regress or abandon as little existing Tunarr behaviour as possible.** Where `next` lacks something Tunarr does today, the default disposition is to add it upstream rather than to block the config, document the limitation, or quietly substitute a near-equivalent. Blocking and substituting are fallbacks for when adding is genuinely impractical, not the first answer. This is what makes D2 prefer adding `mpeg2video` over refusing it, what makes B2 a failure budget rather than an accepted behaviour change, and what keeps E.1 on the roadmap rather than closed.

Answers to the §13 agenda, recorded as they were settled.

| #   | Question                               | Decision                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | End state (§13.2)                      | **Evaluation spike, architected as permanent.** The intended outcome is replacing Tunarr's own pipeline and partnering with upstream on `next` as a unified streaming backend. `hls_direct` v1 is inferior and retires as part of the migration. Changes to `next` are in scope to design and propose, including an `hls_direct_v2` equivalent.                                                                 |
| F2  | The seam (§13.1)                       | **HTTP `DynamicSource`.** Co-location is all the MVP requires, but remote workers are a desirable future, and only HTTP survives that. The "stdio avoids a port" argument was false in any case — `local_proxy` already binds a loopback socket on every session (`local_proxy.rs:43-57`).                                                                                                                      |
| F3  | Multi-audio renditions (§13.5)         | **Deferred, undesigned.** Shape recorded in E.1; settle the `PlayoutItemTracks.audio` field shape early so the eventual change is additive rather than a `breaking`-digit bump.                                                                                                                                                                                                                                 |
| F4  | Worker lifetime across restart (§13.1) | **User option, defaulting to Tunarr's current behaviour** — children die with the parent. Survival is opt-in and deferred. See E.2.                                                                                                                                                                                                                                                                             |
| F5  | Validation model (§13.7)               | **Refuse at assign time, warn at config-save time, never silently substitute.** Picking `etv_next` for an incompatible config is refused with a message naming the field. Editing a shared config that channels depend on warns and lists them rather than blocking. Derive the rules from C9 once it exists rather than hardcoding them.                                                                       |
| F6  | Config composition (§7)                | **No overlay files.** Tunarr has no per-channel config deltas — `channel.transcodeConfigId` is a many-to-one pointer at a shared named row, and the vestigial `channel.transcoding` JSON column is never read. Compose one `channel.json` per spawn from the selected config plus global `FfmpegSettings`, and pipe it via the stdin path (`config.rs:535-556`).                                                |
| F7  | Failure semantics (§13.6)              | **A failure budget in `next` that exits non-zero, folded into B2.** Tunarr's rich error screens already survive via the resolver. The gap is a failed callback, where Tunarr cannot supply an item; without a budget, `errorScreen: kill` stops working and loud session failure becomes impossible. Stopgap until then: Tunarr infers sustained failure from the resolver going uncalled and ends the session. |
| F8  | Testing (§13.8)                        | **Follow the conventions that already exist, plus one CI smoke test.** Phase 1 is pure and runs in CI. Anything spawning a worker follows the established `*.local.test.ts` pattern, which `server/vitest.config.ts` excludes from the run. One new CI job downloads `ersatztv-channel` and asserts the output contract end to end. The drift check goes upstream (C6).                                         |
| F9  | Support and diagnostics (§13.9)        | **Dossier on by default with a retention cap; troubleshoot runs through a one-item playout; one issue tracker.** See below.                                                                                                                                                                                                                                                                                     |

F9 in detail. Co-development already answers the political half of §13.9 — a hardware-pipeline bug is fixable rather than a dead end. Three operational decisions remain, and one of them is an upside rather than a gap.

`next` writes a **diagnostic bundle per failing item** when `ffmpeg.reports_folder` is set (`dossier.rs:38-105`): a timestamped directory holding `ffreport.log` or an FFmpeg stderr tail, `pipeline.json` with the resolved `FfmpegInfo` and hardware accel, `playout_item.json`, `media_info.json` with probe output, the fully-merged effective `channel_config.json`, and `outcome.txt`. That is richer per-failure capture than Tunarr collects today, and `reports_folder` maps onto the existing `FfmpegSettings.enableFileLogging`.

- **Enable it by default, with a retention cap** — keep the last N bundles per channel — and surface a "download diagnostics" action in the UI. Left off, the first line of every bug report is "turn this on and reproduce." Left uncapped, a persistently failing channel writes directories without bound.
- **`POST /troubleshoot` runs through a one-item playout.** Tunarr's troubleshoot surface is 808 lines across `troubleshootApi.ts` and `TroubleshootService.ts` and performs a real diagnostic transcode with an optional `transcodeConfigId` override (`TroubleshootService.ts:258-262`). For `etv_next` that means spawning a worker against a single-item playout — the pre-materialized path from phase 2, which is why §11 now treats it as permanent rather than scaffolding.
- **One front door.** Bugs are filed against Tunarr and triaged upstream from there. A user cannot reasonably be asked to distinguish a mapping bug from a pipeline bug, and the dossier supplies what is needed to route it.

F8 in detail. The premise of §13.8 was false — Tunarr has not avoided committing media fixtures. `server/src/testing/ffmpeg/fixtures/` holds 11 MB of them: h264 and HEVC/HDR10 at 480p through 1080p in `.ts`, `.mp4` and `.mkv`, plus two watermark PNGs. `FfmpegIntegrationHelper.ts` already discovers real FFmpeg binaries, builds temp working directories, and parses NVIDIA, QSV and VAAPI capability, and four `*.local.test.ts` files exercise real pipelines on a developer machine. The pattern for hardware-dependent testing is established; `etv_next` follows it rather than inventing one.

The one addition worth making is a single CI job that spawns a worker against a fixture-backed playout with software encoding, then asserts `.ready` appears inside the deadline and `live.m3u8` lists at least four segments. That turns §12's "assert the output contract" into something mechanical, and it is the only automated canary for surfaces 3 and 4 drifting — a renamed output file or a changed ready protocol fails a build rather than producing an unexplained timeout on a user's machine. It costs a few seconds of software transcode, and the download script is a copy of the Meilisearch one. Hardware paths stay local, because no CI runner has a GPU.

Two consequences of F6 worth carrying into phase 1. The mapper reads deinterlacing from two places — the _whether_ is per-config (`transcode_config.deinterlaceVideo`), the _which filter_ is global (`FfmpegSettings.deinterlaceFilter`) — and both land in `video.filters.*`. And §5's on-disk layout loses `channel.overlay.json` entirely.

F5 is more work than §9 implies. Tunarr has **no cross-field validation of any kind** today — zero `refine`/`superRefine` across the transcode and settings schemas, and SQLite `check()` constraints that enforce per-column enum membership only (`TranscodeConfig.ts:177-205`). Incompatibilities are resolved silently at runtime instead (`FfmpegPlaybackParamsCalculator.ts:29-40` forces `copy`/`none` for the direct modes). So this is the first validation of its kind, and because configs are shared it spans _(config, dependent channels, their stream modes)_ in both directions.

### G. Regression register

A behaviour-by-behaviour sweep of Tunarr's streaming path against `next`, run because the governing constraint above demands the systematic version rather than whatever surfaces in conversation. Roughly ninety behaviours were checked across video, audio, subtitles, overlays, error handling, session management and stream selection. Most are **preserved**, and several are better in `next` — HDR and Dolby Vision handling, hardware tonemapping, scaling modes, graphics layering, per-track sourcing. What follows is only what changes the plan.

**The dangerous class is the silent regression** — something Tunarr does automatically that no user configured, so its absence is noticed as "the picture looks worse" or "my Apple TV has no sound" rather than as a missing feature. The first three were severe enough to be promoted into the B blockers; they stay listed here so the sweep remains complete.

| #   | Silent regression                                                                                                                                                                                                                                                                                                                                                                                                                                               | Tunarr                                                                                                        | `next`                                                    | Severity          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------- |
| G1  | **Software scaling is hardcoded to `fast_bilinear`.** Tunarr defaults to `bicubic`. Every scaled frame on every software-path channel gets visibly softer and more aliased. Verified: no scaling-algorithm config exists anywhere in the workspace.                                                                                                                                                                                                             | `settingsSchemas.ts:98-100`; `ScaleFilter.ts:51,53`                                                           | `video_filter.rs:228`, `:540`                             | **Promoted → B6** |
| G2  | **DTS and TrueHD are not rewritten to AC-3 in copy mode.** Tunarr does this because those codecs cannot be muxed for AVPlayer. Under passthrough, Apple clients lose audio entirely on affected titles.                                                                                                                                                                                                                                                         | `FfmpegStreamFactory.ts:699-717`; applied `BasePipelineBuilder.ts:548-556`                                    | no `dca`/`truehd` handling in `crates/`                   | **Promoted → B7** |
| G3  | **No silent-audio synthesis for video-only sources.** Tunarr injects a null audio source; `next` errors when no audio stream is found, dropping the item to the fallback card. Silent films and video-only files stop playing.                                                                                                                                                                                                                                  | `FfmpegStreamFactory.ts:586-589`                                                                              | `input.rs:75-110` returns `Err`                           | **Promoted → B8** |
| G4  | **No `service_provider` / `service_name` output metadata.** Players that surface it show blank or "Unknown" instead of the channel name.                                                                                                                                                                                                                                                                                                                        | `FfmpegStreamFactory.ts:158-161,258-259`; `OutputOption.ts`                                                   | `output_option.rs:89` — `-map_metadata -1`, nothing added | Medium            |
| G5  | **VAAPI silently falls back to software** unless both `vaapi_device` and `vaapi_driver` are set. **Confirmed against `ed95077`, 21 Sep 2026** (§11.A): the worker emits `libx264` and software `scale` with the driver absent, `h264_vaapi` and `scale_vaapi` with it set. Tunarr owns half of this — the mapper omits `vaapi_driver` for its own `system` default and suppresses the warning, so stock hardware channels quietly stop being hardware channels. | `EtvNextChannelConfigMapper.ts:225-232, 279-281`; `TranscodeConfig.ts:148`                                    | `config.rs` VAAPI validation                              | Medium            |
| G6  | **Channel-icon-as-watermark fallback disappears**, along with the built-in Tunarr logo fallback. Channels that never set a watermark URL but display their icon lose it.                                                                                                                                                                                                                                                                                        | `ProgramStream.ts:366-378`                                                                                    | `GraphicsLayer.source` requires an explicit path          | Medium            |
| G7  | **Four implicit FFmpeg behaviours vanish:** `-preset veryfast` (CPU cost and latency change), `-sc_threshold 0` (segment-boundary keyframe placement), `-muxdelay 0 -muxpreload 0` (startup latency), and the QSV-specific `aresample=async=1000` (drift on QSV channels).                                                                                                                                                                                      | `FfmpegPlaybackParamsCalculator.ts:73-82`; `BasePipelineBuilder.ts:840-856`, `:715-724`; `OutputOption.ts:37` | none                                                      | Medium            |

Beyond the silent class, three operational losses matter:

- **The `disableHardwareDecoder` / `disableHardwareEncoding` / `disableHardwareFilters` switches have no counterpart** (`TranscodeConfig.ts:173-175`). Hardware acceleration in `next` is all-or-nothing. These are the standard escape hatch when a vendor driver is broken, which is precisely the failure mode this migration inherits most of.
- **FFmpeg log level is hardcoded to `Error`** (`pipeline.rs:836`). Tunarr exposes panic-through-trace. A support regression rather than a viewer-facing one, but it bites exactly when it is least welcome.
- **`hlsDirectOutputFormat`** (mkv / mpegts / mp4 containers) has no equivalent; `next` emits mpegts segments only. Folds into D1.

#### Three items that look lost and are not

The sweep flagged these; each is already handled elsewhere in this design, and they are recorded so the same alarm is not raised twice.

- **MPEG-TS output.** `next` is HLS-only, but `etv_next_concat` remuxes Tunarr's own HLS output to MPEG-TS through the existing `ConcatStream` (§8), which is how `hls_concat` serves HDHomeRun and Plex DVR today. The tuner path survives without `next` gaining an output format. Note the two wiring points from §8: `ConcatStreamModeToChildMode` is an exhaustive `Record` so the compiler forces the entry, but `FfmpegStreamFactory.createConcatSession:122-167` branches on an explicit mode list that must be extended by hand.
- **On-demand channels, connection tracking and idle teardown.** These never were the transcoder's job. `OnDemandChannelService` and `SessionManager` stay Tunarr-side and are unaffected by which backend does the encoding.
- **The stream-selection profile engine.** The CEL rule evaluation, language preferences and subtitle filters stay in Tunarr, which resolves them and emits a concrete `stream_index` in the playout item. `TrackSelection` carries the result, and can additionally pull a track from a different source than the video — a capability Tunarr does not have today. The logic relocates rather than disappearing.

#### Dead knobs — drop rather than port

These exist in Tunarr's schema or UI but nothing in the stream path reads them, so there is no behaviour to regress: `normalizeFrameRate`, `videoProfile`, `videoBitDepth` (the factory hardcodes 8; `next` genuinely implements it), `channel.transcoding.*`, `watermark.animated`, `watermark.fadeConfig[].programType`, and `channel.offline.soundtrack`.

One distinction worth keeping straight: the `videoPreset` **column** is dead, but the implicit `-preset veryfast` it stands in for is live and is lost (G7).

### Corrections this register makes to the rest of this document

Source inspection contradicted four claims made earlier in this plan. The affected sections have been corrected in place; this table is the record of what changed and why, so a reader who saw an earlier draft can find the delta.

| Claim                                                                                                                                                                    | Section   | Correction                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "A typo in `channel.json` fails loudly at worker startup" and the surrounding asymmetry argument                                                                         | §6        | **Wrong.** `ChannelConfig` has no `deny_unknown_fields` (C1). Both files swallow unknown keys silently, so there is no asymmetry. The Zod proposal is strengthened, and its scope doubles to cover the config writer as well as the playout writer. |
| "Channel config has no version field and `deny_unknown_fields` on eleven structs" rated **high**, with the consequence that a Tunarr upgrade takes every channel offline | §16 risks | **Overstated.** The eleven are video-filter option structs, not the config root. A new normalization key is ignored, not fatal. Downgraded to low in §16; C3 still stands on its own merits.                                                        |
| "Preflight the config with `ersatztv-channel debug` — the single highest-value defence on this list"                                                                     | §12       | **Wrong.** `debug` uses the same load path as `run` and validates nothing extra (C7).                                                                                                                                                               |
| The four-state buffering machine described as the linear chain `SeekAndWorkAhead → ZeroAndWorkAhead → SeekAndRealtime → ZeroAndRealtime`                                 | §1        | **Wrong shape.** It is a 2×2 lattice of Seek/Zero × WorkAhead/Realtime. The Seek/Zero axis is driven by `is_complete`; the WorkAhead/Realtime axis is driven independently by buffer depth (`next_state`, `channel_session.rs:841-866`).            |

Two further notes. `compute_timing` does not exist under that name — the function is `input_timing` (`channel_session.rs:970`), and the formula cited in §4 is correct. And `ChannelConfig::from_sources` accepts `-` as a config path meaning read from stdin, capped at 256 KiB (`config.rs:535-556`), so Tunarr can pipe `channel.json` to each worker instead of writing it to disk.

---

## 16. Risks

| Risk                                                                                                           | Impact | Mitigation                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream is pre-1.0 and self-describes as "not yet ready for production"                                       | high   | Ship behind a flag, default off, on the `dev` branch; never make it a default stream mode until upstream stabilizes                                                                                                                                |
| **Nothing upstream stays pinnable** — the `develop` release GCs each target's prior asset on every `main` push | high   | **Ship gate (§12).** Mirror a SHA-256-pinned artifact into a location Tunarr controls; verify `--version` at startup and refuse the mode on mismatch                                                                                               |
| Channel config has no version field                                                                            | low    | Corrected in §15. `ChannelConfig` has no `deny_unknown_fields`, so an unknown key is ignored rather than fatal. The eleven strict structs are video-filter options only. Validate with Zod before writing (C1); add a config version upstream (C3) |
| Playout schema still moving (`0.0.3` → `0.0.4` within the inspected history)                                   | medium | Version is validated at load, so a mismatch fails loudly rather than misbehaving; keep the emitted version in one constant next to the binary pin                                                                                                  |
| Output-folder filenames are internal to upstream                                                               | medium | Upstream ask #2; meanwhile assert the expected files exist at session start and fail the session with a clear error if not                                                                                                                         |
| Work-ahead makes the resolver answer about the future, committing play-history writes early                    | medium | Audit in phase 3; make resolver-path filler selection non-recording if needed                                                                                                                                                                      |
| Two process supervisors (Tunarr's `stalenessMs`, `next`'s 90s heartbeat) disagree                              | low    | Set Tunarr's staleness below 90s so Tunarr always decides first; treat a zero exit as a clean idle reap, not an error                                                                                                                              |
| Per-channel process cost on top of Tunarr's Node process and Meilisearch                                       | low    | Same cost model as today — one FFmpeg per active channel — plus a small Rust supervisor per channel                                                                                                                                                |
| Maintaining two streaming backends indefinitely                                                                | medium | The phased plan keeps the mapping layer (phase 1) as the only permanently new concept; everything else reuses existing sessions and routes                                                                                                         |

---

## 17. Bottom line

**Nothing gets built until the two gates in the status block clear.** The design is a recommendation with at least three load-bearing assumptions that a review could overturn (§13), and the versioning problem (§12) is a hard shipping blocker that Tunarr cannot solve alone. Opening the upstream conversation is the one thing worth doing immediately, because it has the longest lead time and the smallest ask: run the existing release workflow against a version tag.

The expensive part of this integration is not the plumbing. Spawning a child process, waiting on a file, and serving a directory of segments is a week of work against code Tunarr already has. The expensive part is the **mapping layer** — turning a `StreamLineupItem` plus a `StreamSource` plus `StreamDetails` into a `PlayoutItem` that means the same thing, including seek points, watermark fade phase, and probe hints. That is where the tests belong and where the phases are cut.

The strategic argument is that after this integration Tunarr's differentiator — scheduling, the library, the guide, the UI — stays entirely Tunarr's, while the part that is hardest to maintain and least differentiated, the hardware transcode pipeline, is shared with a project actively shipping AMF, QSV tonemapping, and HDR10 detection every week. The `DynamicSource` callback is what makes that division clean rather than a rewrite: `next` never needs to know what a channel, a filler list, or a redirect is.

The honest counterweight is that this trades code Tunarr controls for a dependency it does not, on a pre-1.0 project that says so itself. Every hardware-pipeline bug becomes an upstream filing, every release becomes a coordination problem, and the parity gaps in §9 are permanent unless upstream closes them. That trade is probably worth making. It is not obviously worth making, which is what the review is for.
