# Architecture exploration — @tunarr/server

Durable records for the architecture candidates surfaced in the server-package review.
The review report is [`../backend-arch-review-2026-08-26.html`](../backend-arch-review-2026-08-26.html).

> **The review is high-level.** Its candidate cards are a survey, not a design. Every candidate
> needs its own deep dive before implementation — the survey is accurate about *where* the
> friction is and unreliable about *how much* of it there is. See "Fact-check" below.

## Working order

Revised 2026-08-26 after fact-checking. The review recommended `1 → 2 → 3 → 4 → 5 → 8 → 10 → 11 → 6 → 7 → 9 → 12 → 13`.

Rationale for the change: #1 is a 282-site change across 26 routers, and today only three routes
have any test coverage (`server/tests/`, via a harness that boots the whole server with a real DB).
Land the correctness fixes and the cheap deletions first — they are self-contained, they shrink the
surface #1 has to move, and #4 in particular removes 662 lines of pass-through that would otherwise
have to be carried through the refactor.

| Order | Candidate | Why here |
|-------|-----------|----------|
| 1st | **#11** (partial) — delete `midRollUtil.ts` | Dead code, zero risk. Filed as #2030 |
| 2nd | **#2** — validation on the save path | Carries a live correctness gap. Filed as #2023 |
| 3rd | **#4** — delete the DB facades | 662 lines of pure delegation; removes 6 casts that exist only to bridge facade↔repository signature drift |
| 4th | **#1** — retire the ambient ServerContext | The gateway candidate. Pattern already proven in-repo — see note below |
| 5th | **#3** — one update-channel operation | Needs #1's seam to have somewhere to live |
| then | #5, #10, #8, #6, #7, #9, #12, #13 | Each needs its own deep dive first |

**#1 is less speculative than the review makes it look.** The target pattern already exists and works:
`CreditsApiController`, `SmartCollectionsApiController` and `ProgramGroupingApiController` use
constructor `@inject` plus a `mount` plugin, registered at `api/index.ts:86-88`. It is a mechanical
migration of the remaining 23 routers, not a design invention.

## Candidates

| # | Candidate | Status | Record |
|---|-----------|--------|--------|
| 1 | Own the request seam — retire the ambient **ServerContext** | Verified · pending deep dive | — |
| 2 | One schedule evaluation — evaluate→convert→persist, validated everywhere | Verified · bug filed (#2023) | — |
| 3 | One update-channel operation — stop re-deriving handler choreography | Verified | — |
| 4 | Delete the DB facades; one query dialect behind each repository | Verified · understated by the review | — |
| 5 | The media-source seam — one mapping, one library diff, one route adapter | **Corrected** — see below | — |
| 6 | Unify the transcode target — one state assembler | **Overstated** — see below | — |
| 7 | One subtitle selector | Verified · bug filed (#2026) | — |
| 8 | One channel lifecycle — pause/resume/cleanup reconciles | Partly corrected · bug filed (#2025) | — |
| 9 | Mint once — one program-row assembler; db/ stops importing api/ | Verified | — |
| 10 | A pure guide timeline — extract the algorithm from TvGuideService | Verified | — |
| 11 | One slot-emission pipeline — and delete midRollUtil | Partly overstated · cleanup filed (#2030) | — |
| 12 | One run-a-unit-of-work seam — and inject the Scheduler | Verified | — |
| 13 | Object-shaped pipeline builder seam | **Premise is false** — see below | — |

## Fact-check (2026-08-26)

The review's structural diagnoses hold and its line numbers are usually exact. Its **counts are not
reliable** and three claims are wrong. Corrections:

### Wrong as written

- **#13 — the "argument-swap hazard" does not exist.** Compile-tested: all six cross-assignments of
  the Nvidia/Vaapi positional constructor args fail `tsc` (TS2739/TS2741), because
  `ConcatInputSource`, `SubtitlesInputSource` and `WatermarkInputSource` carry distinct private
  fields. Only null-for-null swaps compile, which are no-ops. This is a consistency wart, not a
  correctness risk — reprioritise accordingly. Also: the builders live in `pipeline/nvidia/` and
  `pipeline/hardware/`, not the paths cited; and `PipelineBuilderContextProps` (`BasePipelineBuilder.ts:154`)
  is the *runtime* context built inside `build()`, not the construction seam the card wants unified.
- **#5 — this is a two-way duplication, not three.** Jellyfin↔Emby is genuine copy-paste (Jellyfin's
  API is a fork of Emby's, so the payload field names are identical and the movie-injection functions
  are line-for-line the same). **Plex is legitimately different code** over a genuinely different
  payload — `ratingKey`/`Guid[]`/`Media[].Part[]`, `Result<T>` returns, an extra `MediaSourceLibrary`
  argument. Folding all three behind one mapping seam would be a forced abstraction.
- **#8 — the first classification rule is misdescribed.** There is exactly one
  `userAgent.includes('Tunarr')` filter in the tree, at `SessionManager.ts:468` (inside
  `pauseChannelIfNecessary`), not at the cited `:167-179` — that range is `cleanupStaleSessions`, a
  separate rule. The underlying point (divergent idle rules) holds.

### Overstated

- **#6 — only 2 of the 4 blocks are near-duplicates.** `createErrorSession` (`:847-877`) and
  `createOfflineSession` (`:935-964`) differ by three hunks and are worth unifying.
  `createStreamSession` (`:419-466`) is genuinely different — it is the only one with `start`,
  `duration`, `isFirstTranscode`, `copyAllStreams`, and the only one that does not pass
  `DefaultPipelineOptions`. `createHlsSlowerConcatSession` (`:255-280`) is the only one setting
  `metadataServiceProvider`.
- **#7 — the two pickers do not implement "the same rule".** The filter and extraction core is
  duplicated, but the language matching genuinely disagrees (raw string compare across three fields
  vs `getAlpha3TCode` normalization on one, and the picker skips the check entirely when
  `languageCodeISO6392` is absent). That is a bug to fix (#2026), not a dedup to perform.
- **#11 — one duplicated block, not a duplicated loop.** The ~14-line midroll block and a TODO
  comment are copy-pasted between `TimeSlotService` and `RandomSlotsService`. The pad/filler section
  is *not* duplicated inline — both already call the same shared helpers, and RandomSlots factored
  its version into `handleFixedDurationSlot`/`handleDynamicDurationSlot`. The distribute-flex and
  emit loops have genuinely diverged and are not interchangeable.
- **#2 — real gap, milder consequence.** Validation genuinely runs only on the two preview
  endpoints and the save path persists unvalidated. But the failure mode is a silently wrong
  schedule (first slot in a group wins the iterator), not a crash or corruption. Detail the review
  missed: the preview *computes* `sanitizedSlots` and then discards them — the response returns the
  worker result, and the UI saves its own form values, so sanitization never persists on any path.

### Understated

- **#4** — `ChannelDB` is 35/35 delegating methods with **zero** logic; `ProgramDB` 32/32.
  662 lines of pure forwarding. There are 6 casts, not 4, all of them bridging facade↔repository
  signature drift. The duplicate `programIdsByExternalIds` overload has **zero callers**, and the
  first-selected overload declares dot-separated keys while `createExternalId`
  (`shared/src/index.ts:17-23`) produces pipe-separated ones.
- **The scanner duplication (listed only under "smaller frictions") is the strongest single finding.**
  `diff` of the `scanInternal` bodies of `MediaSourceOtherVideoScanner` and
  `MediaSourceMusicVideoScanner` is **one line** — the `ProgramType` constant. The copies have
  already drifted: `pathFilter` is ignored by three scanners (#2027) and the Movie scanner lacks the
  `try/finally` that releases the progress bar.

### Counts to distrust

| Review says | Actual |
|---|---|
| 42 try/catch in `api/` | **34** |
| ~35 exports in `slotSchedulerUtil.ts` | **21** |
| 6 cache maps in `TvGuideService` | **7** |
| 4 worker `queueTask` slot call sites | **6** |
| 18 scanner subclasses | **22** |
| "zero route handlers are tested" | 3 routes covered by `server/tests/` |

Exact as claimed: 31 files/lines spot-checked matched, including `ServerContext` field count (31 vs
"30"), 43 `status(500)`, 22 `settings-update` pushes in 5 files, `slotSchedulerUtil.ts` at 1100 lines,
the 422-line `TvGuideService.test.ts`, and `IChannelDB`/`ChannelDB`/`ProgramDB` at 205/300/385 lines.

## Bugs filed from the review (2026-08-26)

| Issue | Title |
|-------|-------|
| [#2023](https://github.com/chrisbenincasa/tunarr/issues/2023) | Slot group validation is skipped on the schedule save path |
| [#2024](https://github.com/chrisbenincasa/tunarr/issues/2024) | Offline session drops software deinterlace and scaling filters |
| [#2025](https://github.com/chrisbenincasa/tunarr/issues/2025) | `OnDemandChannelStateTask` pauses channels that have no sessions on every tick |
| [#2026](https://github.com/chrisbenincasa/tunarr/issues/2026) | Subtitle selection uses different language matching on transcode vs remux paths |
| [#2027](https://github.com/chrisbenincasa/tunarr/issues/2027) | OtherVideo, MusicVideo and MusicArtist scanners ignore `pathFilter` |
| [#2028](https://github.com/chrisbenincasa/tunarr/issues/2028) | Jellyfin person mapping is missing the empty-name guard that Emby has |
| [#2029](https://github.com/chrisbenincasa/tunarr/issues/2029) | Typo `repsonse` silently disables response schema on `POST /ffmpeg-settings` |
| [#2030](https://github.com/chrisbenincasa/tunarr/issues/2030) | Dead code: `midRollUtil.ts` has no production importer and its qualifier is a no-op |
| [#2031](https://github.com/chrisbenincasa/tunarr/issues/2031) | Copy-paste error messages name the wrong media source |
| [#2032](https://github.com/chrisbenincasa/tunarr/issues/2032) | Jellyfin/Emby fractional durations are stored as REAL in INTEGER columns (code-health — latent, no runtime effect) |
| [#2034](https://github.com/chrisbenincasa/tunarr/issues/2034) | `ReconcileProgramDurationsTask` corrects durations but persists stale `startTimeOffsets` |
| [#1863](https://github.com/chrisbenincasa/tunarr/issues/1863) | (existing user issue — root cause identified: Jellyfin/Emby library refresh never applies `updatedLibraries`) |

## Smaller frictions (observed, unranked)

- Scan loop duplicated ×10 + off-interface client methods + static coordinator state — **the
  duplication here is more severe than the ranked candidates; see Fact-check**
- NFO schema + array-tag drift (7 hand-maintained `ArrayTags` lists)
- `external/` writes DB + schedules tasks — `JellyfinItemFinder` mutates `programDB` and schedules a
  task via `GlobalScheduler`, and has exactly one caller, a debug endpoint
- `LineupRepository` spans two storage engines (SQLite + per-channel JSON), 1049 lines
- CLI and server duplicate bootstrap
- Static singletons + concrete-vs-symbol token drift beside DI (`DBAccess.instance`,
  `GlobalScheduler`, `EventService.stream`, `OfflineStreamSource.instance()`)
- `StreamProgramCalculator`: a read path that mutates (`:104-109`)
- FfmpegTranscodeSession pass-through (speculative) — note the review's `unpipe(sink)` concern is
  **not** a bug; `out === sink` when a sink is passed, and `unpipe(undefined)` unpipes the single
  destination otherwise
- Two disconnected event mechanisms (speculative)

## Domain language

Terms are recorded in [`CONTEXT.md`](/CONTEXT.md); server-side terms to be added during grilling as
deepened modules are named.

## How to resume

- To continue designing a candidate, start from its card in the review report, **read the Fact-check
  section above first**, and grill the design tree with the user (shape of the deepened module, what
  sits behind the seam, which tests survive).
- Each settled deep-dive gets a `NN-<slug>.md` record in this directory, following the format of the
  web package's `01-editor-collapse.md`.
