# Frontend Audit — Plan

Generated 2026-08-23, after the server-side fail-open sweep. **No frontend code has
been changed.** This plan exists because the previous session's conclusions about the
frontend were drawn from having read two files, which is not evidence.

## Verification legend

- **[V]** — I read or ran this myself and confirmed it.
- **[A]** — Reported by a recon agent, consistent with the code, not independently confirmed.

---

## Baseline (measured, [V])

| Metric | Value |
|---|---|
| Source, excluding `generated/` | **51,535 lines / 443 files** |
| `components/` | 30,486 lines / 185 files |
| `hooks/` | 6,069 lines / 89 files |
| `pages/` | 6,795 lines / 37 files |
| `store/` | 1,785 lines / 19 files |
| `helpers/` | 2,584 lines / 23 files |
| **Test files** | **11** |

Files touching each state system:

| System | Files |
|---|---|
| Zustand | **137** |
| TanStack Query | 67 |
| React Hook Form | 53 |
| `useState` | 94 |
| `useEffect` | 47 |

Two facts that reset earlier assumptions:

1. **Test tooling is already installed and configured.** `vitest`, `jsdom`,
   `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`,
   `web/vitest.config.ts`, and a shared `renderWithProviders` harness at
   `web/src/test/utils.tsx`. The barrier to frontend tests is not tooling. It is that
   11 files cover 51.5k lines.
2. **Zustand is the most-used state system, not TanStack Query** — and the stores are
   named `channelEditor`, `customShowEditor`, `fillerListEditor`. Those hold drafts of
   server entities. This is the opposite of what was assumed.

### Free signal already being ignored [V]

`npx eslint src` over `web/` reports ~50 warnings that nobody acts on:

| Count | Rule |
|---|---|
| 13 | `react-hooks/refs` |
| 8 | `react-hooks/exhaustive-deps` |
| 7 | `react-hooks/preserve-manual-memoization` |
| 6 | `react-hooks/set-state-in-effect` |
| 3 | `react-hooks/incompatible-library` |
| 3 | parse-error |
| 2 | `react-hooks/immutability` |

`set-state-in-effect` and `immutability` are precisely the state-duplication hazards
this audit is about. This is the cheapest available evidence and it is already sitting
there.

---

## Confirmed defects [V]

### FE1 — Inverted guard silently produces `NaN`

`web/src/components/slot_scheduler/SlotProgrammingTooLongWarningDetails.tsx:95`

```ts
if (durations.length === 0) {
  averageLength = dayjs.duration(round(sum(durations) / durations.length));
}
```

Divide by zero when there are no durations; the average is **never computed** when there
are some. The `'show'` branch 15 lines below (`:114`) is the same code with the correct
`> 0`, so this is a typo with its own correct twin adjacent to it.

Consequence: the "programming too long" warning shows a meaningless average, or nothing.
Fail-open in the UI — exactly the class the server sweep targeted.

### FE2 — `timeZoneOffset` is captured at edit time and never used as a timezone

Five sites, all `new Date().getTimezoneOffset()` [V]:

- `hooks/slot_scheduler/useScheduleSlots.ts:62`, `:77`
- `pages/channels/RandomSlotEditorPage.tsx:121`
- `pages/channels/TimeSlotEditorPage.tsx:109`, `:190`

`dayjs/plugin/timezone` is imported in `TimeSlotEditorPage.tsx:48` and extended at `:79`.
**`.tz(` appears zero times in the entire frontend** [V]. There is no timezone handling;
everything is implicit local time.

So a schedule saved in January is transmitted with the winter UTC offset and applies to
summer playback. This corroborates the note in the fail-open plan (G10) that
`timeZoneOffset` "reads as the mechanism that reconciles client/server time — it is not."
It is a snapshot of the editor's offset at save time.

### FE3 — DST-unsafe duration arithmetic [A, high confidence]

`helpers/slotSchedulerUtil.ts:152-153` defines `OneDayMillis = 86400000` and
`OneWeekMillis`. A DST-transition day is 23 or 25 hours. These constants are mixed with
DST-aware `dayjs().startOf('day')` in the same computations:

- `components/slot_scheduler/TimeSlotTable.tsx:106`, `:265`
- `components/slot_scheduler/EditTimeSlotDialogContent.tsx:145-167`, `:367-369`
- `pages/channels/TimeSlotEditorPage.tsx:257-266`
- `hooks/calendarHooks.ts:100-125` — mixes both in one loop

Needs a reproduction before it is called a bug. See Phase 2.

### FE4 — `store/customShowEditor/store.ts` is a 0-byte file [V]

Not a bug on its own. A signal that the store layer has drifted.

---

### FE5 — Channel create and delete invalidate a cache key that matches nothing [V, structural]

Two query-key conventions coexist. The generated client (`generated/@tanstack/react-query.gen.ts:17-25`)
builds keys whose first element is an **object** carrying `tags` — 13 queries are tagged
`Channels`. `helpers/queryUtil.ts:9` consumes exactly that shape:

```ts
const key = first(query.queryKey);
if (!isObject(key)) {
  return false;          // every plain-string key is silently unmatched
}
```

But two call sites invalidate with a plain string key instead:

- `hooks/useCreateChannel.ts:14` — `queryKey: ['Channels']`
- `pages/channels/ChannelsPage.tsx:164` — `queryKey: ['Channels']`

TanStack matches keys structurally by prefix. The generated queries start with an object;
these filters start with the string `'Channels'`. **They match nothing, so creating and
deleting a channel do not invalidate the channel list.**

`queryKeySchema` also declares `tags` as `.optional()`, so an object key that simply has no
tags parses fine and then intersects to zero — a second fail-open in the same nine lines.

**Verification status:** confirmed by reading, *not* reproduced at runtime. The production
`QueryClient` (`queryClient.ts:13`) passes no `defaultOptions`, so `staleTime: 0` applies and
navigating away and back refetches regardless — which masks this in the common flow. It is
not masked while the list stays mounted, and `removeChannelMutation` is defined inside
`ChannelsPage` itself, so delete-from-the-list is the case that should show it. Reproduce
before fixing.

Related, unexamined: five mutation files invalidate nothing at all —
`hooks/slot_scheduler/useScheduleSlots.ts` (the slot save path),
`components/channel_config/ChannelEditActions.tsx`, `pages/settings/TaskSettingsPage.tsx`,
`pages/settings/ScannerSettingsPage.tsx`, `pages/system/TroubleshootPage.tsx`.

## Candidate classes [A] — to be confirmed, not yet acted on

### C1 — Server state is duplicated many times over

On the slot scheduler page the same lineup reportedly exists in **at least six**
in-memory representations: three query-cache entries, `channelEditor.originalProgramList`,
`channelEditor.programList`, and the RHF field array — plus two separate program lookup
maps (`channelEditor.programLookup` and a global `programming.programLookup`, written in
the same action) and a non-memoized selector that re-materializes both lists on every read
(`store/selectors.ts:72-90`).

Reconciliation is hand-written per page and layered: `safeSetCurrentChannel` (which
reportedly *drops* fresh server data when ids match and `programsLoaded` is true —
`store/channelEditor/actions.ts:126-128`), `resetLineup()`, `resetCurrentLineup()`,
plus three separate `invalidateQueries` calls.

This is the strongest candidate for "the value I saved isn't the value I see".

### C2 — `useEffect` used to sync one state source into another

~15 sites. Notable:
- `pages/settings/XmlTvSettingsPage.tsx:46-50` and `HdhrSettingsPage.tsx:47-51` — query → `reset()`
- `components/library/LibraryProgramGrid.tsx:186-200` — TanStack infinite-query pages → Zustand
- `components/slot_scheduler/RandomSlotsWeightAdjustDialog.tsx:38-53` — bidirectional form ↔ local state loop
- `components/slot_scheduler/RandomSlotTable.tsx:130-144` — form writes to form

### C3 — `defaultValues` **and** `values` from the same query [V]

`pages/settings/FeaturesSettingsPage.tsx:102-105`, compounded by
`reset(result.flags, { keepValues: true })` at `:111` — two competing sync paths on one
form. Same `keepValues: true` reset-after-save at `XmlTvSettingsPage.tsx:61` and
`FfmpegSettingsPage.tsx:134`.

### C4 — Whole-object submit where only part changed

The frontend counterpart to the server partial-update bugs just fixed. Clearest case
[V], `components/channel_config/ChannelProgrammingConfig.tsx:96-104`: the condition
checks that **only** `startTime` differs, then PUTs the **entire channel** — and the
object it sends is the *Zustand* copy, which may be staler than the query cache. (Also
note the unguarded `channel!.id` immediately below, against the repo's own rule.)

Others [A]: `EditChannelForm.tsx:177-224`, `TimeSlotEditorPage.tsx:187-227`,
`RandomSlotEditorPage.tsx:115-152`, `GeneralSettingsForm.tsx:184-209`.

`GeneralSettingsForm.tsx:196-203` maps `'inherit' → null` to mean "unset", which is
exactly the shape a partial-update-mishandling server clobbers. Cross-check against the
settings fixes in PR #2005.

### C5 — A second, hand-rolled cache

`store/programmingSelector` reportedly holds `knownMediaByServer` and
`contentHierarchyByServer`: a normalized cache of Plex/Jellyfin/Emby metadata with no TTL
and no invalidation, filled from a `useEffect` over TanStack infinite-query pages. If
confirmed, this is a second query cache running beside the first.

### C6 — Direct query-cache writes

`hooks/useSystemSettings.ts:27-28` writes the mutation response straight into the cache
with `setQueryData` and no invalidation. `hooks/media-sources/mediaSourceLibraryHooks.ts:30-110`
is a correctly-shaped optimistic update but denormalizes one library into two cache
entries.

---

## What makes a frontend bug different

Worth stating before the method, because it determines where to point the sweep.

**The client is a long-lived concurrent writer holding a copy. The server never is.** A
request is bounded; when it ends nothing is retained. Every class below follows from that
one difference, which is why the server sweep's techniques do not transfer unchanged.

| # | Class | Notes |
|---|---|---|
| 1 | **Dead invalidation** — a cache key no mutation matches | FE5. No server equivalent. |
| 2 | **Lost update from a held copy** — read into store, `await`, write back over a concurrent change | Exact twin of the lineup-by-reference bug (G6b) fixed server-side. |
| 3 | **Write amplification** — whole-object PUT from a stale copy reverts untouched fields | C4; confirmed at `ChannelProgrammingConfig.tsx:96-104`. |
| 4 | **Optimistic/actual divergence** — server normalizes, client never reconciles | Was *amplified* by the silent-rewrite bugs just fixed: while the server rewrote values, every optimistic copy was a lie. |
| 5 | **Effect-driven sync loops** | C2; 6 `set-state-in-effect` warnings already present. |
| 6 | **Stale closure / TOCTOU across renders** — state read in render N acted on in render N+3 | |
| 7 | **Input coercion at the DOM boundary** — `<input type="number">` yields strings, `''` becomes `0` | Client-side twin of the empty-`limit` paging bug (G2). |
| 8 | **Edit-time vs apply-time context** | FE2/FE3. |
| 9 | **List identity under reorder** — index keys in a drag-and-drop lineup editor | |
| 10 | **Navigation/unmount races** — mutation resolves after its owner is gone | |

Classes 2, 3, 4 and 7 are mirror images of server bugs fixed in the fail-open sweep. The
same pattern reappears on the other side of the wire, which argues for running this while
that work is still fresh.

## Method

### Phase 0 — Harvest what is already free

Triage the ~50 existing eslint warnings. Decide per rule: fix, or turn off with a reason.
Leaving them as permanently-ignored warnings is the worst of both. `set-state-in-effect`,
`immutability` and `exhaustive-deps` are the ones with bug potential; start there.

**Cost: hours. No new infrastructure.**

### Phase 0.5 — Mechanical sweeps

The server sweep worked for one reason: the invariants were **written down in an enumerable
structure**. Zod schema trees are walkable, so a ~200-line walker found `.default()` hiding
under `.partial()` mechanically, and independently rediscovered a known bug — which is what
validated the detector.

The transferable part is not "grep for suspicious code." It is *find where the codebase
states an invariant, then walk it.* The frontend has four such structures, and none of them
are components — which is why reading components is the wrong entry point.

| Sweep | Structure walked | Invariant | Detects |
|---|---|---|---|
| **S1** | Query keys vs `invalidateQueries`/`setQueryData` filters | "after this write, that read is stale" | Dead invalidation (class 1). **Already paid out — see FE5.** |
| **S2** | Hook dep arrays vs referenced identifiers | "recompute when these change" | Stale closures (class 6). Partly what `exhaustive-deps` already reports. |
| **S3** | Zustand action read/write sets per slice | "who owns this field" | Sync loops (class 5), duplicated ownership (C1). A read→effect→write cycle is the bug. |
| **S4** | Hand-built submit payloads vs `@tunarr/types` request schemas | "what the client sends is what the server accepts" | Write amplification (class 3), coercion at the boundary (class 7). |

**S4 is worth calling out as non-circular.** An OpenAPI differential was rejected for the
server because the spec is generated from the same schemas it would be checked against. That
objection does not apply here: the submit payloads are hand-written and the schemas are
generated, so the two artifacts are independent and disagreement is real signal.

S1 is the one to run first — it took roughly six greps to produce FE5.

#### Track B — payload invariants, for what is not statically enumerable

Render order, effect scheduling and event interleaving do not live in code shape, so no
walker finds them. A browser is not required either. Drive an editor as a reducer with
scripted action sequences and assert on **what the client would send**, not what it renders:

- save twice with no edit in between → byte-identical payloads
- edit field A, save → the payload contains A and nothing else
- load, allow a background refetch, then save → the refetch did not resurrect stale values
- double-submit → one request, or two identical ones

Cheap, no DOM, and aimed squarely at the class that broke the settings endpoints from the
other side. These are the same assertions as the server-side partial-update tests, written
from the client.

### Phase 1 — Propagate the pattern that already works

`hooks/programming_controls/` already does the right thing: each `useX.ts` exports the
algorithm as a plain function (`sortPrograms`, `removeDuplicatePrograms`, `addBreaks`,
`padStartTimes`, `restrictHours`, `replicatePrograms`) and the hook is reduced to
store-read → call → store-write. **Five of the eleven existing test files test those pure
functions**, and they need no providers and no mocks.

That convention is the highest-leverage thing in the codebase. Propagate it to the logic
currently fused into component bodies:

| Target | Location |
|---|---|
| Slot duration + wraparound + `program_too_long` | `components/slot_scheduler/TimeSlotTable.tsx:127-188` |
| Day↔week slot expansion (~40 pure lines) | `pages/channels/TimeSlotEditorPage.tsx:230-273` |
| Frequency percentages returned as **JSX** | `pages/channels/RandomSlotEditorPage.tsx:154-176` — and `hooks/slot_scheduler/useCalculatorProgramFrequency.ts:9-15` already does the identical math, so this is duplicated logic |
| Average-duration-by-slot-type | `SlotProgrammingTooLongWarningDetails.tsx:85-120` — **contains FE1** |
| Weight redistribution | `hooks/slot_scheduler/useAdjustRandomSlotWeights.ts:4-46` — already a pure body inside `useCallback([])`; near-free to extract |
| Calendar day math | `hooks/calendarHooks.ts:62-131` — densest date logic in the app, untested |
| Lineup offset recomputation | `store/channelEditor/actions.ts:54-70`, `:227-255` — module-private, unreachable from a test today |
| Lineup materialization | `store/selectors.ts:23-63` — already pure and exported, just untested |
| `betterHumanize` | `helpers/dayjs.ts:50-108` — pure, format-sensitive, untested |
| Mid-roll grouping | `helpers/midRollGrouping.ts:35+` — pure, untested |

Extract → test → leave the component calling it. Each is independently shippable.

### Phase 2 — Time and duration correctness

The one place to write genuinely adversarial tests, because FE2 is confirmed and FE3 is
likely. Run the extracted functions from Phase 1 across:

- a DST spring-forward and fall-back boundary, in a timezone that has them
- a schedule authored in one offset and evaluated in the other
- week-period schedules spanning a transition
- `TZ=` set to several zones in the test env, including a half-hour offset (e.g. `Asia/Kolkata`) and one with no DST

Decide the actual contract first: **is a slot's `startTime` a wall-clock time or an offset
from a fixed instant?** The code currently behaves as both. That question is the real
deliverable — it is also the input to the infinite-scheduling work.

### Phase 3 — State ownership

Only after Phases 1–2. Confirm C1 and C5 with a written map, then decide ownership rules
for the four systems that already exist:

- What is server state? (Query owns it, one copy.)
- What is client/UI state? (Zustand — `settings` and `theme` slices already do this well
  and are Zod-validated on hydrate.)
- What is draft/edit state, and does it need a store at all, or is it RHF's job?

**Do not evaluate a new state library before this step.** The evidenced problem is
duplication and undefined ownership, not a missing tool. A fifth system laid over four
un-owned ones makes it worse. If a library is warranted afterwards, the likely shape is a
state machine for genuinely multi-step editor workflows, not a global-store replacement.

### Phase 4 — Browser tests, narrow

Last, and deliberately small. Only for what a non-browser test cannot see: is the control
disabled, does the value render back, did the form send what was typed.

One test shape, per settings page: load → change one field → save → reload → assert that
field held **and nothing else moved**. That shape would have caught the xmltv, system
settings and feature-flag bugs from the server sweep, from the other side.

Worth setting up trace-on-failure regardless of suite size, for the visible reproductions.

---

## Corrections to earlier advice in this session

Recorded so the reasoning is auditable:

1. **"Extract logic so it's testable with plain vitest"** — the premise that a browser was
   required for component testing was wrong. jsdom + Testing Library are already
   configured. Extraction is still the right first move, but because pure functions are
   cheaper to test and to reason about, not because the alternative is unavailable.
2. **"Today's bugs weren't state-management bugs"** — circular. Only the server was
   audited. Discarded as evidence.
3. **"You already have a sophisticated stack"** — true but incomplete. Zustand is in 137
   files holding server-entity drafts, which is a heavier and more duplicated arrangement
   than "four well-chosen libraries" implied.

---

## Suggested order

| Order | Item | Why |
|---|---|---|
| 1 | **FE1** — inverted guard | One-line fix with a correct twin adjacent. Do it now. |
| 2 | **Phase 0** — eslint triage | Free signal already generated and ignored. |
| 3 | **Phase 0.5 / S1** — query-key sweep | Cheapest sweep, already produced FE5. Reproduce FE5 at runtime, then fix. |
| 4 | **Phase 1** — extract + test, starting with slot scheduling | Proven pattern; converges with the slot-scheduling deep dive. |
| 5 | **FE2/FE3 + Phase 2** — time correctness | Confirmed defect plus the contract question that feeds infinite scheduling. |
| 6 | **Phase 0.5 / S4 + Track B** — payload invariants | Pairs directly with the server partial-update fixes. |
| 7 | **Phase 0.5 / S2, S3 + Phase 3** — state ownership | Needs the above to be evidenced first. |
| 8 | **Phase 4** — narrow browser tests | Cheapest last, once the surface is small. |
