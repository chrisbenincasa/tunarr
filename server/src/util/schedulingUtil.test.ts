import { EverySchedule } from '@tunarr/types/schemas';
import dayjs from './dayjs';
import { parseEveryScheduleRule } from './schedulingUtil';
test('should parse every schedules', () => {
  const schedule: EverySchedule = {
    type: 'every',
    offsetMs: dayjs.duration(4, 'hours').asMilliseconds(),
    increment: 1,
    unit: 'hour',
  };

  expect(parseEveryScheduleRule(schedule)).toEqual('0 4-23 * * *');
});
