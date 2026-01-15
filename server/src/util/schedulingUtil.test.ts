import { EverySchedule } from '@tunarr/types/schemas';
import dayjs from './dayjs.ts';
import { scheduleRuleToCronString } from './schedulingUtil.ts';
test('should parse every schedules', () => {
  const schedule: EverySchedule = {
    type: 'every',
    offsetMs: dayjs.duration(4, 'hours').asMilliseconds(),
    increment: 1,
    unit: 'hour',
  };

  expect(scheduleRuleToCronString(schedule)).toEqual('0 4-23 * * *');
});
