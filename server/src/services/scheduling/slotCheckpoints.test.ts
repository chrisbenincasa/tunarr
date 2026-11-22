import dayjs from '@/util/dayjs.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { TimeSlot } from '@tunarr/types/api';
import {
  FixtureIds,
  fixturePrograms,
  fixtureRandomSlotSchedule,
  fixtureSlotId,
  fixtureTimeSlotSchedule,
} from '../../testing/fakes/slotScheduleFixtures.ts';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import type { SlotCheckpoint } from './slotCheckpoints.ts';
import {
  applyCheckpoint,
  SlotCheckpointRecorder,
  stateAtCheckpoint,
} from './slotCheckpoints.ts';
import type { SlotIteratorState } from './slotIteratorState.ts';
import { scheduleTimeSlots } from './TimeSlotService.ts';

let originalTz: string | undefined;

beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = 'UTC';
});

afterAll(() => {
  if (originalTz === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTz;
  }
});

const oneHour = 60 * 60 * 1000;
const start = dayjs.utc('2024-03-04T00:00:00.000Z');

// Shuffle IDs are a set; the order they were stored in carries no meaning.
function normalize(state: SlotIteratorState) {
  const iterators = Object.fromEntries(
    Object.entries(state.iterators).map(([key, snapshot]) => [
      key,
      snapshot.type === 'shuffle'
        ? { type: 'shuffle', playedIds: [...snapshot.playedIds].sort() }
        : snapshot,
    ]),
  );
  return { ...state, iterators };
}

describe('SlotCheckpointRecorder', () => {
  test('stores only what changed, and replays back to each state', () => {
    const start: SlotIteratorState = {
      iterators: {
        'slot:0': { type: 'ordered', lastProgramId: 'a' },
        'slot:1': { type: 'shuffle', playedIds: ['x'] },
        'slot:2': { type: 'shuffle', playedIds: ['p', 'q'] },
      },
      rerunPlays: { 'group:g': 1 },
    };

    const states: SlotIteratorState[] = [
      {
        iterators: {
          'slot:0': { type: 'ordered', lastProgramId: 'b' },
          'slot:1': { type: 'shuffle', playedIds: ['x', 'y'] },
          'slot:2': { type: 'shuffle', playedIds: ['p', 'q'] },
        },
        rerunPlays: { 'group:g': 1 },
      },
      {
        // slot:1 finished its pass and started a new one; slot:2 emptied.
        iterators: {
          'slot:0': { type: 'ordered', lastProgramId: 'b' },
          'slot:1': { type: 'shuffle', playedIds: ['z'] },
        },
      },
    ];

    const recorder = new SlotCheckpointRecorder(start);
    recorder.record(oneHour, 3, states[0]!);
    recorder.record(2 * oneHour, 7, states[1]!);

    const [first, second] = recorder.checkpoints;
    expect(first).toEqual<SlotCheckpoint>({
      offsetMs: oneHour,
      discardCount: 3,
      iterators: {
        'slot:0': { type: 'ordered', lastProgramId: 'b' },
        'slot:1': { type: 'shuffle', added: ['y'] },
      },
    });
    expect(second).toEqual<SlotCheckpoint>({
      offsetMs: 2 * oneHour,
      discardCount: 7,
      iterators: {
        'slot:1': { type: 'shuffle', added: ['z'], restart: true },
        'slot:2': { type: 'cleared' },
      },
      rerunPlays: {},
    });

    expect(stateAtCheckpoint(start, recorder.checkpoints, 0)).toEqual(
      states[0],
    );
    expect(stateAtCheckpoint(start, recorder.checkpoints, 1)).toEqual(
      states[1],
    );
  });

  test('skips the build start and repeated passes at the same time', () => {
    const recorder = new SlotCheckpointRecorder(undefined);
    recorder.record(0, 0, { iterators: {} });
    recorder.record(oneHour, 1, { iterators: {} });
    recorder.record(oneHour, 2, { iterators: {} });

    expect(recorder.checkpoints.map((c) => c.discardCount)).toEqual([1]);
  });

  test('keeps random-slot fields across checkpoints that leave them alone', () => {
    const state = applyCheckpoint(
      { iterators: {}, nextSlotIndex: 2, slotLastPlayedMs: { '0': 5 } },
      { offsetMs: oneHour, discardCount: 1 },
    );
    expect(state).toEqual({
      iterators: {},
      nextSlotIndex: 2,
      slotLastPlayedMs: { '0': 5 },
    });
  });
});

// A checkpoint is only useful if the scheduler really had that state there.
// A build that stops at a checkpoint's time ends on the same loop pass, so its
// end state is the ground truth to compare against.
describe('scheduler checkpoints', () => {
  test('time slots: each checkpoint matches the state at that point', async () => {
    const schedule = fixtureTimeSlotSchedule();
    const programs = fixturePrograms();
    const endTime = start.add(2, 'day');

    const full = await scheduleTimeSlots(schedule, programs, [7], 0, start, {
      endTime,
      checkpoints: true,
    });
    const checkpoints = full.checkpoints ?? [];
    expect(checkpoints.length).toBeGreaterThan(4);

    for (const [index, checkpoint] of checkpoints.entries()) {
      const stopped = await scheduleTimeSlots(
        schedule,
        programs,
        [7],
        0,
        start,
        { endTime: start.add(checkpoint.offsetMs, 'ms') },
      );
      expect(checkpoint.discardCount).toBe(stopped.discardCount);
      expect(
        normalize(stateAtCheckpoint({ iterators: {} }, checkpoints, index)),
      ).toEqual(normalize(stopped.iteratorState));
    }
  });

  test('random slots: each checkpoint matches the state at that point', () => {
    const schedule = fixtureRandomSlotSchedule();
    const programs = fixturePrograms();
    const endTime = start.add(1, 'day');

    const full = new RandomSlotScheduler(schedule).generateSchedule(
      programs,
      [7],
      0,
      start,
      { endTime, checkpoints: true },
    );
    const checkpoints = full.checkpoints ?? [];
    expect(checkpoints.length).toBeGreaterThan(4);

    for (const [index, checkpoint] of checkpoints.entries()) {
      const stopped = new RandomSlotScheduler(schedule).generateSchedule(
        programs,
        [7],
        0,
        start,
        { endTime: start.add(checkpoint.offsetMs, 'ms') },
      );
      expect(checkpoint.discardCount).toBe(stopped.discardCount);
      expect(
        normalize(stateAtCheckpoint({ iterators: {} }, checkpoints, index)),
      ).toEqual(normalize(stopped.iteratorState));
    }
  });

  test('builds that do not ask for checkpoints return none', async () => {
    const result = await scheduleTimeSlots(
      fixtureTimeSlotSchedule(),
      fixturePrograms(),
      [7],
      0,
      start,
      { endTime: start.add(1, 'day') },
    );
    expect(result.checkpoints).toBeUndefined();
  });
});

// A mixed link group's rerun slot replays what its continue slot played
// earlier in the period. A build that resumes between them must replay the
// same programs, and one that resumes at midnight must not replay yesterday's.
describe('resuming a mixed link group', () => {
  const show = (
    n: number,
    hour: number,
    linkMode: 'continue' | 'rerun',
  ): TimeSlot => ({
    id: fixtureSlotId(n),
    startTime: hour * oneHour,
    type: 'show',
    showId: FixtureIds.showB,
    order: 'next',
    direction: 'asc',
    seasonFilter: [],
    seasonExcludeFilter: [],
    iterationGroup: FixtureIds.mixedGroup,
    linkMode,
  });
  const custom = (n: number, hour: number): TimeSlot => ({
    id: fixtureSlotId(n),
    startTime: hour * oneHour,
    type: 'custom-show',
    customShowId: FixtureIds.customShow,
    order: 'next',
    direction: 'asc',
  });

  // The rerun slot has room for one of the two episodes the continue slot
  // plays, so a recording is left over at the end of each day.
  const schedule = fixtureTimeSlotSchedule({
    slots: [
      custom(1, 0),
      show(2, 16, 'continue'),
      show(3, 18, 'rerun'),
      custom(4, 19),
    ],
  });

  async function build(
    from: dayjs.Dayjs,
    to: dayjs.Dayjs,
    resume?: Awaited<ReturnType<typeof scheduleTimeSlots>>,
  ) {
    return scheduleTimeSlots(
      schedule,
      fixturePrograms(),
      [7],
      resume?.discardCount ?? 0,
      from,
      { endTime: to, iteratorState: resume?.iteratorState },
    );
  }

  const ids = (result: Awaited<ReturnType<typeof scheduleTimeSlots>>) =>
    result.lineup.map((item) =>
      item.type === 'content' ? item.id : item.type,
    );

  test.each([
    // The 16:00 slot runs to 18:00, right before the rerun slot.
    ['between the continue and rerun slots', 17],
    ['at midnight', 24],
  ])(
    'a build resumed %s airs what one long build would',
    async (_name, hour) => {
      const end = start.add(2, 'day');
      const whole = await build(start, end);

      // A build runs to the end of the slot its end time falls in, so the
      // next one starts there.
      const first = await build(start, start.add(hour, 'hour'));
      const resumeAt = start.add(sumDuration(first), 'ms');
      const second = await build(resumeAt, end, first);

      expect([...ids(first), ...ids(second)]).toEqual(ids(whole));
      if (hour === 17) {
        expect(first.iteratorState.periodPlays).toBeDefined();
      }
    },
  );
});

function sumDuration(result: Awaited<ReturnType<typeof scheduleTimeSlots>>) {
  return result.lineup.reduce((total, item) => total + item.duration, 0);
}
