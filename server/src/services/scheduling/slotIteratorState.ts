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
// plays every program once before any repeats.
export const ProgramIteratorSnapshotSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ordered'),
    lastProgramId: z.string(),
  }),
  z.object({
    type: z.literal('shuffle'),
    playedIds: z.string().array(),
  }),
]);

export type ProgramIteratorSnapshot = z.infer<
  typeof ProgramIteratorSnapshotSchema
>;

// Scheduler state carried from one build to the next. The RNG position is
// the separate `discardCount`, which the schedulers already accept and return.
//
// Keys come from `createSlotIterators` and depend on slot order, so this state
// is only valid for the schedule that produced it.
export const SlotIteratorStateSchema = z.object({
  iterators: z.record(z.string(), ProgramIteratorSnapshotSchema),

  // Random slots only. The next slot for sequential distribution, and when
  // each slot last played, keyed by its index in the sorted slot list.
  nextSlotIndex: z.number().int().nonnegative().optional(),
  slotLastPlayedMs: z.record(z.string(), z.number()).optional(),
});

export type SlotIteratorState = z.infer<typeof SlotIteratorStateSchema>;

export type SlotCycleOptions = {
  iteratorState?: SlotIteratorState;
  // Replaces the `maxDays` limit. Programs that cross this time still air, so
  // a cycle ends at the end of its last program, not exactly here. Time slots
  // stop after the crossing program. Random slots stop after the crossing
  // slot's whole group, because collecting the group advanced its iterators.
  // Also stops `startTomorrow` from moving the start, because the caller
  // picks each cycle's start.
  endTime?: Dayjs;
};
