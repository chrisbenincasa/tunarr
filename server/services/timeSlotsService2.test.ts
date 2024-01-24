import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import timezone from 'dayjs/plugin/timezone.js';
import { FlexProgram, isContentProgram } from 'dizquetv-types';
import { isNull, pad } from 'lodash-es';
import { fileURLToPath } from 'node:url';
import { dirname } from 'path';
import { beforeAll, test } from 'vitest';
import { ChannelDB } from '../dao/channelDb.js';
import { withDb } from '../dao/dataSource.js';
import { setGlobalOptions } from '../globals.js';
import scheduleTimeSlots, {
  PaddedProgram,
  distributeFlex,
} from './timeSlotsService2.ignore.js';
import { TimeSlotSchedule } from '../dao/derived_types/Lineup.js';

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

const schedule: TimeSlotSchedule = {
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
};

test('do', async () => {
  console.log(__filename);
  console.log(__dirname);

  await withDb(async () => {
    const channelDb = new ChannelDB();
    const x = await channelDb.loadAndMaterializeLineup(2);
    if (isNull(x)) {
      throw new Error('NULL!');
    }

    const { programs: res, startTime } = await scheduleTimeSlots(schedule, x);

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

test('distribute flex', () => {
  function makeFlexProgram(dur: number): FlexProgram {
    return {
      duration: dur,
      persisted: false,
      type: 'flex',
    };
  }

  const twoMin = dayjs.duration(2.5, 'minutes').asMilliseconds();
  const threeMins = dayjs.duration(3, 'minutes').asMilliseconds();

  console.log(schedule.padMs);

  const paddedPrograms: PaddedProgram[] = [
    { padMs: 145, totalDuration: twoMin, program: makeFlexProgram(twoMin) },
    { padMs: 0, totalDuration: threeMins, program: makeFlexProgram(threeMins) },
    { padMs: 2, totalDuration: threeMins, program: makeFlexProgram(threeMins) },
  ];

  console.log(paddedPrograms);

  distributeFlex(
    paddedPrograms,
    { ...schedule, padMs: dayjs.duration(15, 'minutes').asMilliseconds() },
    dayjs
      .duration(1, 'hour')
      .add(12, 'minutes')
      .add(5, 'seconds')
      .asMilliseconds(),
  );

  console.log(paddedPrograms);
});
