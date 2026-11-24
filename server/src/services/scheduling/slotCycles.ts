import type { RandomSlotSchedule, TimeSlotSchedule } from '@tunarr/types/api';
import { sumBy } from 'lodash-es';
import type {
  CycleSnapshot,
  LineupCycle,
  LineupItem,
} from '../../db/derived_types/Lineup.ts';
import dayjs from '../../util/dayjs.ts';
import { isNonEmptyArray } from '../../util/index.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';
import type { SlotCheckpoint } from './slotCheckpoints.ts';
import { stateAtCheckpoint } from './slotCheckpoints.ts';

export type { CycleSnapshot, LineupCycle };

const logger = LoggerFactory.child({ className: 'slotCycles' });

/**
 * Hard cap on the cycles one pass builds.
 *
 * Each cycle is a worker scheduling pass run under the channel's lineup lock,
 * so an unbounded loop would hold the lock for minutes. A 4 hour guide horizon
 * needs one or two cycles; the cap only bites when a start time sits far
 * behind the horizon, and the next pass picks up where this one stopped.
 */
export const MaxCyclesPerPass = 24;

export type BuiltCycle = {
  items: LineupItem[];
  durationMs: number;
  endSnapshot: CycleSnapshot;
  checkpoints?: SlotCheckpoint[];
};

// Builds one cycle starting at `startTime`. An undefined snapshot means a
// fresh start: RNG at position 0 and no carried iterator state.
export type BuildCycleFn = (
  startTime: number,
  snapshot: CycleSnapshot | undefined,
) => Promise<BuiltCycle>;

export type CycleState = {
  // channel.startTime, where cycles[0] begins.
  startTime: number;
  // Every cycle's items, concatenated in cycle order.
  items: LineupItem[];
  cycles: LineupCycle[];
  // End snapshot of the last cycle, which the next build starts from.
  nextSnapshot: CycleSnapshot | undefined;
};

export type CycleOptions = {
  now: number;
  horizonMs: number;
  build: BuildCycleFn;
};

// The state a fresh build starts from. Equivalent to passing no snapshot at
// all: the schedulers treat an empty iterator record as "start over".
const freshSnapshot = (): CycleSnapshot => ({
  discardCount: 0,
  iteratorState: { iterators: {} },
});

const contentEnd = (state: CycleState) =>
  state.startTime + sumBy(state.cycles, (cycle) => cycle.durationMs);

// Longest chunk a build produces, whatever the guide horizon. A purged
// program in the airing chunk stays flex until the chunk ends.
export const MaxChunkMs = 24 * 60 * 60 * 1000;

/**
 * How much schedule one build covers: the guide horizon, capped at a day.
 *
 * The cap is never longer than a time-slot period or a random schedule's
 * `maxDays`, so a chunk never needs a second limit.
 */
export function chunkLengthMs(horizonMs: number): number {
  return Math.min(horizonMs, MaxChunkMs);
}

/**
 * Where a channel's first (or catch-up) cycle starts.
 *
 * Time slots start at the beginning of the current day, so a viewer joins the
 * slot airing now partway through, as if the schedule had been running. The
 * scheduler finds each slot from its offset into the period, so the start
 * does not need to be a period start, and the build up to `now` stays short.
 * Random slots have no clock to line up with, so they start at `now` floored
 * to the minute.
 *
 * Uses the server's local timezone, the one the schedulers lay slots out in.
 */
export function cycleStartTime(
  schedule: TimeSlotSchedule | RandomSlotSchedule,
  now: number,
): number {
  return schedule.type === 'time'
    ? +dayjs(now).startOf('day')
    : +dayjs(now).startOf('minute');
}

// Builds cycles from `startTime` until the content reaches past the horizon.
// A cycle with no duration would never advance the clock, so it is dropped and
// building stops rather than looping forever.
async function buildFrom(
  startTime: number,
  firstSnapshot: CycleSnapshot | undefined,
  opts: CycleOptions,
): Promise<CycleState> {
  const state: CycleState = {
    startTime,
    items: [],
    cycles: [],
    nextSnapshot: firstSnapshot,
  };
  const limit = opts.now + opts.horizonMs;

  while (contentEnd(state) <= limit) {
    if (state.cycles.length >= MaxCyclesPerPass) {
      logger.warn(
        'Stopped building slot cycles at the %d cycle cap, %d ms short of the guide horizon. The next pass continues from here.',
        MaxCyclesPerPass,
        limit - contentEnd(state),
      );
      break;
    }

    const startSnapshot = state.nextSnapshot;
    const built = await opts.build(contentEnd(state), startSnapshot);
    if (built.durationMs <= 0) {
      break;
    }

    state.items = [...state.items, ...built.items];
    state.cycles = [
      ...state.cycles,
      {
        itemCount: built.items.length,
        durationMs: built.durationMs,
        snapshot: startSnapshot ?? freshSnapshot(),
        ...(isNonEmptyArray(built.checkpoints)
          ? { checkpoints: built.checkpoints }
          : {}),
      },
    ];
    state.nextSnapshot = built.endSnapshot;
  }

  return state;
}

/**
 * Fresh cycles starting at `start`, built ahead past the horizon.
 */
export function initializeCycles(
  start: number,
  opts: CycleOptions,
): Promise<CycleState> {
  return buildFrom(start, undefined, opts);
}

/**
 * Moves a channel to `now`: catch up, trim what has aired, build ahead.
 *
 * Catch-up applies when every built cycle has already aired. It restarts the
 * channel at `catchUpStart` from the last end snapshot, so the schedule
 * continues where it left off without simulating the cycles that were missed.
 * Otherwise the aired cycles are dropped and their duration is added to
 * `startTime`, which leaves the airing program and its offset unchanged.
 */
export async function advanceCycles(
  state: CycleState,
  catchUpStart: number,
  opts: CycleOptions,
): Promise<{ state: CycleState; changed: boolean }> {
  if (state.cycles.length === 0 || contentEnd(state) <= opts.now) {
    const caughtUp = await buildFrom(catchUpStart, state.nextSnapshot, opts);
    // A build that produced nothing would wipe the lineup, so keep the old
    // content and try again on the next pass.
    return caughtUp.cycles.length === 0
      ? { state, changed: false }
      : { state: caughtUp, changed: true };
  }

  // Catch-up above guarantees at least one cycle ends after `now`, so this
  // never empties the lineup.
  const trimmed = trimAiredCycles(state, opts.now);
  const changed = trimmed.cycles.length !== state.cycles.length;

  // buildFrom's own content end starts at the trimmed content end, so its
  // horizon check covers the whole lineup, not just the part it appends.
  const ahead = await buildFrom(
    contentEnd(trimmed),
    trimmed.nextSnapshot,
    opts,
  );

  if (ahead.cycles.length === 0) {
    return { state: trimmed, changed };
  }

  return {
    state: {
      startTime: trimmed.startTime,
      items: [...trimmed.items, ...ahead.items],
      cycles: [...trimmed.cycles, ...ahead.cycles],
      nextSnapshot: ahead.nextSnapshot,
    },
    changed: true,
  };
}

/**
 * Drops the cycles that finished before `now` and moves `startTime` past
 * them, which leaves the airing program and its offset unchanged.
 *
 * A state whose cycles have all aired comes back empty, so the caller starts
 * the channel over rather than rebuilding everything it missed.
 */
export function trimAiredCycles(state: CycleState, now: number): CycleState {
  let startTime = state.startTime;
  let cycles = state.cycles;
  let droppedItems = 0;

  while (cycles.length > 0) {
    const oldest = cycles[0];
    if (oldest === undefined || startTime + oldest.durationMs > now) {
      break;
    }
    startTime += oldest.durationMs;
    droppedItems += oldest.itemCount;
    cycles = cycles.slice(1);
  }

  return {
    startTime,
    items: droppedItems > 0 ? state.items.slice(droppedItems) : state.items,
    cycles,
    nextSnapshot: state.nextSnapshot,
  };
}

// A point where the schedule can restart, and the state to restart from.
export type RestartPoint = {
  timeMs: number;
  // Cycles before this one stay whole. Equal to the cycle count for the end
  // of the built content.
  cycleIndex: number;
  // How far into that cycle the point falls.
  offsetMs: number;
  snapshot: CycleSnapshot;
};

/**
 * The first restart point at or after the end of the item airing at `now`.
 *
 * Restart points are cycle starts, the checkpoints inside each cycle, and the
 * end of the built content. A change that restarts the schedule here leaves
 * the program on air alone. Undefined when nothing is airing, so the caller
 * catches up instead.
 */
export function firstRestartAfterAiring(
  state: CycleState,
  now: number,
): RestartPoint | undefined {
  if (state.cycles.length === 0 || contentEnd(state) <= now) {
    return;
  }

  let airingEnd = state.startTime;
  for (const item of state.items) {
    airingEnd += item.durationMs;
    if (airingEnd > now) {
      break;
    }
  }

  let cycleStart = state.startTime;
  for (const [cycleIndex, cycle] of state.cycles.entries()) {
    if (cycleStart >= airingEnd) {
      return {
        timeMs: cycleStart,
        cycleIndex,
        offsetMs: 0,
        snapshot: cycle.snapshot,
      };
    }

    const checkpoints = cycle.checkpoints ?? [];
    const index = checkpoints.findIndex(
      (checkpoint) => cycleStart + checkpoint.offsetMs >= airingEnd,
    );
    const checkpoint = checkpoints[index];
    if (checkpoint) {
      return {
        timeMs: cycleStart + checkpoint.offsetMs,
        cycleIndex,
        offsetMs: checkpoint.offsetMs,
        snapshot: {
          discardCount: checkpoint.discardCount,
          iteratorState: stateAtCheckpoint(
            cycle.snapshot.iteratorState,
            checkpoints,
            index,
          ),
        },
      };
    }

    cycleStart += cycle.durationMs;
  }

  if (!state.nextSnapshot) {
    return;
  }
  return {
    timeMs: cycleStart,
    cycleIndex: state.cycles.length,
    offsetMs: 0,
    snapshot: state.nextSnapshot,
  };
}

// The items that air before `offsetMs`. Checkpoints sit between programs, so
// the only item that can cross one is flex that a later pass extended.
function itemsBefore(
  items: readonly LineupItem[],
  offsetMs: number,
): LineupItem[] {
  const kept: LineupItem[] = [];
  let cursorMs = 0;
  for (const item of items) {
    if (cursorMs >= offsetMs) {
      break;
    }
    const endMs = cursorMs + item.durationMs;
    if (endMs <= offsetMs) {
      kept.push(item);
    } else if (item.type === 'offline') {
      kept.push({ ...item, durationMs: offsetMs - cursorMs });
    } else {
      throw new Error(
        `A ${item.type} lineup item crosses a schedule checkpoint at ${offsetMs} ms`,
      );
    }
    cursorMs = endMs;
  }
  return kept;
}

/**
 * Keeps everything before `point` and drops the rest. The next build starts
 * from `point`'s snapshot.
 */
export function truncateAt(state: CycleState, point: RestartPoint): CycleState {
  const cycles = state.cycles.slice(0, point.cycleIndex);
  const keptItemCount = sumBy(cycles, (cycle) => cycle.itemCount);
  const items = state.items.slice(0, keptItemCount);

  const partial = state.cycles[point.cycleIndex];
  if (partial && point.offsetMs > 0) {
    const partialItems = itemsBefore(
      state.items.slice(keptItemCount, keptItemCount + partial.itemCount),
      point.offsetMs,
    );
    const checkpoints = (partial.checkpoints ?? []).filter(
      (checkpoint) => checkpoint.offsetMs < point.offsetMs,
    );
    items.push(...partialItems);
    cycles.push({
      itemCount: partialItems.length,
      durationMs: point.offsetMs,
      snapshot: partial.snapshot,
      ...(isNonEmptyArray(checkpoints) ? { checkpoints } : {}),
    });
  }

  return {
    startTime: state.startTime,
    items,
    cycles,
    nextSnapshot: point.snapshot,
  };
}

/**
 * Rebuilds everything after the program on air, from the exact state the
 * schedule had at the first restart point after it. The program on air and
 * everything before it stay, and so does `startTime`.
 *
 * `carry` adjusts the restart state, which a schedule edit uses to move each
 * slot's place onto the edited slots. Undefined when nothing is airing.
 *
 * The cycles kept before the restart point hold state for the schedule that
 * built them. Nothing reads it again, because every later restart point lies
 * after a later airing program, past the cycles kept here.
 */
export async function rebuildAfterAiring(
  state: CycleState,
  opts: CycleOptions,
  carry: (snapshot: CycleSnapshot) => CycleSnapshot = (snapshot) => snapshot,
): Promise<CycleState | undefined> {
  const point = firstRestartAfterAiring(state, opts.now);
  if (!point) {
    return;
  }

  const snapshot = carry(point.snapshot);
  const kept = truncateAt(state, { ...point, snapshot });
  const built = await buildFrom(point.timeMs, snapshot, opts);
  if (built.cycles.length === 0) {
    return kept;
  }

  return {
    startTime: kept.startTime,
    items: [...kept.items, ...built.items],
    cycles: [...kept.cycles, ...built.cycles],
    nextSnapshot: built.nextSnapshot,
  };
}
