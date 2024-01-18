import { fileURLToPath } from 'node:url';
import { dirname } from 'path';
import { beforeAll, test } from 'vitest';
import { withDb } from '../dao/dataSource.js';
import { setGlobalOptions } from '../globals.js';
import { ChannelDB } from '../dao/channelDb.js';
import scheduleTimeSlots from './timeSlotsService2.ignore.js';
import { isNull } from 'lodash-es';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(duration);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

beforeAll(() => {
  setGlobalOptions({
    database: '.dizquetv',
    force_migration: false,
  });
});

test('do', async () => {
  console.log(__filename);
  console.log(__dirname);

  await withDb(async () => {
    const channelDb = new ChannelDB();
    const x = await channelDb.loadAndMaterializeLineup(2);
    if (isNull(x)) {
      throw new Error('NULL!');
    }
    const res = await scheduleTimeSlots(
      {
        type: 'time',
        period: 'day', // 1 day
        latenessMs: dayjs.duration(15, 'minutes').asMilliseconds(),
        maxDays: 1, // calculate 2 days of content
        flexPreference: 'distribute',
        slots: [
          {
            startTime: dayjs.duration(1, 'hour').asMilliseconds(), // slot starts at 1am (i.e. 1 hour into the day)
            programming: {
              type: 'movie',
              sortType: '',
            },
            order: 'shuffle',
          },
          {
            startTime: dayjs.duration(2, 'hours').asMilliseconds(), // slot starts at 2am (i.e. 2 hour into the day)
            programming: {
              type: 'movie',
              sortType: '',
            },
            order: 'shuffle',
          },
        ],
        padMs: dayjs.duration({ minutes: 5 }).asMilliseconds(),
        timeZoneOffset: 240,
      },
      x,
    );

    const smaller = res.map((r) => {
      return {
        type: r.type,
      };
    });

    console.log(smaller);
  });
});
