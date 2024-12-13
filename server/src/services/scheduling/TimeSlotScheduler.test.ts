import { bootstrapTunarr } from '@/bootstrap.ts';
import { ProgramDB } from '@/db/ProgramDB.ts';
import { setGlobalOptions } from '@/globals.ts';
import {
  Schedule,
  TimeSlotScheduler,
} from '@/services/scheduling/TimeSlotScheduler.ts';
import dayjs from '@/util/dayjs.ts';
import { getDefaultDatabaseDirectory } from '@/util/defaults.ts';

beforeAll(async () => {
  setGlobalOptions({
    database: getDefaultDatabaseDirectory(),
    force_migration: false,
    log_level: 'debug',
    verbose: 0,
  });
  await bootstrapTunarr();
});

test('TimeSlotScheduler', async () => {
  const scheduler = new TimeSlotScheduler(new ProgramDB());

  const schedule = {
    flexPreference: 'distribute',
    maxLatenessMs: 0,
    padMs: 1,
    period: 'day',
    slots: [
      {
        type: 'ordered',
        programming: {
          type: 'grouping',
          groupingId: '3eb2fa2b-d28d-46fb-ae83-9092cec45371',
          order: 'next',
        },
        startTimeOffset: +dayjs.duration(
          dayjs.tz().hour(1).startOf('h').diff(dayjs.tz().startOf('day')),
        ),
      },
    ],
  } satisfies Schedule;

  await scheduler.schedule(schedule);
});
