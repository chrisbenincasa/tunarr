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
      lockWeights: false,
      slots: [
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ minutes: 30 }),
          },
          programming: {
            type: 'show',
            showId: 'test.1',
          },
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
          programming: {
            type: 'movie',
          },
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
          programming: {
            type: 'show',
            showId: 'test.2',
          },
          order: 'next',
          direction: 'asc',
        },
      ],
    }).generateSchedule([
      ...map(
        range(0, 5),
        (i) =>
          ({
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
            externalKey: '123',
            externalSourceId: 'abc',
            externalSourceName: 'plex',
            externalSourceType: 'plex',
            // showId: 'test.1',
          }) satisfies ChannelProgram,
      ),
      {
        type: 'content',
        duration: +dayjs.duration({ minutes: 22 }),
        externalIds: [],
        persisted: true,
        subtype: 'episode',
        title: 'Show1.Ep1',
        uniqueId: 'Show1.Ep1',
        showId: 'test.1',
        externalKey: '123',
        externalSourceId: 'abc',
        externalSourceName: 'plex',
        externalSourceType: 'plex',
      } satisfies ChannelProgram,
      {
        type: 'content',
        duration: +dayjs.duration({ minutes: 22 }),
        externalIds: [],
        persisted: true,
        subtype: 'episode',
        title: 'Show2.Ep1',
        uniqueId: 'Show2.Ep1',
        showId: 'test.2',
        externalKey: '123',
        externalSourceId: 'abc',
        externalSourceName: 'plex',
        externalSourceType: 'plex',
      } satisfies ChannelProgram,
    ]);

    for (const program of result) {
      console.log(
        formatProgram(program),
        dayjs.duration(program.duration).humanize(),
      );
    }
  });
});
