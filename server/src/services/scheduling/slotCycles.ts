import type { RandomSlotSchedule, TimeSlotSchedule } from '@tunarr/types/api';
import { sumBy } from 'lodash-es';
import type {
  CycleSnapshot,
  LineupCycle,
  LineupItem,
} from '../../db/derived_types/Lineup.ts';
import dayjs from '../../util/dayjs.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';

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

/**
 * Exclusive end of a cycle that starts at `startTime`.
 *
 * Time slots run one `schedule.period`, so `maxDays` is ignored. Random slots
 * run `maxDays` days. The scheduler stops at the first program that crosses
 * this time, so the cycle's real end is at or past it.
 *
 * The arithmetic uses the server's local timezone, which is the timezone the
 * schedulers lay slots out in -- they derive the period start from the `Dayjs`
 * they are handed, and the worker builds it with `dayjs(startTime)`. The
 * schedule's own `timeZoneOffset` is recorded by the editor but never read.
 */
export function cycleEndTime(
  schedule: TimeSlotSchedule | RandomSlotSchedule,
  startTime: number,
): number {
  return schedule.type === 'time'
    ? +dayjs(startTime).add(1, schedule.period)
    : +dayjs(startTime).add(schedule.maxDays, 'day');
}

/**
 * Where a channel's first (or catch-up) cycle starts.
 *
 * Time slots start at the beginning of the period containing `now`, so slot
 * offsets line up with the clock. Random slots have no period, so they start
 * at `now` floored to the minute.
 *
 * See {@link cycleEndTime} on the timezone used.
 */
export function cycleStartTime(
  schedule: TimeSlotSchedule | RandomSlotSchedule,
  now: number,
): number {
  return schedule.type === 'time'
    ? +dayjs(now).startOf(schedule.period)
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

/**
 * Rebuilds every cycle after the library changed.
 *
 * The airing cycle is rebuilt from the snapshot it originally started from, so
 * the channel keeps its start time and its place in the schedule, and each
 * later cycle is rebuilt from the new end state before it.
 */
export function cascadeCycles(
  state: CycleState,
  opts: CycleOptions,
): Promise<CycleState> {
  const firstSnapshot = state.cycles[0]?.snapshot ?? state.nextSnapshot;
  return buildFrom(state.startTime, firstSnapshot, opts);
}
