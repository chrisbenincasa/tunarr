import dayjs from 'dayjs';
import { RandomSlotScheduler } from './RandomSlotsService.ts';

describe('randomSlotsService', () => {
  test('basic', async () => {
    new RandomSlotScheduler({
      type: 'random',
      flexPreference: 'distribute',
      maxDays: 365,
      padMs: 30 * 60 * 1000,
      padStyle: 'slot',
      randomDistribution: 'uniform',
      lockWeights: false,
      slots: [
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ minutes: 30 }),
          },
          type: 'show',
          showId: 'test.1',
          order: 'next',
          direction: 'asc',
        },
        {
          weight: 25.0,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ hours: 3 }),
          },
          type: 'movie',
          order: 'next',
          direction: 'asc',
        },
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ minutes: 30 }),
          },
          type: 'show',
          showId: 'test.2',
          order: 'next',
          direction: 'asc',
        },
      ],
    });
  });
});
