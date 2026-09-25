# Plan: Chapter-Marker-Based Mid-Roll Filler Breaks

## Context

Tunarr's mid-roll filler system currently supports three break rule types for determining where to insert filler breaks within programs: `fixed_interval`, `percentage`, and `initial_then_interval`. These are all synthetic/time-based rules that ignore the actual structure of the content.

Meanwhile, Tunarr already extracts and stores **chapter markers** from all media sources (ffprobe for local files, Plex/Jellyfin/Emby APIs) in the `program_chapter` table, with types `chapter`, `intro`, and `outro`. These chapter markers represent the actual structural boundaries of content (e.g., acts in a movie, segments of a show).

This feature adds a new `chapters` break rule type that uses these stored chapter markers to place mid-roll breaks at natural content boundaries, producing a more authentic TV-like viewing experience.

## Design Decisions (resolved)

1. **No `useMarkerBoundaries` flag** -- always break at `endTime` of matching chapters, regardless of chapter type. Simpler model: `chapterTypes` alone controls which types are eligible.
2. **Keep `fallback`** -- typed as the base three-rule union (`fixed_interval | percentage | initial_then_interval`), no recursion. Uses direct schema reference, no `z.lazy()` needed since Zod 4 is in use.
3. **`minBreakIntervalMs` instead of `minChapterDurationMs`** -- elevated to `MidRollConfigSchema` as a general post-filter: skip any break point that is less than X ms after the previous break (or program start). Applies to all rule types, not just chapters.
4. **Side-channel `Map<string, ChapterInfo[]>`** for threading chapters to the scheduler. `CondensedContentProgram` stays unchanged (memory-lean scheduling type).
5. **Always load chapters** in `collectSlotProgramming` -- no conditional check on slot configs. One extra cheap query, keeps the method simple.
6. **Single version assumption** -- straight join through `program_version`, no disambiguation. Future multi-version support would plumb a version ID separately.
7. **Chapter loading stays in `SlotSchedulerHelper`** -- scheduler services (`RandomSlotSchedulerService`, `TimeSlotSchedulerService`) remain pure (no DB calls).
8. **Extract `BreakRuleFields` UI component** -- parameterized by form path prefix, reused for both primary rule config and fallback rule config inside the chapters section.
9. **Keep `chapterTypes` filter** -- low cost, good future-proofing for intro/outro markers.
10. **Chapter times are milliseconds** in the DB -- all sources (ffprobe, Plex, Jellyfin) store ms. No conversion needed at query time.

## Pre-existing bug noted

Jellyfin `startTime` is stored as raw ticks instead of milliseconds in `JellyfinApiClient.ts:1270`. The `endTime` is correctly divided by 10,000 (ticks → ms) but `startTime` is not. This is a separate fix.

## Implementation

### 1. Add `chapters` break rule type to the schema

**File**: `types/src/api/CommonSlots.ts`

Extract the existing three-variant union as `BaseMidRollBreakRuleSchema`, then build the full schema:

```typescript
const BaseMidRollBreakRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed_interval'),
    intervalMs: z.number().positive(),
  }),
  z.object({
    type: z.literal('percentage'),
    points: z.array(z.number().gt(0).lt(100)).nonempty(),
  }),
  z.object({
    type: z.literal('initial_then_interval'),
    initialDelayMs: z.number().positive(),
    intervalMs: z.number().positive(),
  }),
]);

const MidRollBreakRuleSchema = z.discriminatedUnion('type', [
  ...BaseMidRollBreakRuleSchema.options,
  z.object({
    type: z.literal('chapters'),
    chapterTypes: z
      .array(z.enum(['chapter', 'intro', 'outro']))
      .default(['chapter']),
    fallback: BaseMidRollBreakRuleSchema.optional(),
  }),
]);
```

Add `minBreakIntervalMs` to `MidRollConfigSchema`:

```typescript
minBreakIntervalMs: z.number().nonnegative().optional(),
```

### 2. Implement chapter-based break point resolution

**File**: `server/src/services/scheduling/midRollBreakRules.ts`

Add a `ChapterInfo` type and update `resolveBreakPoints`:

```typescript
export type ChapterInfo = {
  startTime: number;  // ms
  endTime: number;    // ms
  chapterType: 'chapter' | 'intro' | 'outro';
};

export function resolveBreakPoints(
  programDurationMs: number,
  config: MidRollConfig,
  chapters?: ChapterInfo[],       // NEW optional param
): BreakPoint[] | null {
```

Add a `case 'chapters'` in the `switch` block:

- If `chapters` is empty/undefined and `breakRule.fallback` exists, recurse with a modified config using the fallback rule
- If no chapters and no fallback, return `null` (no breaks)
- Filter chapters by `breakRule.chapterTypes`
- Sort by `startTime`
- Break at `endTime` of each chapter except the last
- Deduplicate and sort offsets, filter out 0 and >= programDuration

Add `minBreakIntervalMs` post-filter after existing filters (applies to all rule types):

```typescript
if (config.minBreakIntervalMs !== undefined && config.minBreakIntervalMs > 0) {
  const filtered: number[] = [];
  let lastBreak = 0; // program start
  for (const offset of offsets) {
    if (offset - lastBreak >= config.minBreakIntervalMs) {
      filtered.push(offset);
      lastBreak = offset;
    }
  }
  offsets = filtered;
}
```

The existing `tailBufferMs`, `maxBreaks` filtering applies after this.

### 3. Thread chapter data from DB to the scheduler

#### 3a. Add chapter bulk-load query

**File**: New method on `SlotSchedulerHelper` or in an existing repository (e.g. `server/src/db/program/BasicProgramRepository.ts`).

```sql
SELECT pv.program_id, pc.start_time, pc.end_time, pc.chapter_type
FROM program_version pv
JOIN program_chapter pc ON pc.program_version_id = pv.uuid
WHERE pv.program_id IN (?)
ORDER BY pv.program_id, pc.index
```

Returns `Map<string, ChapterInfo[]>` keyed by program UUID.

#### 3b. Load chapters in `SlotSchedulerHelper.collectSlotProgramming()`

**File**: `server/src/services/scheduling/SlotSchedulerHelper.ts`

After collecting all `slotPrograms`:

- Collect all program UUIDs
- Bulk-load chapters via the query from 3a
- Change return type to `{ programs: SlotSchedulerProgram[], chapterMap: Map<string, ChapterInfo[]> }`

#### 3c. Update scheduler services to forward chapter map

**Files**:

- `server/src/services/scheduling/RandomSlotSchedulerService.ts` (`SlotSchedulerService.schedule`)
- `server/src/services/scheduling/TimeSlotSchedulerService.ts` (`TimeSlotSchedulerService.schedule`)

Both destructure the new return type from `collectSlotProgramming()` and forward `chapterMap` to `generateSchedule()` / `scheduleTimeSlots()`.

#### 3d. Thread through scheduling functions

**File**: `server/src/services/scheduling/RandomSlotsService.ts`

- `ScheduleContext` accepts `chapterMap?: Map<string, ChapterInfo[]>` and stores as a field
- Pass it to `applyMidRollBreaks()` at line ~261

**File**: `server/src/services/scheduling/TimeSlotService.ts`

- `scheduleTimeSlots()` accepts `chapterMap` parameter
- Pass it to `applyMidRollBreaks()` at line ~312

#### 3e. Update `applyMidRollBreaks` signature

**File**: `server/src/services/scheduling/slotSchedulerUtil.ts`

```typescript
export function applyMidRollBreaks(
  paddedProgram: PaddedProgram,
  slot: SlotImpl<BaseSlot>,
  midRollConfig: MidRollConfig | undefined,
  random: Random,
  chapterMap?: Map<string, ChapterInfo[]>,  // NEW
): PaddedProgram[] {
```

Inside: after the `isContentProgram` check, look up `chapterMap?.get(program.id)` and pass to `resolveBreakPoints()`.

### 4. Web UI changes

**File**: `web/src/components/slot_scheduler/MidRollConfigPanel.tsx`

#### 4a. Extract `BreakRuleFields` component

Extract the type-specific field rendering (the `{breakRuleType === 'fixed_interval' && ...}` blocks, etc.) into a reusable component:

```typescript
type BreakRuleFieldsProps = {
  pathPrefix: string; // e.g. 'midRoll.breakRule' or 'midRoll.breakRule.fallback'
};

const BreakRuleFields = ({ pathPrefix }: BreakRuleFieldsProps) => {
  // Renders type-specific fields (interval, percentage points, initial+interval)
  // using `${pathPrefix}.intervalMs`, `${pathPrefix}.points`, etc.
};
```

#### 4b. Update types and labels

- Add `'chapters'` to `MidRollBreakRuleFormFields['type']` union
- Add chapter-specific fields: `chapterTypes`, `fallback`
- Add to `breakRuleLabels`: `chapters: msg`Chapter Markers``

#### 4c. Add handler

In `handleBreakRuleTypeChange`, add:

```typescript
case 'chapters':
  setValue('midRoll.breakRule', {
    type: 'chapters',
    chapterTypes: ['chapter'],
  });
  break;
```

#### 4d. Add chapter-specific config UI

When `breakRuleType === 'chapters'`, render:

1. **Chapter types** -- checkboxes for `chapter`, `intro`, `outro` (default: only `chapter` checked)
2. **Fallback rule** -- dropdown to select an alternative rule type (`fixed_interval`, `percentage`, `initial_then_interval`, or "None"). When a fallback type is selected, render `<BreakRuleFields pathPrefix="midRoll.breakRule.fallback" />` inline.

#### 4e. Add `minBreakIntervalMs` to Limits section

Add a new field in the Limits section (alongside `maxBreaks`, `minProgramDurationMs`, `tailBufferMs`):

```
Min Break Interval (minutes) — "Skip breaks that are closer together than this"
```

This applies to all rule types since it's on `MidRollConfigSchema`.

### 5. Edge cases

| Scenario                                                                     | Behavior                                                                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Program has no chapters                                                      | Use fallback rule if configured; otherwise skip mid-roll (no breaks)                         |
| Program has 1 chapter spanning the full duration                             | No boundaries -> no breaks                                                                   |
| Chapter `endTime` > program duration                                         | Filter out (existing offset filter handles this)                                             |
| Multiple `ProgramVersion`s                                                   | Use first version's chapters (single version assumed for now)                                |
| `tailBufferMs` / `maxBreaks` / `minProgramDurationMs` / `minBreakIntervalMs` | Applied by existing code after break point calculation                                       |
| Fallback rule is also `chapters`                                             | Prevented in schema: fallback type is `BaseMidRollBreakRuleSchema` which excludes `chapters` |
| Two break points closer than `minBreakIntervalMs`                            | Second one is skipped (greedy left-to-right)                                                 |

### 6. Files to modify (summary)

| File                                                           | Change                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `types/src/api/CommonSlots.ts`                                 | Extract `BaseMidRollBreakRuleSchema`, add `chapters` variant, add `minBreakIntervalMs` to `MidRollConfigSchema` |
| `server/src/services/scheduling/midRollBreakRules.ts`          | Add `ChapterInfo` type, `chapters` param, `case 'chapters'`, `minBreakIntervalMs` post-filter                   |
| `server/src/services/scheduling/slotSchedulerUtil.ts`          | Add `chapterMap` param to `applyMidRollBreaks`, pass to `resolveBreakPoints`                                    |
| `server/src/services/scheduling/SlotSchedulerHelper.ts`        | Add chapter bulk-load query, change return type                                                                 |
| `server/src/services/scheduling/RandomSlotSchedulerService.ts` | Forward chapter map                                                                                             |
| `server/src/services/scheduling/RandomSlotsService.ts`         | Add `chapterMap` to `ScheduleContext`, pass to `applyMidRollBreaks`                                             |
| `server/src/services/scheduling/TimeSlotSchedulerService.ts`   | Forward chapter map                                                                                             |
| `server/src/services/scheduling/TimeSlotService.ts`            | Accept and pass `chapterMap` to `applyMidRollBreaks`                                                            |
| `web/src/components/slot_scheduler/MidRollConfigPanel.tsx`     | Extract `BreakRuleFields`, add chapter rule UI, add `minBreakIntervalMs` field                                  |

### 7. Verification

1. **Unit tests** for `resolveBreakPoints` with chapters:

   - Standard chapter boundaries produce correct offsets
   - `chapterTypes` filter works
   - Fallback activates when no chapters
   - `minBreakIntervalMs` skips closely-spaced breaks (for all rule types)
   - `maxBreaks` / `tailBufferMs` constraints apply
   - Empty chapters + no fallback returns null

2. **Typecheck**: `pnpm turbo typecheck` across all packages

3. **Lint**: `pnpm lint-changed`

4. **Manual test**: Configure a slot with `chapters` break rule, schedule a channel with chaptered content, verify the lineup shows breaks at chapter boundaries
