import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import timezone from 'dayjs/plugin/timezone.js';
import { isContentProgram } from 'dizquetv-types';
import { isNull } from 'lodash-es';
import { fileURLToPath } from 'node:url';
import { dirname } from 'path';
import { beforeAll, test } from 'vitest';
import { ChannelDB } from '../dao/channelDb.js';
import { withDb } from '../dao/dataSource.js';
import { setGlobalOptions } from '../globals.js';
import scheduleTimeSlots from './timeSlotsService2.ignore.js';

dayjs.extend(duration);
dayjs.extend(timezone);

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

    const { programs: res, startTime } = await scheduleTimeSlots(
      {
        type: 'time',
        period: 'day', // 1 day
        latenessMs: dayjs.duration(15, 'minutes').asMilliseconds(),
        maxDays: 1,
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
            startTime: dayjs.duration(6, 'hours').asMilliseconds(), // slot starts at 2am (i.e. 2 hour into the day)
            programming: {
              type: 'movie',
              sortType: '',
            },
            order: 'shuffle',
          },
          {
            startTime: dayjs.duration(12, 'hours').asMilliseconds(),
            programming: {
              type: 'show',
              showId: '30 Rock',
            },
            order: 'next',
          },
        ],
        padMs: dayjs.duration({ minutes: 5 }).asMilliseconds(),
        timeZoneOffset: dayjs.duration(5, 'hours').asMinutes(),
      },
      x,
    );

    let start = dayjs.tz(startTime);
    res
      .map((r) => {
        const ts = start.format();
        start = start.add(r.duration);
        return {
          start: ts,
          end: start.format(),
          name: isContentProgram(r) ? r.title : null,
          duration: r.duration,
          type: r.type,
        };
      })
      .forEach((x) => console.log(x));
  });
});
