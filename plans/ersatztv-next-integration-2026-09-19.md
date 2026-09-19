**ErsatzTV `next` as an alternate streaming backend — 19 September 2026**

Tunarr can adopt [ErsatzTV/next](https://github.com/ErsatzTV/next) today as a feature-flagged, per-channel streaming backend without touching the scheduler, the guide, the library, or the existing FFmpeg pipeline. The integration is a bundled sidecar process plus two JSON contracts, not a linked library — `next` is a Rust workspace that produces binaries, and it has no C ABI or Node binding. Tunarr already ships a third-party Rust binary this exact way (Meilisearch), so the packaging path is a copy of one that works.

The recommended shape is: **spawn `ersatztv-channel` directly from `SessionManager`, one process per active session, and answer its `DynamicSource` callbacks from `StreamProgramCalculator`.** That keeps every playback-time decision Tunarr makes — on-demand resume, channel redirects, filler picking against play history, error degradation — in Tunarr, and hands `next` only the job it claims: normalize and transcode one item, keep the segment clock honest. It is also the option that requires no new supervision, port allocation, or URL-rewriting machinery.

This is a design and source-inspection plan against `next` at `ed95077` and Tunarr at `b7cd3f45`. Nothing was built or run; effort and risk judgments are estimates from the integration points cited below.

> **Status: proposal under review. No implementation work is authorized.**
>
> Two gates must clear before any phase starts:
>
> 1. **Design review.** The architecture here is a recommendation, not a decision. §13 carries the open questions and the agenda for picking it apart. Several — the dynamic-resolver default, work-ahead side effects, the end state for Tunarr's own pipeline — could change the shape of the whole thing rather than a detail of it.
> 2. **Upstream versioning.** Tunarr cannot ship a bundled `ersatztv-channel` it has no way to pin, verify, or refuse. §12 documents exactly what is missing and what it would take to fix. This gate is on upstream's schedule, not ours, so it is worth opening that conversation early and in parallel with the review.
>
> Phase 0 (§11) is a throwaway spike and is exempt — it produces no product surface and answers questions the review will ask anyway.

---

## 1. What `next` actually is

`next` is a complete Rust rewrite of ErsatzTV that deliberately drops library management and scheduling. Its README is explicit: "Library and metadata management, scheduling and playout creation **are not in scope for this project**." It consumes **playouts** — JSON documents describing what to play and when — and produces a normalized HLS stream.

The workspace builds three binaries relevant to us:

| Binary                       | Role                                                                                                                                                                                                                      | Relevance to Tunarr                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ersatztv`                   | Axum HTTP server. Serves `/channels.m3u`, `/channel/{N}.m3u8`, `/xmltv.xml`, `/session/{ch}/{file}`; supervises one `ersatztv-channel` child per active channel.                                                          | Duplicates work Tunarr already owns. Not used. |
| `ersatztv-channel`           | Per-channel worker. Reads playout JSON, builds FFmpeg pipelines, writes HLS segments to an output folder. Four-state buffering machine (`SeekAndWorkAhead` → `ZeroAndWorkAhead` → `SeekAndRealtime` → `ZeroAndRealtime`). | **This is the piece we want.**                 |
| `ersatztv-playout-generator` | Dev tool that makes playout JSON from a folder of videos. Upstream states scheduling feature requests will not be accepted.                                                                                               | Reference only.                                |

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

**Worth reconsidering if** upstream adds a roster-reload or channel-registration endpoint (upstream ask #6, §14). At that point Option A becomes a reasonable trade: one long-lived supervisor to babysit instead of `SessionManager` owning spawn semantics directly. It is worth asking for, because it is a small change on their side.

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
`{"source_type": "dynamic", "uri": "http://127.0.0.1:<tunarrPort>/api/etv/playout-item", "headers": ["Authorization: Bearer {{TUNARR_ETV_TOKEN}}"]}`,
refreshed on a timer well before the window closes. `{{VAR}}` expands from the worker's environment (`crates/ersatztv-playout/src/template.rs`), which is how the shared secret and any media-source tokens reach the child without landing in a file on disk.

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

The playout types carry no `#[serde(deny_unknown_fields)]`. The channel-config types carry it on **eleven** structs (`crates/ersatztv-channel/src/config.rs:150` onward). So the asymmetry runs the wrong way for us:

- A typo in `channel.json` **fails loudly** at worker startup.
- A typo in a playout item is **silently ignored**. Misspell `in_point_ms` as `in_point_msec` and the item plays from zero. Nothing logs, nothing errors; you notice because a viewer sees the wrong part of a movie.

There is already a live instance of this in the repo: upstream's own `examples/playout/playout.json` carries a `generated_at` field that exists in **neither** the schema's root properties **nor** the Rust `Playout` struct. It is silently discarded on every load. That is the failure mode, sitting in the example file.

Validating our generated playouts against a Zod schema **before writing them** therefore buys Tunarr a guarantee that `next` does not provide for itself.

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

1. **A drift check** — re-run the field-by-field diff of `schema/playout.json` against the Rust serde structs. It is ~40 lines, it found zero mismatches today, and it is the only mechanical defence against the hand-maintained schema falling behind. Worth offering upstream as well.
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

| Gap                                                                                                                          | Severity | Disposition                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| No MPEG-TS output                                                                                                            | low      | `etv_next_concat` via existing `ConcatStream`                                                                                                  |
| No `hls_direct` equivalent (remux, no transcode, per-item playlist)                                                          | medium   | Out of scope; `hls_direct`/`hls_direct_v2` remain Tunarr-native modes                                                                          |
| `mpeg2video` video, `mp3`/`copy` audio                                                                                       | medium   | Validate in the channel editor and on the API; refuse `etv_next` for such configs with a clear message                                         |
| `threadCount`, `videoPreset`, `videoProfile`, `audioVolumePercent`, `normalizeFrameRate`, `scalingAlgorithm` not expressible | medium   | Upstream ask (§14). Until then, surface as "ignored under this backend" in the UI rather than silently dropping them                           |
| Rich error screens (`static`, `pic`, `testsrc`, `text`) vs. black+silence                                                    | low      | Tunarr emits its own `lavfi`/image items through the resolver; `next`'s fallback becomes a last-resort net only                                |
| Flex/offline `pic` and `clip` modes                                                                                          | low      | Same — resolver emits an image or file item                                                                                                    |
| HDR/Dolby Vision hints absent from Tunarr's scanner                                                                          | medium   | Omit `ProbeHint` for known-HDR sources so `next` probes; add `dvProfile`/`hasHdr10Metadata` to the media-stream schema later                   |
| Troubleshooting parity with `troubleshootApi.ts`                                                                             | medium   | `ersatztv-channel debug <config>` and the `dossier.rs` output are the equivalents; wire them into the existing troubleshoot surface in phase 4 |
| Segment length fixed at 4s, keyframe at 2s (`crates/ffpipeline/src/pipeline.rs:37`)                                          | low      | Not configurable; note it, since Tunarr's HLS sessions tune this                                                                               |
| `now_local()` in containers without `TZ`                                                                                     | low      | Set `TZ` on the child and always emit RFC3339 with explicit offsets                                                                            |

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

**Phase 1 — schemas and mapping layer, unit-tested, no process.** Vendor `next`'s three JSON Schemas, add `server/scripts/generate-etv-schemas.ts` and the generated Zod output (§6), plus the schema-vs-Rust drift check. Then `EtvNextChannelConfigWriter` and `EtvNextPlayoutItemMapper` with Vitest coverage over each `StreamLineupItem` variant and each `StreamSource` variant, every case `.strict()`-parsed against the generated schema. Pure functions, no I/O — this is where the timing arithmetic of §4 gets pinned down by tests rather than by debugging a live stream.

**Phase 2 — session and packaging.** `EtvNextBinaryResolver`, `EtvNextService` (binary discovery, version check, orphan reaping via the PID-file pattern), `EtvNextSession` (spawn, `.ready` wait, `.heartbeat` touch, teardown), `EtvNextPlaylistCreator`. Download script and `make-bin.ts` wiring. At the end of this phase a channel streams from a **pre-materialized** playout — simpler to debug than the callback, and worth keeping afterwards as a fallback path and as the thing `ersatztv-channel debug` can be pointed at.

**Phase 3 — dynamic resolution.** `/api/etv/playout-item`, bearer-token auth via `{{TUNARR_ETV_TOKEN}}`, redirect flattening, the play-history side-effect audit from §4, and `EtvNextPlayoutWriter`'s rolling window with refresh-on-lineup-change. This is where on-demand channels, filler, and error degradation start working.

**Phase 4 — product surface.** Feature flag, the `streamMode` migration, channel-editor option with validation for the unsupported codec combinations, `etv_next_concat` for HDHR/Plex DVR, session reporting in `sessionApi`, troubleshooting via `ersatztv-channel debug`, and docs. Documentation lands in `docs/configure/channels/transcoding.md` plus a new page under `docs/configure/ffmpeg/`, registered in `mkdocs.yml` — required by the repo rule that behaviour changes update the docs.

Phases 1 and 2 are independently useful and independently revertable. Phase 3 is where the design risk concentrates.

---

## 12. Version coupling: the shipping blocker

This is the gate. Not because the problem is hard, but because the fix is upstream's to make, and shipping a bundled binary Tunarr cannot pin, verify, or refuse is not something to do behind a feature flag and hope.

### Six coupled surfaces, one negotiation mechanism

Tunarr and a bundled `ersatztv-channel` agree on six things. Exactly one of them can be negotiated at runtime.

| #   | Surface                                                                                                                           | Versioned?                                                                                                                                                        | What a mismatch does                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Playout schema**                                                                                                                | **Yes.** `version` URI on every document; `from_file` rejects a differing `breaking` digit or a `compatible` digit above its own `SUPPORTED_SCHEMA` (today `0.4`) | Loud, correct failure at load                                                                                                             |
| 2   | **Channel config schema**                                                                                                         | **No.** `channel_config.json` has no version field at all — root properties are `fallback`, `ffmpeg`, `normalization`, `playout`                                  | Eleven structs carry `deny_unknown_fields`, so a newer Tunarr writing a field an older binary does not know is a **hard startup failure** |
| 3   | **Binary build**                                                                                                                  | **Yes, precisely.** `--version` reports `ETV_VERSION_STRING`, built from CI's `${tag}-${short_sha}` — e.g. `0.1.0-ed95077`                                        | Nothing checks it today; Tunarr must                                                                                                      |
| 4   | **Output folder filenames** (`live.m3u8`, `live_sub.m3u8`, `ffmpeg.m3u8`, `live%06d.ts`, `.ready`, `.heartbeat`)                  | **No.** Internal constants in `channel_session.rs` and `ersatztv-core`                                                                                            | A rename silently produces a session that never becomes ready — Tunarr waits 30s and reports "not ready" with no clue why                 |
| 5   | **Dynamic callback contract** (`x-etv-channel`, `x-etv-now`, `x-etv-until`, `x-etv-dynamic-id`, and the clamp/no-recursion rules) | **No.**                                                                                                                                                           | A changed header name makes the resolver answer for the wrong channel or time                                                             |
| 6   | **Segment and keyframe timing** (`SEGMENT_SECONDS = 4`, `KEYFRAME_INTERVAL_SECONDS = 2`)                                          | **No.** Compile-time constants                                                                                                                                    | Playlist and player assumptions shift under us                                                                                            |

Surface 1 is well designed and we should use it deliberately: because the check is `found.compatible > SUPPORTED.compatible`, an **older** playout version is accepted and a newer one is rejected. Tunarr should therefore emit the **lowest** schema version carrying the features it actually uses, not the newest — that maximizes the range of binaries that accept our documents. Emitting `0.0.4` because it is current would gratuitously break against a `0.0.3` binary.

Surface 2 is the one that will actually bite. It is the only place where Tunarr writing _more_ than the binary understands is fatal rather than ignored — the exact inverse of the playout path's silent-drop problem (§6). A Tunarr upgrade that starts emitting a new normalization key, paired with a user's pinned older binary, takes every `etv_next` channel offline at spawn.

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
- **Preflight the config.** Run `ersatztv-channel debug <generated channel.json>` once at service start. It parses the config through the same `deny_unknown_fields` types the worker uses and probes FFmpeg capability, so surface 2 mismatches surface as a startup error naming the offending key, rather than as channels that fail to spawn. This is cheap and it is the single highest-value defence on this list.
- **Assert the output contract.** After `.ready` appears, check that `live.m3u8` exists; fail the session with a specific error if not. Turns surface 4 from a mystery timeout into a diagnosis.
- **Emit the minimum viable playout schema version**, per above, and keep it in one constant next to the binary pin so the two move together.
- **Treat the vendored schemas as part of the pin.** The copies of `playout.json` / `channel_config.json` under version control, the generated Zod (§6), the emitted `version` string, and the binary hash are one unit. Bumping any one without the others is the bug this whole section exists to prevent.

---

## 13. Review agenda: what to grill

Ordered roughly by how much of the design each answer could invalidate.

**1. Dynamic resolver as the default (§4).** The strongest claim in this document and the least proven. It rests on behaviour that is emergent rather than documented — a long-window placeholder being re-resolved every tick follows from `get_current_item` plus `rfind`, but upstream has not promised it. If that is wrong, or if upstream changes it, the design falls back to pre-materialized playouts and the invalidation problem returns in full. **Is a per-item HTTP round trip on the playback path acceptable at all?** What happens to a worker whose callbacks fail while Tunarr restarts — it degrades to black, and Tunarr's restart does not kill orphaned workers unless we make it.

**2. What is the end state?** This document plans an alternate backend. The stated ambition is transitioning _away_ from Tunarr's own streaming code. Those are different projects. If `etv_next` is a permanent second option, Tunarr maintains two backends forever and the parity gaps in §9 must all be closed. If it is a migration path, we need deprecation criteria now — which modes die, when, and what happens to `hls_direct`/`hls_direct_v2`, which have no `next` equivalent at all.

**3. Work-ahead side effects (§4).** The resolver is asked about a moment up to 44s in the future. Filler picking writes to `ProgramPlayHistoryDB`. Are those writes correct when the moment has not happened, and what happens if the session dies before it does?

**4. Process model (§3).** One extra supervisor per active channel. Acceptable on a Synology with eight channels running? The Option A reconsideration hinges on upstream ask #6 (a roster-reload endpoint) — worth deciding whether to ask for it before or after the review.

**5. Subtitle and audio-rendition parity.** `next` emits one subtitle rendition (`live_sub.m3u8`) with burn-or-convert. Tunarr's `hls_direct_v2` path carries `StreamRenditions` with multiple audio tracks and language selection. What does an `etv_next` channel do for a user who switches audio tracks mid-stream?

**6. Failure semantics.** `next` degrades to black-and-silence and never exits. Tunarr's error screens are richer and its sessions fail loudly. Which behaviour wins, and how does a user tell "flex" from "broken"?

**7. Configuration model.** Tunarr's `TranscodeConfig` is a shared row; `next`'s config is per-channel with overlays. Where does a setting live when a shared config is unrepresentable for one channel's backend (§9)? Do we validate at save time, at channel-assign time, or at spawn?

**8. Testing.** Phase 1 is pure and testable. Phases 2–4 involve a child process, FFmpeg, and real media. What does CI actually run — and do we need a fixture media file in the repo, which we have so far avoided?

**9. Support surface.** Every `etv_next` bug report arrives with a hardware pipeline Tunarr's maintainers did not write and cannot patch. Is the answer "file upstream," and is that acceptable for a feature users can toggle on?

---

## 14. Upstream asks

Worth raising in `#ersatztv-dev` **now**, not before phase 2 — item 1 gates shipping and is on upstream's schedule, so the conversation should run in parallel with the design review. The project explicitly invites early feedback, and items 1, 2 and 5 are all things it costs them little to answer.

1. **Cut tagged releases.** The blocker, detailed with the specifics in §12: it is not that versions are missing, it is that the `develop` release deletes each target's previous asset on every push to `main`, so nothing stays pinnable. Running the existing `artifacts.yml` against a version tag skips that delete step entirely — no new pipeline, no new signing setup. The two supporting asks are a `version` field on `channel_config` and a `--describe` capability handshake (§12).
2. **A documented stability contract for the output folder** — `live.m3u8`, `live_sub.m3u8`, `live%06d.ts`, `.ready`, `.heartbeat`. Option B depends on these names. They are internal today.
3. **Encoder tuning in `channel.json`** — `preset`, `profile`, thread count, scaling algorithm, and an audio volume filter. These are the §9 gaps that are pure config surface rather than new capability.
4. **A `PlayoutItem` field for "do not probe, this is live/unbounded"** on `LocalSource`, matching `is_live` on `HttpSource`.
5. **Clarification on dynamic-source re-resolution** — Tunarr's design leans on a long-window placeholder being re-resolved each transcode tick. That behaviour follows from `get_current_item` + `rfind`, but it is emergent rather than documented, and worth confirming as intended before building on it.
6. **A roster-reload or channel-registration endpoint on the `ersatztv` server.** Today the channel list is fixed at boot and a restart wipes the shared output folder, which is the single reason Tunarr cannot host the server process (§3). A `POST /channels` / `DELETE /channels/{n}` pair, or even a `SIGHUP` that re-reads `lineup.json` without emptying the output root, would make the hosted-server model viable for dynamic lineups — likely useful to other downstreams too.
7. **A public library surface on `ersatztv-channel`**, if in-process embedding is ever a goal. Currently `lib.rs` exports only `config` and `error`; `ChannelSession` and friends are private to the binary. Low priority — the process boundary is a feature for hardware-accel code (§3) — but worth flagging as a design question rather than an accident.

---

## 15. Risks

| Risk                                                                                                           | Impact | Mitigation                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream is pre-1.0 and self-describes as "not yet ready for production"                                       | high   | Ship behind a flag, default off, on the `dev` branch; never make it a default stream mode until upstream stabilizes                                           |
| **Nothing upstream stays pinnable** — the `develop` release GCs each target's prior asset on every `main` push | high   | **Ship gate (§12).** Mirror a SHA-256-pinned artifact into a location Tunarr controls; verify `--version` at startup and refuse the mode on mismatch          |
| Channel config has no version field and `deny_unknown_fields` on eleven structs                                | high   | A Tunarr upgrade emitting a new key takes every channel offline against a pinned older binary. Preflight with `ersatztv-channel debug` at service start (§12) |
| Playout schema still moving (`0.0.3` → `0.0.4` within the inspected history)                                   | medium | Version is validated at load, so a mismatch fails loudly rather than misbehaving; keep the emitted version in one constant next to the binary pin             |
| Output-folder filenames are internal to upstream                                                               | medium | Upstream ask #2; meanwhile assert the expected files exist at session start and fail the session with a clear error if not                                    |
| Work-ahead makes the resolver answer about the future, committing play-history writes early                    | medium | Audit in phase 3; make resolver-path filler selection non-recording if needed                                                                                 |
| Two process supervisors (Tunarr's `stalenessMs`, `next`'s 90s heartbeat) disagree                              | low    | Set Tunarr's staleness below 90s so Tunarr always decides first; treat a zero exit as a clean idle reap, not an error                                         |
| Per-channel process cost on top of Tunarr's Node process and Meilisearch                                       | low    | Same cost model as today — one FFmpeg per active channel — plus a small Rust supervisor per channel                                                           |
| Maintaining two streaming backends indefinitely                                                                | medium | The phased plan keeps the mapping layer (phase 1) as the only permanently new concept; everything else reuses existing sessions and routes                    |

---

## 16. Bottom line

**Nothing gets built until the two gates in the status block clear.** The design is a recommendation with at least three load-bearing assumptions that a review could overturn (§13), and the versioning problem (§12) is a hard shipping blocker that Tunarr cannot solve alone. Opening the upstream conversation is the one thing worth doing immediately, because it has the longest lead time and the smallest ask: run the existing release workflow against a version tag.

The expensive part of this integration is not the plumbing. Spawning a child process, waiting on a file, and serving a directory of segments is a week of work against code Tunarr already has. The expensive part is the **mapping layer** — turning a `StreamLineupItem` plus a `StreamSource` plus `StreamDetails` into a `PlayoutItem` that means the same thing, including seek points, watermark fade phase, and probe hints. That is where the tests belong and where the phases are cut.

The strategic argument is that after this integration Tunarr's differentiator — scheduling, the library, the guide, the UI — stays entirely Tunarr's, while the part that is hardest to maintain and least differentiated, the hardware transcode pipeline, is shared with a project actively shipping AMF, QSV tonemapping, and HDR10 detection every week. The `DynamicSource` callback is what makes that division clean rather than a rewrite: `next` never needs to know what a channel, a filler list, or a redirect is.

The honest counterweight is that this trades code Tunarr controls for a dependency it does not, on a pre-1.0 project that says so itself. Every hardware-pipeline bug becomes an upstream filing, every release becomes a coordination problem, and the parity gaps in §9 are permanent unless upstream closes them. That trade is probably worth making. It is not obviously worth making, which is what the review is for.
