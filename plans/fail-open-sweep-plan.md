# Fail-Open Sweep — Task Plan

Generated 2026-08-23. Source: a four-way parallel sweep for "fail-open" constructs —
code that silently succeeds, silently does nothing, or silently substitutes a value
instead of erroring. This is the pattern behind every bug found in the previous
session (`?background=false` never working, overlapping guide builds, air dates
wiped on timezone change, three routes that hung every caller).

## Working rules

- Every group below gets **its own branch off `main`** (exception: G1, see note).
- Every fix is done **red → green**: write the failing test first, watch it fail for
  the right reason, then fix.
- `pnpm turbo typecheck` and `pnpm lint-changed` must pass before a group is done.
- Groups are independent unless stated. Execute in the severity order in the table.

## Verification legend

- **[V]** — I reproduced or read the code path myself this session.
- **[A]** — Reported by a sweep agent, consistent with the code, not independently reproduced.

## Execution order

| Order | Group | Theme | Severity | Status |
|-------|-------|-------|----------|--------|
| 1 | G4 | Lineup file data loss | Critical — silent data loss | ✅ done — PR #1997 |
| 2 | G5 | Backup data loss | Critical — silent data loss | ✅ done — PR #1998 |
| 3 | G7 | DI singleton scope | High — locks are no-ops | ✅ done — PR #1999 |
| 4 | G6a | Guide build retry + hidden failures | High | ✅ done — PR #2000 |
| 4b | G6b | Lineup returned by reference (race) | High | ✅ done — PR #2002 |
| 5 | G9 | Random slot cooldown | Medium — feature does nothing | ✅ done — PR #2001 |
| 6 | G8 | Worker pool lifecycle | Medium — blocks PR #1994 | ✅ done — PR #2004 (G8a only; G8b already fixed by #1994) |
| 7 | G1 | Query-parameter contract | Medium | ✅ done — PR #1996 (retitled) |
| 8 | G2 | Paging contract | Medium | ✅ done — PR #2003 |
| 9 | G3 | Silent value rewrites | Medium | ✅ done — split into PR #2006 (G3a/G3b) and PR #2005 (G3c/G3d) |
| 10 | G11 | Error visibility | Low | — |
| 11 | G10 | Dead settings | Low — needs product decisions | — |

---

## G4 — Lineup file: a transient read error erases channel programming

**Branch:** `fix/lineup-read-failure-data-loss`

### Root cause [V]

`server/src/db/json/SchemaBackedJsonDBAdapter.ts:31`

```ts
const data = await this.adapter.read().catch((e) => {
  this.logger.error(e);
  return null;
});
```

Any `adapter.read()` rejection — EACCES, EMFILE, EIO, an NFS blip — is downgraded to
`null`. `LineupRepository` constructs this adapter with a non-null `defaultValue`
(`server/src/db/channel/LineupRepository.ts:190-199`), so the guard at `:36`
(`data === null && this.defaultValue === null`) does **not** fire. Execution reaches:

```ts
const parsed: unknown = data ? JSON.parse(data) : {};   // :41  -> {}
```

`{}` fails schema validation, so the merge-with-defaults branch at `:47-52` runs,
succeeds, and sets `needsWriteFlush = true`. Line 72-74 then **writes the empty
lineup straight back to disk**. Not on the next save — immediately, during the failed
read.

Confirmed independently: lowdb 7's `Low.read()` is `const data = await
this.adapter.read(); if (data) this.data = data;`, so a `null` return also leaves the
cached `Low.data` at the default. That `Low` is cached in `fileDbCache[channelId]`
for the process lifetime (`LineupRepository.ts:199`).

### Contributing cause [A]

`LineupRepository.saveChannelLineupDirect:206-209` writes with a plain `fs.writeFile`
— no temp-file-plus-rename. An interrupted write leaves a zero-length file, which
takes the same path above (`data` is `''`, falsy, so `parsed = {}`).

### User-visible consequence

The channel's programming is erased. The channel still appears in the UI with an empty
schedule, the guide shows nothing, and streams fall back to offline/flex. The only
trace is one `debug`-level line.

### Red test

`server/src/db/json/SchemaBackedJsonDBAdapter.test.ts` (new):

1. Given a valid on-disk lineup file and a `defaultValue`, stub the inner adapter's
   `read()` to reject with an `EIO` error.
2. Assert `read()` does **not** call `write()`.
3. Assert the on-disk file still contains the original lineup.
4. Second case: a zero-length file must not be silently overwritten with defaults.

Both should fail on `main` — case 1 because `write()` is called, case 3 because the
file has been replaced.

### Fix direction

Distinguish "the file could not be read" from "the file is empty/absent". A read
*error* must propagate (or at minimum must never trigger `needsWriteFlush`); only a
genuinely missing file should fall back to defaults. Consider making the write path
atomic (temp + rename) in the same branch, since it is the source of the zero-length
file.

### Risk

`SchemaBackedJsonDBAdapter` also backs settings JSON. Propagating read errors could
turn a previously-silent settings failure into a startup crash. Check every
construction site before changing the error contract.

---

## G5 — Backups report success while producing truncated archives, and prune the good ones first

**Branch:** `fix/backup-silent-failure`

### Root cause [V]

`server/src/db/backup/ArchiveDatabaseBackup.ts:100-110`

```ts
const outStream = createWriteStream(backupFileName);   // no 'error' listener, ever
const finishedPromise = new Promise<void>((resolve, reject) => {
  archive.on('end', () => resolve(void 0));
  archive.on('error', reject);
```

Three distinct defects:

1. **Destination errors are unobserved.** `archive.pipe(outStream)` does not forward
   the destination's errors to the archiver. ENOSPC/EACCES/EROFS on `outStream` emits
   `'error'` with no listener → uncaught exception. `server/src/cli/RunServerCommand.ts:71-74`
   catches `uncaughtException`, logs, and **does not exit**, so the server continues in
   an undefined state and `finishedPromise` never settles.
2. **Resolves before the bytes land.** `archive.on('end')` fires when the readable side
   drains, not when `outStream` has flushed and closed. Should be `outStream.on('close')`.
3. **Retention runs before confirmation.** Line ordering is `:149 await
   archive.finalize()` → `:154 fs.rm(tempDir)` → `:158 await
   deleteOldBackupIfNecessary(config)` → `:159 return finishedPromise`. Old backups are
   deleted before the new one is known good.

Downstream, `server/src/tasks/BackupTask.ts:59-63` branches only on `result.type ===
'success'`; the `'error'` case falls through with no log, so the task reports success. [A]

### User-visible consequence

The automated backup schedule shows green while writing truncated or absent archives,
and retention deletes the last known-good backups. Discovered only at restore time.

### Red test

`server/src/db/backup/ArchiveDatabaseBackup.test.ts` (new):

1. Point the backup at an unwritable destination. Assert the returned result is
   `{type: 'error'}` and that no `uncaughtException` is emitted.
2. Assert `deleteOldBackupIfNecessary` is **not** called when the archive failed.
3. Assert the success result is only returned after the output stream has emitted
   `'close'` (assert the file size on disk is non-zero when the promise resolves).

### Fix direction

Attach an `error` listener to `outStream`; settle on `outStream`'s `'close'` rather
than the archiver's `'end'`; move `deleteOldBackupIfNecessary` after the archive is
confirmed written. Make `BackupTask` log and surface the `'error'` branch.

---

## G7 — Per-channel mutexes are no-ops because the services holding them are transient

**Branch:** `fix/di-singleton-scope`

### Root cause [V]

- `server/src/container.ts:58` — `new Container({ autobind: true })` with **no
  `defaultScope`**. Inversify's default is `Transient`.
- `OnDemandChannelService` is `@injectable()` with no scope and has **no `bind(...)`
  anywhere** in `container.ts`, `ServicesModule.ts`, `StreamModule.ts`, `DBModule.ts`,
  or `TasksModule.ts`. It is autobound, therefore transient. (Verified by grep: zero
  bind/singleton matches.)
- `server/src/container.ts:98` — `bind<MutexMap>(KEYS.MutexMap).toDynamicValue(() =>
  new MutexMap())` with no `.inSingletonScope()`, so the lock map is transient too.

Every injection site gets a different `OnDemandChannelService` holding a different
`MutexMap`. `runWithLockId(channelId, ...)` (`OnDemandChannelService.ts:50`, `:106`)
serializes a caller only against itself.

Contrast the peers, which are all explicitly `.inSingletonScope()`: `SessionManager`
(`StreamModule.ts:27`), `TVGuideService` (`container.ts:131`), `EntityMutex`
(`container.ts:163`), `CustomShowSyncService` (`ServicesModule.ts:139`).

### Concurrent entry points [A]

- `server/src/api/streamApi.ts:178` → `resumeChannel` — instance owned by the
  singleton `ServerContext` (`ServerContext.ts:41`).
- `server/src/tasks/OnDemandChannelStateTask.ts:49` → `pauseChannel` — a second
  instance; called fire-and-forget, so it stays in flight across the loop.
- `server/src/stream/SessionManager.ts:64` holds a third instance, used at `:427` and
  `:480`, also fire-and-forget from event handlers.

### User-visible consequence

An on-demand channel resumes at the wrong cursor position (rewinds or jumps), or is
left `paused` while a viewer is actively streaming, so the guide shows it stopped. The
early-return guards at `OnDemandChannelService.ts:66`/`:73` and `:113`/`:117` are
exactly the check-then-act pattern the ineffective lock was meant to close.

### Red test

`server/src/services/OnDemandChannelService.test.ts` (new):

1. Resolve the service from the real container twice; assert the two resolutions are
   the same instance (fails today).
2. Concurrency test: run `pauseChannel` and `resumeChannel` for the same channel id
   concurrently against a stubbed lineup repository that yields on read; assert the
   final persisted `onDemandConfig` reflects both operations rather than one clobbering
   the other.

### Fix direction

Bind `OnDemandChannelService` explicitly `.inSingletonScope()` and give `MutexMap` a
singleton scope (or set a container-wide `defaultScope`). **Then audit every autobound
service** for the same problem — a container-wide default change is the higher-leverage
fix but has the widest blast radius, so weigh it deliberately rather than defaulting to
the narrow patch.

### Risk

Changing the container `defaultScope` affects every autobound class at once. Prefer
explicit bindings unless the audit shows transient-by-accident is the norm.

---

## G6 — Guide build failures are invisible, and lineups are read while being mutated

**Split 2026-08-23.** G6a shipped as PR #2000. G6b was deliberately NOT bundled with it:
the fix changes aliasing semantics across ~10 `loadLineup` call sites, and at least one
(`removeProgramsFromLineup`, `LineupRepository.ts:434-445`) mutates the returned object
in place and relies on that aliasing. Getting it wrong silently drops lineup edits, which
is too delicate to ride along in another PR. It needs its own branch
(`fix/lineup-by-reference-race`) and a call-site audit before any code changes.

**Branch:** `fix/guide-build-correctness`

### G6a — The retry is dead code [V]

`server/src/services/TvGuideService.ts:1018-1046`

```ts
await retry(async () => {
  try { await this.timer.timeAsync(..., async () => { this.cachedGuide[channelId] = ... }); }
  catch (err) { this.logger.error(err, 'Unable to update internal guide data'); }
  finally {
    this.lastUpdateTime[channelId] = this.currentUpdateTime[channelId]!;
    this.lastEndTime[channelId]   = this.currentEndTime[channelId]!;
    this.currentUpdateTime[channelId] = -1;
  }
}, { retries: 15, factor: 2, maxRetryTime: 30000 });
```

The callback catches its own errors, so it never rejects. `retry` sees success on
attempt 1 and the 15 retries never happen. The `finally` then advances
`lastEndTime[channelId]` to the *intended* window end even though `cachedGuide[channelId]`
was never assigned.

**Consequence:** `getChannelLineup` (`:284-296`) reads `lastEndTime`, so it skips its
"end time exceeds cached guide" warning, hits `isNil(channelAndLineup) → return` at
`:294-296`, and returns `undefined`. The channel renders as an empty row in the web
guide and is omitted from XMLTV. One `error` line is the only trace.

### G6b — `loadLineup` hands out live mutable state [A]

`server/src/db/channel/LineupRepository.ts:558` returns `db.data` **by reference**;
`loadAllLineups` (`:490`) builds its whole result from those live references.
`fileDbLocks` (`:98`) guards only *creation* of the `Low`, not use of it.

- **Reader:** `TvGuideService.ts:419` — `this.channelsById = await
  this.channelDB.loadAllLineups()`, then snapshots `accumulateTable` from each
  `lineup.startTimeOffsets` at `:420-436`.
- **Writer:** `server/src/api/channelsApi.ts:546` → `updateLineup` →
  `LineupRepository.saveLineup:286` → `applyUpdateLineupRequest:302`, which sets
  `data.items = newLineup.items` at `:307` and reassigns `data.startTimeOffsets`.
  (Also `ReconcileProgramDurationsTask.ts:160`, `RegenerateChannelLineupCommand.ts:63,92`.)

The guide build captures `accumulate` at `:508` — the *old* `startTimeOffsets` array
object, since the writer rebinds the property. But `lineup.items` is re-read live off
the same `data` object at `:553`, `:560`, `:603`, `:608`, `:616`, with real yields in
between (`await this.channelDB.syncChannelDuration(...)` at `:532`). A save that
shortens the lineup mid-build leaves `accumulate` indexed against a discarded array.

**Consequence:** `!inRange(targetIndex, 0, lineup.items.length)` at `:553` throws
"General algorithm error, completely unexpected", or `:603` throws on `undefined`. If
it does not throw, `:562` emits plausible-looking but wrong airtimes. The febfd898
`guideBuildLock` cannot help — the conflicting writer is `saveLineup`, which never
touches `TVGuideService`.

### Red tests

- G6a: assert that when `buildGuideInternal` rejects, (i) the operation is retried, and
  (ii) `lastEndTime[channelId]` is **not** advanced. Both fail today.
- G6b: assert `loadLineup` returns a value that is not reference-identical to the
  cached `Low.data`, and that mutating the returned object does not affect a
  subsequent `loadLineup`.

### Fix direction

- G6a: move the `try/catch` outside `retry` so failures actually retry, and do not
  advance `lastEndTime`/`lastUpdateTime` on failure. Note the interaction with the
  febfd898 serialization: a retrying build holds the guide lock longer, so confirm
  `maxRetryTime: 30000` is an acceptable ceiling.
- G6b: **done.** Call-site audit found the plan's worry about
  `removeProgramsFromLineup` was unfounded: it assigns `lineup.items = ...` on the
  object it loaded and then passes that object to `saveLineup`, which copies `items`
  onto `Low.data`. It never relied on aliasing. The audit also found **no in-place
  array mutation anywhere** — every writer (`applyUpdateLineupRequest:307-330`,
  `updateLineupConfig`, `removeProgramsFromLineup:435`) rebinds whole top-level
  properties. So a **shallow** `{...data}` copy is sufficient; a structural/deep copy
  is not needed and would cost O(items) on the guide path. Applied to `loadLineup` and
  `saveLineup`; `BasicChannelRepository.createChannel` was returning
  `getFileDb(...).data` directly and now routes through `loadLineup`.
  The `onDemandConfig` mutations at `BasicChannelRepository.ts:174,257` are inside
  `db.update(...)` callbacks on the live `Low.data`, not on a `loadLineup` result —
  unaffected.

---

## G9 — `cooldownMs` on random slots does nothing

**Branch:** `fix/random-slot-cooldown`

### Root cause [V]

`server/src/services/scheduling/RandomSlotsService.ts:61`

```ts
#slotLastPlayed: Map<number, number> = new Map<number, number>();
```

The identifier appears exactly five times in the entire repo — the declaration (`:61`),
the getter (`:161`), and three reads inside `getRandomSlot` (`:562`, `:564`, `:565`).
There is **no `.set()`, no `delete`, no reassignment anywhere.** The map is always empty.

Therefore `getSlotLastPlayedTime(i)` always returns `undefined`, the
`if (!isNil(slotLastPlayed))` branch at `:564` never executes, and `slot.cooldownMs` at
`:565` never influences slot selection. As a side effect `minNextTime` stays pinned at
`context.timeCursor.add(24, 'days')`, so the "no slot eligible" flex fallback at
`:229-234` is also degenerate.

### User-visible consequence

The user sets a Cooldown on a random slot — a `TimeField` labelled "Cooldown"
(`web/src/components/slot_scheduler/EditRandomSlotDialogContent.tsx:485`), shown as a
column in `RandomSlotTable.tsx:324` — saves, regenerates the schedule, and the same
slot can still be picked back-to-back. `RandomSlotsService.test.ts` only ever passes
`cooldownMs: 0`, so nothing catches it.

### Red test

Extend `RandomSlotsService.test.ts`: two slots, one with a large `cooldownMs`; generate
a schedule and assert that slot never appears twice within its cooldown window. Fails
today.

### Fix direction

Record the play time when a slot is selected — set `#slotLastPlayed` in the branch that
commits a chosen slot, keyed by slot index, using the same clock as `timeCursor`.
Re-check the `minNextTime` fallback once the map is populated.

---

## G8 — Worker pool lifecycle

**Branch:** `fix/worker-pool-lifecycle` — **coordinate with open PR #1994**, which makes
the worker pool the default for every user on first boot. These defects matter far more
once that ships.

### G8a — `start()` guard is inert [A]

`server/src/services/TunarrWorkerPool.ts:140`

```ts
start() {
  if (this.#state !== 'pending') { return; }
  this.#state = 'pending';   // re-sets the state it just tested for
```

The only value that passes the check is rewritten as the same value, so the
"already starting" state is never entered. `#state` becomes `'started'` only inside the
`.then()` of the `Promise.all` at `:149`, an await boundary later. A second `start()` in
that window appends another `numWorkers` promises to `#startPromises` (`:130`) and
overwrites `#pool` slots (`:128`), orphaning the first set — while `queueTask` (`:192`)
round-robins `#last` over the half-replaced pool. `shutdown()` (`:158`) resets `#state`
to `'pending'` at `:174` inside a `.then()`, so a `start()` racing a shutdown's tail
builds a second pool over the terminating one.

### G8b — Restart after a crash is a floating promise [A]

`server/src/services/TunarrWorkerPool.ts:304-307`

```ts
worker.on('exit', (code) => {
  this.#startPromises[idx]!.then(() => this.setupWorker(idx))
                          .catch(() => this.setupWorker(idx));
```

Neither chain is awaited or handled. If the replacement `setupWorker(idx)` rejects, the
rejection is unhandled and `#pool[idx]` is left `ready: false`. The round-robin
dispatcher (`:190-215`) keeps handing every Nth job to the dead slot, throwing
`Worker at ${idx} is not ready yet` — intermittent failures at a fixed 1-in-N rate with
no log line about the worker that failed to come back.

Related: `:148-155`, `Promise.all(this.#startPromises).catch(console.error)` — startup
failure goes to `console.error` rather than the logger, so it is absent from log files,
and `#state` is stuck at `'pending'` forever.

### Red tests

- `start()` called twice concurrently spawns exactly `numWorkers` workers.
- A worker that exits and whose replacement fails to start is marked unavailable and
  logged; `queueTask` does not route to it.

### Outcome (2026-08-23) — PR #2004

**G8b was already fixed by PR #1994** and did not need redoing. That PR replaces the
floating `exit` chain with `scheduleRestart`: exponential backoff, a
`MAX_CONSECUTIVE_RESTARTS` give-up, `#pool[idx] = undefined` on exit, a `.catch` that
logs, and a `queueTask` guard that throws a clear error instead of `!`-asserting an
undefined slot. #1994 targets `main`, so that fix reaches main through it. PR #2004
deliberately leaves it alone rather than shipping a second divergent fix.

**G8a was confirmed [V]** — two `start()` calls built 16 workers where 8 were expected —
and is fixed in #2004 with a distinct `'starting'` state.

**Two further defects found in the same method, not in the original sweep:**
- `#startPromises` is only ever pushed to, never replaced. A pool restarted after a
  shutdown kept the previous run's promises, so `allReady()` awaited — and re-threw for —
  already-terminated workers. A healthy restart could never report ready.
- On startup failure the state is deliberately **not** rolled back to `'pending'`: some
  workers may have come up, and a second `start()` over them would orphan those. The
  route back to startable is `shutdown()`.

**Merge check:** test-merged against `feat/promote-worker-pool`. `TunarrWorkerPool.ts`
auto-merges cleanly; full suite passes on the merged tree (1179 passed). Either order.

**Testing note:** `vi.resetModules()` + dynamic import cannot be used on this module —
`container.ts` and `TunarrWorkerPool.ts` import each other, and a duplicated module graph
makes `bind(TunarrWorkerPool).toSelf()` throw *"toSelf function can only be applied when a
newable function is used"*. The test imports `../container.ts` first so the graph
initialises in the normal order, and derives the expected worker count from a single-start
control pool rather than pinning `numWorkers` via the env var.

---

## G1 — Query-parameter contract

**Branch:** `fix/silent-noop-bugs` — ⚠ **Exception to the branch-off-main rule,
decided 2026-08-23.** Both fixes sit textually inside the hunks of commit `9d329171`
on the open PR #1996, and both are the same defect that commit set out to fix.
Branching off `main` would guarantee a conflict with that open PR. **Decision: commit
both onto `fix/silent-noop-bugs` and retitle PR #1996.** Note this costs a re-review of
an already-green PR.

Status: ✅ **done**, redone red-green on `fix/silent-noop-bugs`, commit `a9f1a829`.
The prior session's working-tree edits had been lost — re-verified as absent from `main`
before redoing them. PR #1996 retitled to "fix: four bugs that silently do nothing".

### G1a — `TruthyQueryParam` only accepts the literal `1` [V]

`types/src/schemas/utilSchemas.ts:161` (on `main`: `server/src/types/schemas.ts:13`)

```ts
.transform((value) => value === 1 || value === true || value === 'true');
```

The `z.coerce.number()` branch accepts any numeric, then the transform compares
strictly against `1`. Verified against the repo's zod 4.3.6: `"2"` → false, `"10"` →
false, `"-1"` → false.

The doc comment directly above it — added by `9d329171` — says *"Accepts
'true'/'false' and any number, where 0 is false."* The implementation contradicts its
own documented contract.

**Consequence:** ~28 query parameters including `?includePrograms`, `?includeEpisodes`,
`?forceScan`, `?background`. `POST /tasks/:id/run?background=2` runs **synchronously**.
This is the exact failure mode `9d329171` set out to remove, one union branch over.

**Applied fix:** `value === true || value === 'true' || (typeof value === 'number' &&
value !== 0)`. Verified: `"2"`/`"10"`/`"-1"` → true, `"0"`/`""`/`" "` → false, `"abc"`
still rejected.

**Owed red test:** extend `server/src/types/schemas.test.ts` — it currently pins
`'1'`/`'0'` and the rejection of `'abc'`, but not `'2'`.

### G1b — `.optional()` inside `.pipe()` makes `from`/`to` required [V]

`server/src/api/channelsApi.ts:71-72`

```ts
from: z.iso.datetime().optional().pipe(z.coerce.date()),
```

`.optional()` is inside the pipe, so it only lets `undefined` through the left half;
`z.coerce.date()` then runs `new Date(undefined)` → `Invalid Date` → the key fails.
Because the pipe's *output* is non-optional, zod does not treat the object key as
optional either. Verified: `safeParse({})` → `success: false`, *"Invalid input:
expected date, received Date"*.

**Consequence:** this is the `querystring` for three routes —
`GET /channels/:id/fallbacks` (`:594`), `GET /channels/all/lineups` (`:630`),
`GET /channels/:id/lineup` (`:657`). Calling `GET /api/channels/{id}/lineup` with no
query string returns **400** with that self-contradictory message. The handlers were
written for the opposite: they call `OpenDateTimeRange.create(req.query.from,
req.query.to)`, whose signature (`server/src/types/OpenDateTimeRange.ts:12-14`) takes
`| undefined` on both sides. `/channels/:id/fallbacks` never reads `from`/`to` at all,
yet cannot be called without them.

The published contract disagrees with the runtime: `web/src/generated/types.gen.ts:5440-5443`
declares `query?: { from?: string; to?: string }`. Any consumer following the OpenAPI
spec gets a 400. Tunarr's own `web/src/hooks/useTvGuide.ts` always passes both, which is
why this was never noticed.

`types/src/api/index.ts:73-74` declares the same query correctly
(`z.coerce.date().optional()`), so `server/src/api/debugApi.ts:221` is unaffected — the
server-local copy is the broken one.

**Applied fix:** move `.optional()` outside the pipe. Verified: `{}` passes, a valid
datetime still coerces, `"notadate"` still rejects. This was the only
`.optional().pipe(` site in the repo.

**Owed red test:** integration test hitting `GET /api/channels/:id/lineup` with no query
string, asserting 200.

---

## G2 — Paging contract

**Branch:** `fix/paging-empty-limit` (clean off `main`; `9d329171` did not touch it)

Status: ✅ **done** — PR #2003, commits `c98d04eb` + `058327ca`. Redone red-green; the
prior session's edits had been lost.

**Merge-order note.** Test-merged both branches locally: `server/src/types/schemas.ts`
auto-merges cleanly with `fix/silent-noop-bugs` in either order. The first attempt hit an
add/add conflict because both branches create `schemas.test.ts`, so G2's tests were moved
to their own `server/src/types/PagingParams.test.ts`. Re-probed: clean.

**Applied fix detail.** `.default()` had to go *inside* the `z.preprocess`, not outside —
with the preprocess inside, `.default()` never sees the `undefined` it produces and `''`
is rejected instead of defaulting. Whitespace-only is also treated as blank, since
`Number("  ")` is 0 too. Verified `pnpm generate-openapi` still emits a clean schema for
these parameters (now `type: integer`, previously `number`); the preprocess wrapper does
not degrade spec generation, and no web client regeneration is needed.

### Root cause [V]

`server/src/types/schemas.ts:10`

```ts
limit: z.coerce.number().min(-1).default(-1),
```

`.default(-1)` only applies to a *missing* key. `?limit=` (present but empty) is `""`,
which `z.coerce.number()` coerces to `0`. Verified: `safeParse('')` → `{success: true,
data: 0}`. `0` passes `.min(-1)` and reaches the DB as `.limit(0)`
(`server/src/db/channel/ChannelProgramRepository.ts:308`), whereas the intended sentinel
`-1` means "no limit". There is also no `.int()`, so `?limit=1.5` reached SQL as a float.

**Consequence:** `GET /channels/{id}/shows?limit=` — and `/artists`, `/programs`
(`channelsApi.ts:392, 431, 462`), plus `programmingApi.ts:599` — returns
`{total: 137, result: [], size: 0}` with a 200. Any client building its query string as
`limit=${value ?? ''}` silently paginates into nothing.

**Applied fix:** `z.preprocess` mapping `''` → `undefined` so the default applies, plus
`.int()` on both fields. Verified: `{}` → -1, `{limit:''}` → -1, `{limit:'25'}` → 25,
`{limit:'1.5'}` → rejected.

⚠ `limit=1.5` now returns 400 where it previously passed a float to SQL. Intended, but
it is a stricter contract — note it in the PR.

---

## G3 — The API returns 200 and stores something other than what you sent

**Branch:** `fix/silent-value-rewrites`

Grouped because all four are the same shape: the request is accepted, the response is
200, and the persisted value is not the submitted one.

### G3a — `.catch()` on watermark fields [A]

`types/src/schemas/channelSchema.ts:25, 29, 35`. `WatermarkSchema` feeds `ChannelSchema`
→ `SaveableChannelSchema` (`:142`, `:154`), the request **body** of `PUT /channels/:id`
(`server/src/api/channelsApi.ts:254`).

- `watermark.opacity: 150`, `-10`, `50.5`, or `"50"` → silently stored as **100** (fully
  opaque) rather than 400.
- `fadeConfig[i].programType: "movies"` (not in `ContentProgramTypeSchema`) → silently
  `undefined`, which means "no restriction", so the fade rule the user scoped to one type
  applies to **every** program on the channel.
- `leadingEdge: "false"` (string, e.g. from a form serialiser) → silently `true`.

### G3b — `.catch()` on `ChannelIconSchema` [A]

`types/src/schemas/utilSchemas.ts:92-103`, reached as `icon` on `ChannelSchema:134`.

`PUT` a channel with `icon.path: null` → 200, and the channel's icon is silently cleared
to `''`. `icon.width: -20` → `0`. `icon.position: "centre"` → `bottom-right`.

> ⚠ **Design constraint — do not simply delete the `.catch()` calls.** `ChannelIconSchema`
> is also used to parse persisted data: `types/src/schemas/lineups.ts:28, 45` and
> `types/src/schemas/guideApiSchemas.ts:46`. There the `.catch()` is load-bearing for
> tolerating legacy or partially-written rows. The fix is to **split lenient (read) from
> strict (write)** schemas, so old channels still load. Removing `.catch()` outright will
> make existing installs fail to load channels — verify against a real migrated DB.

### G3c — `PUT /xmltv-settings` resets omitted fields [A]

`server/src/api/xmltvSettingsApi.ts:46` declares `body: XmlTvSettingsSchema.partial()`,
then `:58-66` writes a full object built from hardcoded defaults. Only `outputPath` is
preserved from stored settings. Any omitted field is reset: `useShowPoster` → `false`,
`programmingHours` → `12`, `refreshHours` → `1`, `enableImageCache` → `false` (the
`=== true` collapses `undefined`). Same shape as the air-date bug: the contract says
"update what I send", the handler does "reset what you didn't send".

### G3d — `PUT /system/settings` resets logging config [A]

`server/src/api/systemApi.ts:190-213`. Omitting `logging` forces
`useEnvVarLevel` back to `true` (`:190`), unconditionally recomputes `logLevel` from
`getDefaultLogLevel(false)` (`:192-196`), and **deletes**
`categoryLogLevel.scheduling`/`.streaming` (`:198-212`). The sibling blocks in the same
handler (`backup`, `cache`, `server`, `logRollConfig`, `:214-229`) are correctly guarded
with `isUndefined`/`ifDefined` — the logging block is the odd one out. `logsDirectory` is
never assigned by this handler at all.

### Red tests

For each: PUT a partial/invalid body, then GET, and assert the stored value is either
unchanged (partial) or the request was rejected (invalid). All four fail today.

### Outcome (2026-08-23) — split into two PRs

Split because the risk profiles differ: G3a/G3b change shared schemas in `types/` and could
break reading existing data; G3c/G3d are self-contained server handlers.

**PR #2006 — G3a + G3b.** All six silent rewrites confirmed [V] by direct probe.

⚠ **The plan's stated reason for the design constraint was wrong, but the constraint holds.**
The plan said `ChannelIconSchema` is load-bearing because `lineups.ts:28,45` and
`guideApiSchemas.ts:46` parse persisted data. They do not — nothing in the persistence
layer uses these schemas. On-disk lineups use the server-local `LineupSchema`
(`server/src/db/derived_types/Lineup.ts:88`), and the `server/src/db/schema/base.ts` copies
are nearly decorative (one `DefaultChannelIcon` value plus two type aliases).

The real reason: **fastify-type-provider-zod validates responses**, calling `safeParse` and
throwing `ResponseSerializationError`. The `icon`/`watermark` columns are
`text({mode:'json'}).$type<...>()` — a compile-time cast only — so drizzle never validates
them and the converters pass them through untouched. The `.catch()` calls are the only
sanitizer between a legacy row and a hard 500 on GET /channels, GET /channels/:id,
GET /channels/all/lineups, GET /channels/:id/lineup, GET /guide/channels and
POST /troubleshoot. Same conclusion, one layer later than the plan thought.

Fix: split by direction. `StrictChannelIconSchema`/`StrictWatermarkSchema` on
`SaveableChannelSchema` (request body); lenient originals stay on responses. The strict
variants use `.default()` exactly where the lenient use `.catch()`, so a *missing* field
behaves identically — only *invalid* values change from silent substitution to 400.

**PR #2005 — G3c + G3d. Root cause was not the handlers.**
`.partial()` wraps a field's `.default()` rather than removing it, so an omitted key still
arrives populated: `z.object({a: z.number().default(12)}).partial().parse({})` is `{a: 12}`.
Both handlers were structurally unable to tell "omitted" from "sent" — no handler-side
`?? stored` could have fixed it. `logging.useEnvVarLevel` arrived as `true` on every
request, and `logging.logRollConfig` as the default object, which means the existing
`ifDefined(...logRollConfig)` guard never did anything. Both request bodies are now
declared field by field with no defaults.

`logsDirectory` is **not** a defect — it is deliberately excluded from
`LoggingSettingsSchema.pick(...)`, so it was never updatable by that route.

`outputPath` is correctly ignored: it is a read-only, disabled field in
`XmlTvSettingsPage.tsx`. Left server-owned.

**Two unrelated defects found while testing, not fixed:**
- `Scheduler.getScheduledJob` does `getScheduledJobs(id)[0]!` — an unguarded `!` that
  throws instead of returning undefined. The XMLTV settings PUT persists, then 500s on it
  when the task is not registered, so the UI reports failure on a successful save.
- Both `/system/settings` routes serialize `searchServerAddress` as
  `http://localhost:${meilisearchPort}` against `z.url()`. With no Meilisearch the port is
  undefined and both GET and PUT 500 on response serialization.

---

## G11 — Errors that are swallowed rather than surfaced

**Branch:** `fix/error-visibility`

### G11a — Unrecognised feature-flag env value is silently `false`, and the UI is locked [A]

`server/src/services/FeatureFlagService.ts:18` and `:45` use
`TruthyQueryParam.catch(false).parse(envValue)`. `TruthyQueryParam` rejects `"on"`,
`"yes"`, `"TRUE"`, so `.catch(false)` turns those into `false`.

Meanwhile `getEnvOverrides()` (`:51-58`) sets `result[meta.key] = true` for *any*
non-empty env value without parsing it. `buildFeatureFlagsResponse`
(`server/src/api/systemApi.ts:56-64`) ships that as `envOverride`, and the web renders
`disabled={meta.envOverride}` (`web/src/pages/settings/FeaturesSettingsPage.tsx:71`).

**Consequence:** `TUNARR_TONEMAP_ENABLED=on` resolves to **false**, logs nothing, and the
Features settings page shows the toggle **greyed out** with an "overridden by
environment" note. The user asked for HDR tonemapping, has it silently off, and the one
UI that could fix it is disabled.

Same construct at `server/src/util/env.ts:99`. Every current caller passes `false`
explicitly, but the declared signature is `defaultValue: boolean = true`, so the first
caller relying on the default gets the fail-*open* version: garbage → `true`.

**Fix direction:** warn (deduped — `get()` is on hot paths, so a naive warning would
spam) when an env value fails to parse. Do not widen `TruthyQueryParam` to accept
`on`/`yes`; that changes query-param semantics too.

### G11b — Channel deletion drops redirect-cleanup failures, and the error object with them [A]

`server/src/db/channel/BasicChannelRepository.ts:414-424`. The comment claims errors are
logged inside `removeRedirectReferences`, but
`LineupRepository.removeRedirectReferences:274-280` passes the message string as the
first argument, so **the actual error and stack are never logged** — only which channel
pair failed. On the default `blockOnLineupUpdates = false` path the work is detached via
`setTimeout`, so failure cannot reach the caller, which returns 200.

**Consequence:** other channels keep `type: 'redirect'` lineup items pointing at a
deleted channel. Those slots break at playback/guide-build time on an unrelated channel
with no stack trace. If the process shuts down between the delete and the timer firing,
the cleanup is lost with no record at all.

### G11c — Chunked grouping queries return partial data as if complete [A]

`server/src/db/program/ProgramGroupingRepository.ts:74-104` and `:453+`. A rejected chunk
in `Promise.allSettled` is logged and skipped; the returned `Record` is structurally
identical to a successful lookup with fewer matches. No caller can distinguish "these
groupings don't exist" from "chunk 3 of 5 failed". On a locked/busy SQLite under
concurrent writes, shows, seasons and albums silently vanish from library listings and
guide metadata, and a retry may return a different subset.

---

## G10 — Settings that are accepted, persisted, and never read

**Branch:** `fix/dead-settings` — **needs a product decision per field before any code.**
For each: implement it, or remove the control and the field. Do not leave live UI
controls that do nothing.

All verified by the sweep as having no reads outside validation, persistence,
serialization, and the form that sets them. [A]

| Field | Declared | Live UI control | Notes |
|---|---|---|---|
| `cooldownMs` | `types/src/api/RandomSlots.ts:39` | yes | **Covered by G9 — implement.** |
| `normalizeFrameRate` | `types/src/schemas/transcodeConfigSchemas.ts:66` | checkbox, `TranscodeConfigVideoSettingsForm.tsx:252` | Zero refs in `server/src/ffmpeg/**`. FPS-capping in `FfmpegPlaybackParamsCalculator.ts:99-102` is commented out. |
| `watermark.animated` | `types/src/schemas/channelSchema.ts:24` | checkbox, `ChannelTranscodingConfig.tsx:460` | Helper text warns of "playback errors" — unactionable. Looping is gated on `watermark.inputKind !== 'stillimage'` instead. |
| `offline.soundtrack` | `types/src/schemas/channelSchema.ts:50` | text field, `ChannelFlexConfig.tsx:454` | Siblings `offline.picture` and `offline.mode` **are** read, which makes the gap easy to miss. |
| `enableImageCache` | `types/src/schemas/settingsSchemas.ts:9` | checkbox, `XmlTvSettingsPage.tsx:144` | `CacheImageService` is unconditional. |
| `videoBitDepth` | `types/src/schemas/transcodeConfigSchemas.ts:56` | API only | Read, then overwritten: `FfmpegStreamFactory.ts:451` hardcodes `bitDepth: 8`. Setting `10` is silently clamped. |
| `timeZoneOffset` | `types/src/api/TimeSlots.ts:164` (**required**), `RandomSlots.ts:195` | written on every save | `useScheduleSlots.ts:62,77`. Schedules always generate in the *server's* timezone. Reads as the mechanism that reconciles client/server time — it is not. Same surface as the air-date bug. |
| `PlexStreamSettings` group | `types/src/schemas/settingsSchemas.ts:193-198` | API only | `streamPath`, `updatePlayStatus`, `pathReplace`, `pathReplaceWith`. `plexSettings()` has three call sites, all echo. Bites API users and legacy-migrated settings files. |
| `periodMs` | `types/src/api/RandomSlots.ts:40, 197` | no | Lowest priority. |

Also dead, but never wired to anything and not user-facing:
`SchedulingOperationSchema` members in `types/src/api/Scheduling.ts:77-134`
(`allowMultiple`, `ascending`, `startHour`, `mod`, `allowedOffsets`,
`alignChannelStartTime`) — a published API schema with no producer and no consumer.

`lockWeights` (`types/src/api/RandomSlots.ts:200`) is unread by the server but documented
in place as UI-only state. **Intentional — not a defect.**

---

## Checked and sound (do not re-walk)

- `stream/Session.ts:117,160` — `start`/`stop` both under `this.lock`; the `cleanup`
  handler at `SessionManager.ts:334` correctly identity-checks before deleting.
- `stream/SessionManager.ts` — its `MutexMap` (`:59`) is a private field on a genuine
  **singleton** binding, so it is shared correctly.
- `services/M3UService.ts` — `static lock`, all three entry points guarded;
  `regenerateCache:104` correctly calls the unguarded internal to avoid self-deadlock.
- `services/EntityMutex.ts` + `MediaSourceScanCoordinator` — singleton, correct.
- Lineup/settings **file** writes go through lowdb's `TextFile` → `steno`, which is
  serialized and write-then-rename atomic. The in-memory `data` object is the problem,
  not the file. (Except `saveChannelLineupDirect` — see G4.)
- Deliberate and correct error swallowing: `TroubleshootService.ts:562`,
  `globalTestSetup.ts:38`, `util/containerUtil.ts:20,49`, `SessionManager.ts:318,350`,
  `MediaSourceApiFactory.ts:154`, `HealthCheckService.ts:30-60`,
  `SubtitleExtractorTask.ts:324-347`.
- Confirmed-live settings (long list, spot-check before re-auditing): all `midRoll`
  fields, `watermark.fixedSize`/`opacity`/`duration`/margins/`fadeConfig.leadingEdge`,
  `fillerRepeatCooldown`, filler-list `cooldownSeconds`, `direction`, `fillerOrder`,
  `linkMode`, `rerunOverflow`, `guideFlexTitle`, `guideMinimumDuration`,
  `disableFillerOverlay`, `offline.picture`/`mode`, `deinterlaceVideo`, `threadCount`,
  `videoProfile`, `errorScreen`/`errorScreenAudio`, `audioVolumePercent`,
  `audioSampleRate`/`audioBufferSize`, `disableHardware{Decoder,Encoding,Filters}`,
  `vaapiDriver`, all six feature flags, all `LoggingSettings` fields,
  `enablePlexRequestCache`, `maxIndexingMemory`, `snapshotIntervalHours`, `tunerCount`,
  `autoDiscoveryEnabled`, `rescanIntervalHours`, `maxBackups`/`tempDir`, `startTomorrow`,
  `enableSubtitleExtraction`, `hlsDirectOutputFormat`, `scalingAlgorithm`,
  `deinterlaceFilter`, `transcodeDirectory`, `useShowPoster`, `programmingHours`,
  `refreshHours`, `outputPath`.

---

## Separately: a perf leftover, not a fail-open bug

`Program.streamSelectionProfileId` (`server/src/db/schema/Program.ts:99`) has an FK with
`onDelete: 'set null'` but **no index**, while `program` has indexes on every other FK.
Deleting a stream selection profile full-scans `program` twice — once for the explicit
`UPDATE` at `server/src/api/streamSelectionApi.ts:57`, once for SQLite's FK enforcement.
The hot read path (`StreamSelectionProfileResolver.getProfileForProgram`) filters by
primary key and is unaffected. Delete-path only; cheap fix, needs a Drizzle migration.

Other unstarted perf items from the previous session: `res.serializer(JSON.stringify)` on
wide routes (+47ms @ 2400 items), discriminated unions in `programmingSchema.ts`,
`parseAirDate` length dispatch, `convertProgramGrouping`, filler-list double join.
