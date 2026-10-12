import type {
  MidRollConfig,
  RandomSlotSchedule,
  SlotFiller,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';
import { scheduleTimeSlots } from './TimeSlotService.ts';

const oneMin = 60 * 1000;
const midnight = dayjs('2024-01-01T00:00:00.000Z');

const customShowId = randomUUID();
const fillerListId = randomUUID();

// A playlist of movies, the way users schedule movies with mid-roll breaks.
const movies: SlotSchedulerProgram[] = Array.from({ length: 3 }, (_, i) => ({
  ...createFakeProgramOrm({
    uuid: `movie-${i}`,
    title: `Movie ${i}`,
    type: 'movie',
    duration: 25 * oneMin,
  }),
  parentFillerLists: [],
  parentCustomShows: [{ customShowId, index: i }],
  parentSmartCollections: [],
}));

const commercials: SlotSchedulerProgram[] = Array.from(
  { length: 20 },
  (_, i) => ({
    ...createFakeProgramOrm({
      uuid: `ad-${i}`,
      title: `Ad ${i}`,
      type: 'other_video',
      duration: 30 * 1000,
    }),
    parentFillerLists: [fillerListId],
    parentCustomShows: [],
    parentSmartCollections: [],
  }),
);

const filler: SlotFiller[] = [
  { types: ['mid'], fillerListId, fillerOrder: 'uniform' },
];

// One break 10 minutes in and one 20 minutes in.
const midRoll: MidRollConfig = {
  strategy: 'eager',
  breakRule: { type: 'fixed_interval', intervalMs: 10 * oneMin },
  breakDurationMs: oneMin,
  maxBreaks: 0,
  minProgramDurationMs: 0,
  tailBufferMs: 0,
};

type Item = {
  type: string;
  id?: string;
  duration: number;
  startOffsetMs?: number;
  fillerType?: string;
};

// The first airing of the first movie, from its first segment through its
// last. The playlist repeats over the day, so stop at the next program.
function firstMovieRun(lineup: Item[]) {
  const start = lineup.findIndex((p) => p.id === 'movie-0');
  let end = start;
  for (let i = start + 1; i < lineup.length; i++) {
    const item = lineup[i];
    if (item === undefined || item.type === 'custom') {
      if (item?.id !== 'movie-0') {
        break;
      }
    }
    if (item?.id === 'movie-0') {
      end = i;
    }
  }
  return lineup.slice(start, end + 1);
}

function expectSplitAtBreaks(lineup: Item[]) {
  const run = firstMovieRun(lineup);
  const segments = run.filter((p) => p.id === 'movie-0');

  expect(segments.map((p) => p.type)).toEqual(['custom', 'custom', 'custom']);
  // Each segment must say where in the movie it resumes, or every segment
  // after the first replays the movie from the start.
  expect(segments.map((p) => p.startOffsetMs ?? 0)).toEqual([
    0,
    10 * oneMin,
    20 * oneMin,
  ]);
  expect(segments.map((p) => p.duration)).toEqual([
    10 * oneMin,
    10 * oneMin,
    5 * oneMin,
  ]);
  expect(
    run.filter((p) => p.type === 'filler' && p.fillerType === 'mid').length,
  ).toBeGreaterThan(0);
}

describe('mid-roll breaks in custom show slots', () => {
  test('time slots split custom show programs at their breaks', async () => {
    const schedule: TimeSlotSchedule = {
      type: 'time',
      period: 'day',
      maxDays: 1,
      flexPreference: 'end',
      padMs: 30 * oneMin,
      latenessMs: 0,
      overflow: { type: 'duration', maxMs: 0 },
      timeZoneOffset: 0,
      slots: [
        {
          id: randomUUID(),
          startTime: 0,
          type: 'custom-show',
          customShowId,
          order: 'next',
          direction: 'asc',
          filler,
          midRoll,
        },
      ],
    };

    const result = await scheduleTimeSlots(
      schedule,
      [...movies, ...commercials],
      [42, 99],
      undefined,
      midnight,
    );

    expectSplitAtBreaks(result.lineup as Item[]);
  });

  test('random slots split custom show programs at their breaks', () => {
    const schedule: RandomSlotSchedule = {
      type: 'random',
      flexPreference: 'end',
      maxDays: 1,
      padMs: 1,
      padStyle: 'episode',
      randomDistribution: 'uniform',
      lockWeights: false,
      slots: [
        {
          weight: 100,
          cooldownMs: 0,
          durationSpec: { type: 'dynamic', programCount: 1 },
          type: 'custom-show',
          customShowId,
          order: 'next',
          direction: 'asc',
          filler,
          midRoll,
        },
      ],
    };

    const result = new RandomSlotScheduler(schedule).generateSchedule(
      [...movies, ...commercials],
      [42, 99],
      0,
      midnight,
    );

    expectSplitAtBreaks(result.lineup as Item[]);
  });
});
