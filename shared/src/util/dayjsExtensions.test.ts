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

  const oneMin = 60 * 1000;
  const oneHour = 60 * oneMin;
  const oneDay = 24 * oneHour;

  test('tz aware wraps a negative offset into the same local day', () => {
    // 7PM New York is midnight UTC, so the UTC remainder is 0.
    const newYork7PM = dayjs.tz('2025-01-06 19:00', 'America/New_York');

    expect(+newYork7PM.mod(oneDay)).toBe(0);
    expect(+newYork7PM.mod(oneDay, true)).toBe(19 * oneHour);
  });

  test('tz aware follows quarter- and half-hour offsets', () => {
    const kathmanduMidnight = dayjs.tz('2025-01-06 00:00', 'Asia/Kathmandu');
    const kolkataMidnight = dayjs.tz('2025-01-06 00:00', 'Asia/Kolkata');

    // Kathmandu is UTC+5:45 and Kolkata is UTC+5:30.
    expect(+kathmanduMidnight.mod(oneHour)).toBe(15 * oneMin);
    expect(+kathmanduMidnight.mod(oneHour, true)).toBe(0);
    expect(+kathmanduMidnight.add(50, 'minute').mod(30 * oneMin, true)).toBe(
      20 * oneMin,
    );
    expect(+kolkataMidnight.mod(oneHour)).toBe(30 * oneMin);
    expect(+kolkataMidnight.mod(oneHour, true)).toBe(0);
  });

  test('accepts a number, a duration, or a duration object', () => {
    const t = dayjs.tz('2025-01-06 10:20', 'Asia/Kathmandu');

    expect(+t.mod(oneHour, true)).toBe(20 * oneMin);
    expect(+t.mod(dayjs.duration(1, 'hour'), true)).toBe(20 * oneMin);
    expect(+t.mod({ hours: 1 }, true)).toBe(20 * oneMin);
  });

  describe('with a plain local dayjs', () => {
    // The slot schedulers pad plain dayjs cursors, whose offset comes from
    // the process time zone.
    let originalTZ: string | undefined;
    beforeAll(() => {
      originalTZ = process.env['TZ'];
      process.env['TZ'] = 'America/New_York';
    });
    afterAll(() => {
      if (originalTZ !== undefined) {
        process.env['TZ'] = originalTZ;
      } else {
        delete process.env['TZ'];
      }
    });

    test('tz aware tracks the offset across a DST change', () => {
      // New York springs forward on March 9, 2025.
      const before = dayjs('2025-03-08');
      const after = before.add(2, 'day');

      expect(before.utcOffset()).toBe(-300);
      expect(after.utcOffset()).toBe(-240);
      expect(+before.mod(oneDay, true)).toBe(0);
      expect(+after.mod(oneDay, true)).toBe(0);
      expect(+after.add(19, 'hour').mod(oneDay, true)).toBe(19 * oneHour);
    });
  });
});
