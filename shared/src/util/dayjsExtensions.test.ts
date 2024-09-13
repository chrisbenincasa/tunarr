import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { mod } from './dayjsExtensions.js';

dayjs.extend(duration);
dayjs.extend(tz);
dayjs.extend(utc);
dayjs.extend(mod);

describe('dayjs.mod', () => {
  test('caluclates hours into day (tz unaware)', () => {
    const newYork2AM = dayjs()
      .tz('America/New_York')
      .startOf('day')
      .add(2, 'hours');
    const offsetDuration = dayjs.duration(newYork2AM.utcOffset(), 'minutes');

    // % 1 day to get the duration "into" the day (i.e. leftover ms)
    // without having mod adjust for tz, we expect to get "2AM" + "offset hours"
    // since the "time into day" will be returned as if the original time was UTC
    const out = newYork2AM.mod(dayjs.duration({ days: 1 }));
    expect(out.add(offsetDuration).asHours()).toBe(2);
  });

  test('caluclates hours into day (tz aware)', () => {
    const newYork2AM = dayjs()
      .tz('America/New_York')
      .startOf('day')
      .add(2, 'hours');

    // % 1 day to get the duration "into" the day (i.e. leftover ms)
    // If we tell mod to be tz-aware, it will do the calculate to adjust
    // the remaining time for us by applying the utcOffset from the original
    // passed datetime
    const out = newYork2AM.mod(dayjs.duration({ days: 1 }), true);
    expect(out.asHours()).toBe(2);
  });
});
