import { isEmpty, isEqual } from 'lodash-es';
import { z } from 'zod/v4';
import type {
  ProgramIteratorSnapshot,
  SlotIteratorState,
} from './slotIteratorState.ts';
import { PeriodPlaysSchema } from './slotIteratorState.ts';

// How one iterator changed since the previous checkpoint. A shuffle stores
// only the programs it played since then. `restart` means a pass ended in
// between, so the earlier played IDs no longer count.
export const IteratorChangeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ordered'),
    lastProgramId: z.string(),
  }),
  z.object({
    type: z.literal('shuffle'),
    added: z.string().array(),
    restart: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('cleared'),
  }),
]);

export type IteratorChange = z.infer<typeof IteratorChangeSchema>;

// A point inside a built cycle where the scheduler can start again from
// exactly the state it had there. `offsetMs` counts from the cycle start.
//
// Each checkpoint stores only what changed since the one before it, or since
// the cycle's start snapshot for the first one. The other fields are small,
// so they are stored whole whenever they change. An empty record means the
// field became empty.
export const SlotCheckpointSchema = z.object({
  offsetMs: z.number().nonnegative(),
  discardCount: z.number().nonnegative(),
  iterators: z.record(z.string(), IteratorChangeSchema).optional(),
  rerunPlays: z.record(z.string(), z.number().int().positive()).optional(),
  periodPlays: z.record(z.string(), PeriodPlaysSchema).optional(),
  nextSlotIndex: z.number().int().nonnegative().optional(),
  slotLastPlayedMs: z.record(z.string(), z.number()).optional(),
});

export type SlotCheckpoint = z.infer<typeof SlotCheckpointSchema>;

const emptyState = (): SlotIteratorState => ({ iterators: {} });

function iteratorChange(
  previous: ProgramIteratorSnapshot | undefined,
  next: ProgramIteratorSnapshot | undefined,
): IteratorChange | undefined {
  if (!next) {
    return previous ? { type: 'cleared' } : undefined;
  }

  switch (next.type) {
    case 'ordered':
      return previous?.type === 'ordered' &&
        previous.lastProgramId === next.lastProgramId
        ? undefined
        : next;
    case 'shuffle': {
      if (previous?.type !== 'shuffle') {
        return { type: 'shuffle', added: [...next.playedIds], restart: true };
      }

      const nextIds = new Set(next.playedIds);
      if (previous.playedIds.some((id) => !nextIds.has(id))) {
        return { type: 'shuffle', added: [...next.playedIds], restart: true };
      }

      const previousIds = new Set(previous.playedIds);
      const added = next.playedIds.filter((id) => !previousIds.has(id));
      return added.length > 0 ? { type: 'shuffle', added } : undefined;
    }
  }
}

/**
 * Records where a scheduler can restart, storing each checkpoint as the
 * change from the one before it.
 *
 * `start` is the state the build was handed, which is what a reader replays
 * the changes onto.
 */
export class SlotCheckpointRecorder {
  #previous: SlotIteratorState;
  #lastOffsetMs = 0;
  readonly checkpoints: SlotCheckpoint[] = [];

  constructor(start: SlotIteratorState | undefined) {
    this.#previous = start ?? emptyState();
  }

  // The build start is not recorded, because the cycle's start snapshot
  // already describes it. A scheduler can pass the same time more than once,
  // as random slots do when a picked slot yields nothing, and only the first
  // pass at a time is a clean restart point.
  record(offsetMs: number, discardCount: number, state: SlotIteratorState) {
    if (offsetMs <= this.#lastOffsetMs) {
      return;
    }
    this.#lastOffsetMs = offsetMs;

    const previous = this.#previous;
    const checkpoint: SlotCheckpoint = { offsetMs, discardCount };

    const iterators: Record<string, IteratorChange> = {};
    const keys = new Set([
      ...Object.keys(previous.iterators),
      ...Object.keys(state.iterators),
    ]);
    for (const key of keys) {
      const change = iteratorChange(
        previous.iterators[key],
        state.iterators[key],
      );
      if (change) {
        iterators[key] = change;
      }
    }
    if (!isEmpty(iterators)) {
      checkpoint.iterators = iterators;
    }

    if (!isEqual(previous.rerunPlays ?? {}, state.rerunPlays ?? {})) {
      checkpoint.rerunPlays = { ...state.rerunPlays };
    }
    if (!isEqual(previous.periodPlays ?? {}, state.periodPlays ?? {})) {
      checkpoint.periodPlays = structuredClone(state.periodPlays ?? {});
    }
    if (
      state.nextSlotIndex !== undefined &&
      state.nextSlotIndex !== previous.nextSlotIndex
    ) {
      checkpoint.nextSlotIndex = state.nextSlotIndex;
    }
    if (
      !isEqual(previous.slotLastPlayedMs ?? {}, state.slotLastPlayedMs ?? {})
    ) {
      checkpoint.slotLastPlayedMs = { ...state.slotLastPlayedMs };
    }

    this.checkpoints.push(checkpoint);
    this.#previous = cloneState(state);
  }
}

function cloneState(state: SlotIteratorState): SlotIteratorState {
  const iterators: SlotIteratorState['iterators'] = {};
  for (const [key, snapshot] of Object.entries(state.iterators)) {
    iterators[key] =
      snapshot.type === 'shuffle'
        ? { type: 'shuffle', playedIds: [...snapshot.playedIds] }
        : { ...snapshot };
  }
  return {
    ...state,
    iterators,
    rerunPlays: state.rerunPlays ? { ...state.rerunPlays } : undefined,
    periodPlays: state.periodPlays
      ? structuredClone(state.periodPlays)
      : undefined,
    slotLastPlayedMs: state.slotLastPlayedMs
      ? { ...state.slotLastPlayedMs }
      : undefined,
  };
}

/**
 * Applies one checkpoint's changes to the state before it.
 */
export function applyCheckpoint(
  state: SlotIteratorState,
  checkpoint: SlotCheckpoint,
): SlotIteratorState {
  const iterators = { ...state.iterators };
  for (const [key, change] of Object.entries(checkpoint.iterators ?? {})) {
    switch (change.type) {
      case 'cleared':
        delete iterators[key];
        break;
      case 'ordered':
        iterators[key] = change;
        break;
      case 'shuffle': {
        const current = iterators[key];
        const kept =
          !change.restart && current?.type === 'shuffle'
            ? current.playedIds
            : [];
        iterators[key] = {
          type: 'shuffle',
          playedIds: [...kept, ...change.added],
        };
        break;
      }
    }
  }

  const next: SlotIteratorState = { iterators };

  const rerunPlays = checkpoint.rerunPlays ?? state.rerunPlays;
  if (rerunPlays && !isEmpty(rerunPlays)) {
    next.rerunPlays = rerunPlays;
  }

  const periodPlays = checkpoint.periodPlays ?? state.periodPlays;
  if (periodPlays && !isEmpty(periodPlays)) {
    next.periodPlays = periodPlays;
  }

  const nextSlotIndex = checkpoint.nextSlotIndex ?? state.nextSlotIndex;
  if (nextSlotIndex !== undefined) {
    next.nextSlotIndex = nextSlotIndex;
  }

  const slotLastPlayedMs =
    checkpoint.slotLastPlayedMs ?? state.slotLastPlayedMs;
  if (slotLastPlayedMs) {
    next.slotLastPlayedMs = slotLastPlayedMs;
  }

  return next;
}

/**
 * The full scheduler state at `checkpoints[index]`, replayed from the state
 * the checkpoints were recorded against.
 */
export function stateAtCheckpoint(
  start: SlotIteratorState,
  checkpoints: readonly SlotCheckpoint[],
  index: number,
): SlotIteratorState {
  let state = start;
  for (let i = 0; i <= index; i++) {
    const checkpoint = checkpoints[i];
    if (!checkpoint) {
      throw new Error(
        `Checkpoint ${index} is out of range (${checkpoints.length} recorded)`,
      );
    }
    state = applyCheckpoint(state, checkpoint);
  }
  return state;
}
