import type { Dayjs } from 'dayjs';
import { z } from 'zod/v4';

// Where a program iterator left off at the end of a build. Passing it to the
// next build makes that build continue instead of starting over.
//
// Ordered iterators store the last program they played. That also covers
// `ordered_shuffle`, because a rotated list keeps the cyclic order of the
// sorted list, so resuming after a program needs no rotation offset.
//
// Shuffle iterators store the programs played in the current pass, so a pass
// plays every program once before any repeats. Stable shuffles also store the
// seed and pass number that rank each pass, which makes a restore exact.
export const ProgramIteratorSnapshotSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ordered'),
    lastProgramId: z.string(),
  }),
  z.object({
    type: z.literal('shuffle'),
    playedIds: z.string().array(),
    seed: z.number().int().nonnegative().optional(),
    pass: z.number().int().nonnegative().optional(),
  }),
]);

export type ProgramIteratorSnapshot = z.infer<
  typeof ProgramIteratorSnapshotSchema
>;

export const PeriodPlaysSchema = z.object({
  programIds: z.string().array().nonempty(),
  replayCursors: z.number().int().nonnegative().array(),
});

export type PeriodPlays = z.infer<typeof PeriodPlaysSchema>;

// Scheduler state carried from one build to the next. The RNG position is
// the separate `discardCount`, which the schedulers already accept and return.
//
// Keys come from `createSlotIterators` and depend on slot order, so this state
// is only valid for the schedule that produced it.
export const SlotIteratorStateSchema = z.object({
  iterators: z.record(z.string(), ProgramIteratorSnapshotSchema),

  // All-rerun link groups only. How many of the group's slots have already
  // aired the group's current program, keyed like `iterators`.
  rerunPlays: z.record(z.string(), z.number().int().positive()).optional(),

  // Mixed link groups only, keyed like `iterators`. The programs the group's
  // continue slots played that its rerun slots have not all replayed yet,
  // and each rerun slot's place in that list, in slot order. Time slots
  // clear it each period.
  periodPlays: z.record(z.string(), PeriodPlaysSchema).optional(),

  // Random slots only. The next slot for sequential distribution, and when
  // each slot last played, keyed by its index in the sorted slot list.
  nextSlotIndex: z.number().int().nonnegative().optional(),
  slotLastPlayedMs: z.record(z.string(), z.number()).optional(),
});

export type SlotIteratorState = z.infer<typeof SlotIteratorStateSchema>;

export type SlotCycleOptions = {
  iteratorState?: SlotIteratorState;
  // Replaces the `maxDays` limit. A cycle ends at the end of its last program,
  // not exactly here, so the next cycle must start where this one ended.
  // Time slots check this time only when a slot starts, so the slot it falls
  // in fills its whole window. Random slots stop after the crossing slot's
  // whole group, because collecting the group advanced its iterators.
  // Also stops `startTomorrow` from moving the start, because the caller
  // picks each cycle's start.
  endTime?: Dayjs;
  // Record a checkpoint at each point the scheduler could restart from.
  checkpoints?: boolean;
  // Shuffle slots rank each pass by their own stored seed instead of the
  // shared RNG. See ShuffleOptions.
  stableShuffle?: boolean;
  // Redirect slots that target one of these channels produce nothing, so the
  // scheduler plays flex in their place.
  missingRedirectChannelIds?: ReadonlySet<string>;
};
