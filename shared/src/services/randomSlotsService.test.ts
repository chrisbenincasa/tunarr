import { ChannelProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { map, random, range } from 'lodash-es';
import { RandomSlotScheduler } from './RandomSlotsService.js';

function formatProgram(program: ChannelProgram) {
  switch (program.type) {
    case 'content':
      return `${program.showId ?? program.type}.${program.uniqueId}`;
    case 'custom':
      return `${program.customShowId}.${program.id}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
}

describe('randomSlotsService', () => {
  test('basic', async () => {
    const result = new RandomSlotScheduler({
      type: 'random',
      flexPreference: 'distribute',
      maxDays: 365,
      padMs: 30 * 60 * 1000,
      padStyle: 'slot',
      randomDistribution: 'uniform',
      slots: [
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationMs: +dayjs.duration({ minutes: 30 }),
          programming: {
            type: 'show',
            showId: 'test.1',
          },
        },
        {
          weight: 25.0,
          cooldownMs: 0.0,
          durationMs: +dayjs.duration({ hours: 3 }),
          programming: {
            type: 'movie',
          },
        },
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationMs: +dayjs.duration({ minutes: 30 }),
          programming: {
            type: 'show',
            showId: 'test.2',
          },
        },
      ],
    }).generateSchedule([
      ...map(range(0, 5), (i) => ({
        type: 'content' as const,
        duration: +dayjs.duration({
          hours: random(1, 3, false),
          minutes: random(0, 60),
        }),
        externalIds: [],
        persisted: true,
        subtype: 'movie' as const,
        title: `Movie${i}`,
        uniqueId: `Movie${i}`,
        // showId: 'test.1',
      })),
      {
        type: 'content',
        duration: +dayjs.duration({ minutes: 22 }),
        externalIds: [],
        persisted: true,
        subtype: 'episode',
        title: 'Show1.Ep1',
        uniqueId: 'Show1.Ep1',
        showId: 'test.1',
      },
      {
        type: 'content',
        duration: +dayjs.duration({ minutes: 22 }),
        externalIds: [],
        persisted: true,
        subtype: 'episode',
        title: 'Show2.Ep1',
        uniqueId: 'Show2.Ep1',
        showId: 'test.2',
      },
    ]);

    let start = dayjs(result.startTime);
    for (const program of result.programs) {
      console.log(
        start.format(),
        formatProgram(program),
        dayjs.duration(program.duration).humanize(),
      );
      start = start.add(program.duration);
    }
  });
});
