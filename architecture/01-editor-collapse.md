# 01 — Collapse the three editors into one Lineup module

Status: **Deep dive complete · plan recorded · not implemented**
Date: 2026-08-24 · Scope: `@tunarr/web` · Candidate #1 of 6 (see [README.md](./README.md))

## Context

The Tunarr web app edits three entities — channels, custom shows, and filler lists — each of which has an ordered program list. That list has invariants: every entry carries a `uiIndex`, an `originalIndex`, and a cumulative `startTimeOffset`; the editor tracks a `dirty` flag (modified since load) and keeps an `original` copy for reset; condensed program references are materialized against a program lookup.

Today that one concept has no module — its invariants are re-implemented across eight files, and none of it is tested.

## Friction (why this is a candidate)

Three **offset/index mechanisms**:

- `addIndexesAndCalculateOffsets` — `store/channelEditor/actions.ts:54-70`
- `materializeProgramList` — `store/selectors.ts:23-63` (recomputes offsets again at read time)
- `zipWithIndex` — `helpers/util.ts:135-144` (index only, no offset)

The `firstOffset = lastItem.startTimeOffset + lastItem.duration` pattern appears **four times** in `store/channelEditor/actions.ts`: `appendToCurrentLineup:162-163`, `addProgramsToCurrentChannel:212-215`, `addMediaToCurrentChannel:325-328`, `setProgramAtIndex:235-238`.

Two **`programLookup` fields**: top-level `store/programming/store.ts:5` and nested `store/channelEditor/store.ts:47`. Both are written by `updateProgramList` (`channelEditor/actions.ts:80-85`), `addMediaToCurrentChannel` (`:357-358`), and `setCurrentCustomShow` (`customShowEditor/actions.ts:67`).

Three **copy-pasted `addMedia` transforms** with the identical `console.warn` string:

- `addMediaToCurrentChannel` — `store/channelEditor/actions.ts:280-360`
- `addMediaToCurrentCustomShow` — `store/customShowEditor/actions.ts:15-46`
- `addMediaToCurrentFillerList` — `store/fillerListEditor/action.ts:15-49`

**Divergent `move` behavior**: `moveProgramInCurrentChannel` swaps two items without reindexing (`channelEditor/actions.ts:257-270`); `moveProgramInCustomShow` splices and reindexes `uiIndex` (`customShowEditor/actions.ts:80-99`).

Other smells:

- `resetChannelEditorState` (`channelEditor/actions.ts:44-52`) spreads `...initialChannelEditorState`, which includes all three editors, so a function named for the channel editor silently resets custom-show and filler too.
- `store/entityEditor/util.ts` holds two real helpers (`deleteProgramAtIndex`, `deleteProgramById`) plus four pass-through wrappers (`deleteProgram`, `removeChannelProgramsById`, `removeCustomShowProgram`, `removeFillerListProgram`) and a dead `schedulePreviewList` field with zero consumers.
- `ProgrammingEditorState<T,P>` (`store/channelEditor/store.ts:21-39`) is a generic that is **never parameterized**; `createChannelEditorState` returns a hardcoded object literal.
- `store/customShowEditor/store.ts` is empty; `store/fillerListEditor/` has no `store.ts` at all — "store-per-editor" is nominal.
- **Zero store tests.** Every action is a module-level function calling the singleton `useStore.setState` directly, so there is no injection point.

## Design tree (decisions)

| # | Branch | Chosen | Rejected | Why |
|---|--------|--------|----------|-----|
| 1 | Module shape | Pure domain module + thin store adapter | Store slice factory | Tests hit the pure functions directly; no fresh-store-per-test. Zustand stays but shrinks to `editor.lineup = append(...)`. |
| 2 | Editor multiplicity | Three `Lineup` values, one transition set | One polymorphic `currentEditor` | Least disruption; keeps channel's extra fields (`schedule`, `dynamicContentConfiguration`) editor-level; `currentEntityType` stays. |
| 3 | Offset scope | Uniform — every Lineup computes offsets | Channel-only, parameterized | One index+offset algorithm; custom-show/filler gain a harmless field; no per-editor branch. |
| 4 | Lineup boundary | Program list only | Include the entity | Entity metadata (name, startTime, config) has its own edit lifecycle; mixing it is what made `ProgrammingEditorState` shallow. |
| 5 | Lookup ownership | External single lookup, passed to `materialize` | Inside the Lineup | Lookup is server data (a cache); `materializedProgramListSelector` already takes it as a param; dovetails with candidate #5. |
| 6 | `addMedia` conversion | `convertAddedMedia` inside the Lineup module | Sibling module | Only used in the add-to-lineup path; split later if a second caller appears. |
| 7 | Scope vs candidate #4 | CRUD core now; transforms stay for #4 | Fold transforms in now | Clean separation; #4 rewrites the sort/shuffle/balance hooks to emit `items[]` that `set()` consumes. |
| 8 | File location | `web/src/model/Lineup.ts` | `web/src/lineup/` directory | `model/` is where domain value types live; provisional — `model/` is under review in candidate #3. |
| 9 | Migration order | Incremental, channel-first | Big-bang | Zero store tests today; channel is the biggest and most-duplicated; green at each step. |

## Settled interface

```ts
type Indexed<P> = P & { uiIndex: number; originalIndex: number; startTimeOffset: number };
type Lineup<P> = {
  items: Indexed<P>[];
  original: Indexed<P>[];
  dirty: boolean;
  loaded: boolean;
};

set(items: P[]): Lineup<P>                       // load/replace — computes indices + offsets
append(items: P[]): Lineup<P>                    // append — offsets from last item
move(fromOriginalIndex, toIndex): Lineup<P>      // reorder + reindex (unifies the swap-vs-splice divergence)
removeAt(index: number): Lineup<P>
removeById(ids: Set<string>): Lineup<P>
reset(): Lineup<P>                               // restore original, clear dirty
materialize(lookup): UIProgram[]                 // condensed → full join only, no offset math
convertAddedMedia(media: AddedMedia[]): P[]      // custom-show disallowed inside a custom-show
```

`P` is the program element type: condensed for channel, full `ContentProgram`/`CustomProgram` for custom-show and filler. The editor shape becomes `{ entity, lineup }` per entity, with `schedule` and `dynamicContentConfiguration` remaining channel-editor-level.

## Implementation plan

1. Add `web/src/model/Lineup.ts` — the value type + transitions above. No React, no Zustand imports.
2. Add `web/src/model/Lineup.test.ts` — offset consistency across set/append/move; dirty semantics; reset restores original; removeAt/removeById bounds; `convertAddedMedia` policy; `materialize` joins without recomputing offsets.
3. Migrate `store/channelEditor/actions.ts` to thin `useStore.setState(s => { s.channelEditor.lineup = append(s.channelEditor.lineup, convertAddedMedia(programs)) })`; delete `addIndexesAndCalculateOffsets` and inline offset math.
4. Migrate `store/customShowEditor/actions.ts` + `store/fillerListEditor/action.ts` the same way.
5. Collapse the two `programLookup` fields into the single top-level `State.programLookup`; delete `channelEditor.programLookup`.
6. Delete `store/entityEditor/util.ts` (four pass-through wrappers + dead `schedulePreviewList`).
7. Update `store/selectors.ts` — `materializedProgramListSelector` becomes `materialize(editor.lineup.items, programLookup)`.
8. Fix latent bugs: `resetChannelEditorState` stops silently resetting all three editors; `move` unifies to splice+reindex.
9. Verify `pnpm lint-changed`, `pnpm typecheck`, and the Lineup tests.

## Out of scope

- **Candidate #4** — the `programming_controls` transforms (sort/shuffle/balance/pad/restrict) stay in their hooks; they rewrite against `set` later.
- **Candidate #5** — moving the external lookup out of the store entirely (to TanStack Query).

## Tests

`web/src/model/Lineup.test.ts` is the new test surface. The store layer becomes thin enough to verify by typecheck + the existing suite.

## Next-session notes

- Candidate #2 (API seam) grilling is **in progress** — three branches are open: client seam, baseURL strategy, query layer. The question prompt was cancelled before answers were recorded; nothing for #2 is written down yet.
- Domain terms live in [`CONTEXT.md`](/CONTEXT.md): **Lineup**, **LineupSchedule**, **Program lookup**, **Editor**.
