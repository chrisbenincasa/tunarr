# Investigation plan: schedule drift (guide vs. playback disagreement)

Status: not started. Scoped out of the #1991 blocking work on 2026-08-22.

## What this is

Multiple user reports describe the channel guide and actual playback disagreeing
about what is airing, or playback falling behind the schedule over time. This is
**separate** from the event-loop blocking bug fixed in #1991, and should be
investigated on its own.

Related issues:

- **#1798** — "Start and End Times drift when using Channel Redirect, Time Slots,
  and a higher EPG Hours". Drift with no saving involved. Probably the cleanest
  reproduction case.
- **#1983** — "XMLTV guide and live playback select different programs when using
  Shuffle or Ordered Shuffle with a smart collection". States the divergence
  directly.
- **#1991** — reports drift as a secondary symptom after saving time slots. The
  blocking half of that issue is fixed; the drift half was never confirmed to be
  related and may just be this bug observed under a different trigger.

## What has already been ruled out

Do not redo this work:

- **It is not SQLite or the database layer.** WAL is enabled (`DBAccess.ts:51`),
  and lineup writes are batched and bounded by distinct program count.
- **It is not event-loop blocking.** That was a real, separate bug: saving one
  channel's programming rebuilt every channel's guide. Fixed in
  `fix: scope guide rebuild to the saved channel on lineup update`. Blocking
  causes *buffering*, and buffering could plausibly cause playback to fall
  behind — but #1798 reports drift with no save at all, so blocking cannot be
  the whole story.
- **Lineups are not stored in SQLite.** They are per-channel lowdb JSON files
  under `channel-lineups/`, via `LineupRepository`.

## Central hypothesis

**There are two independent implementations of "what is playing on channel C at
time T", and they disagree.**

The codebase says so itself. `StreamProgramCalculator.ts:295`:

```
// This code is almost identical to TvGuideService#getCurrentPlayingIndex
```

- **Playback** → `StreamProgramCalculator.getCurrentProgramAndTimeElapsed`
  (`:296`) → `calculateStreamDuration` (`:593`)
- **Guide** → `TVGuideService.getCurrentPlayingIndex`
  (`TvGuideService.ts:457`)

"Almost identical" is the bug. Every behavioural difference between these two is
a candidate drift source. Below are the ones found by inspection; they are
starting points, not a confirmed root cause.

## Concrete divergences found by inspection

### 1. Mid-roll anchoring — guide only

`findMidRollAnchorIndex` is called at `TvGuideService.ts:536` and **nowhere
else** (`grep` confirms only the definition in `tvGuideUtil.ts:49` and that one
call site). The guide snaps the found index to a mid-roll anchor before
reporting; playback does not.

With mid-roll filler enabled, the guide reports the anchor program while
playback reports the raw lineup item. **This is the most likely mechanism for
#1983** and should be checked first.

### 2. End-of-program slack — playback only

`calculateStreamDuration` takes `slackAmount = SLACK` and, at `:631`, advances to
the *next* program when within slack of the current one's end:

```js
if (timeElapsed > program.durationMs - slackAmount) {
  timeElapsed = 0;
  currentProgramIndex = (programIndex + 1) % lineup.items.length;
}
```

The guide has no equivalent. Near every program boundary, playback is on N+1
while the guide still says N. This produces exactly the kind of small,
boundary-localised disagreement that reads as "drift". Check what `SLACK` is set
to — the wider it is, the more visible this becomes.

### 3. Different offsets arrays, with different validation

- Guide uses `this.accumulateTable[channel.uuid]`, built in `withGuideContext`
  (`TvGuideService.ts:396-412`). It accepts `lineup.startTimeOffsets` only when
  its length is `items.length` or `items.length + 1`, and otherwise **silently
  recomputes** via `calculateStartTimeOffsets`.
- Playback uses `lineup.startTimeOffsets` directly, with no length check and no
  fallback.

If a lineup's persisted offsets are stale or the wrong length, the guide quietly
fixes them and playback quietly uses the broken array. Worth adding an assertion
or log on the recompute branch to find out whether this fires in practice.

### 4. `binarySearchRange` called with different arguments

- Guide (`:504`): `binarySearchRange(accumulate, channelProgress)`
- Playback (`:623`): `binarySearchRange(lineup.startTimeOffsets, elapsed, true)`

The third parameter is `isSorted`, and **it is misnamed and inverted**
(`binarySearch.ts:44`):

```js
const sorted = isSorted ? sortBy(seq) : seq;
```

Passing `true` *sorts* the array. Start-time offsets are already monotonically
increasing, so the sorted values should match — this is probably not a
correctness divergence. But it means **playback re-sorts a potentially
17k-element array on every program lookup**, which is its own performance
problem, and the parameter is a landmine for whoever touches this next. Worth
fixing regardless of the drift outcome.

### 5. Stale `accumulate` after a duration resync

`TvGuideService.ts:508-523`: when `binarySearchRange` returns null, the guide
calls `syncChannelDuration`, reloads the channel and lineup, recomputes
`channelProgress` against the **new** duration — then re-runs
`binarySearchRange(accumulate, channelProgress)` against the **old, unrefreshed**
`accumulate` array. `accumulate` was captured before the reload and is not
recomputed. This looks like a genuine bug independent of the guide/playback
split.

### 6. Channel redirects

#1798 specifically involves Channel Redirect. The guide resolves redirects via
`getChannelPlaying` (`TvGuideService.ts:546`, recursing at `:643`, with a comment
at `:575` about a "long redirect block"). Playback handles redirects through a
different path. Redirect resolution is a strong candidate for divergence because
it involves reading a *second* channel's position, doubling the exposure to
everything above.

## Suggested method

1. **Write a differential test before changing anything.** Build a channel
   fixture with a known lineup, then assert that
   `StreamProgramCalculator.getCurrentProgramAndTimeElapsed` and
   `TVGuideService.getCurrentPlayingIndex` agree for a swept range of timestamps
   — across program boundaries, across cycle wraps, with and without mid-roll
   filler, with and without redirects. Both are reachable without ffmpeg or real
   media. This should fail today; the failures are the bug list.
2. Only then decide the fix. The obvious end state is **one** shared
   implementation that both callers use, but do not start by merging them — get
   the differential test green-lit as a spec first, or the merge silently picks
   one behaviour and changes the other caller.
3. `StreamProgramCalculator.test.ts` already exists and has fixtures worth
   reusing.

## Open questions for the user

These were asked in conversation but not yet answered:

- Does your own setup reproduce the drift, and under what configuration?
- Is it drift in **what the guide claims vs. what plays** (a selection
  disagreement, points at #1/#4/#6), or drift in **playback wall-clock vs. the
  schedule** (an accumulation problem, points at #2/#5)? These are different
  bugs and the distinction should narrow the search a lot.

## Note

`.claude/plans/slot-save-skew-plan.md` is the older plan from the same
conversation. Parts of it are now stale or wrong — see the correction note at the
top of that file.
