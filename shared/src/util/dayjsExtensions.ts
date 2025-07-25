import type { Dayjs, PluginFunc } from 'dayjs';
import type { DurationUnitsObjectType } from 'dayjs/plugin/duration.js';
import duration from 'dayjs/plugin/duration.js';
import { isNumber } from 'lodash-es';

declare module 'dayjs' {
  interface Dayjs {
    mod(
      value: DurationUnitsObjectType | duration.Duration | number,
      tzAware?: boolean,
    ): duration.Duration;
  }
}

export const mod: PluginFunc = (_opts, dayjsClass, dayjsFactory) => {
  // Mod requires duration.
  dayjsFactory.extend(duration);

  // Returns the remaining duration in milliseconds of
  // timestamp % duration.
  // For instance, dayjs().mod(dayjs.duration(1, 'day')) gives us the
  // milliseconds _into_ the current day.
  // NOTE: For the resultant durations to be useful, they may need to
  // be timezone adjusted (i.e. duration - new Date().getTimezoneOffset())
  // before being used with new timestamps.
  dayjsClass.prototype['mod'] = function (
    value: DurationUnitsObjectType | duration.Duration | number,
    tzAware: boolean = false,
  ) {
    let dur: duration.Duration;
    if (dayjsFactory.isDuration(value)) {
      dur = value;
    } else if (isNumber(value)) {
      dur = dayjsFactory.duration(value, 'milliseconds');
    } else {
      dur = dayjsFactory.duration(value);
    }

    let djs = this as Dayjs;
    // If we want to auto-adjust the modded duration for the curren TZ
    // we need to synthetically adjust the current date back to utc.
    // Apparently .utc() doesn't do this for us. And when we get .valueOf
    // we lose some context.
    // We can't just add the utcOffset to the resultant duration. Example:
    // 7PM ET % OneDay == expected to be 68400000 (i.e. 19 * 60 * 60 * 1000)
    // However, 7PM ET == 12AM UTC, the following day. dayjs(7PM ET) % OneDayMs == 0
    // without TZ info. Because ET is a negative offset of 5 hours, we would need to
    // calculate 24h in ms - utcOffset in ms to get the correct answer.
    // Alternatively - we artificially adjust here before doing the mod at all.
    if (tzAware) {
      djs = djs.add(djs.utcOffset(), 'minutes');
    }

    return dayjsFactory.duration(+djs % dur.asMilliseconds());
  };
};

export const min = (l: duration.Duration, r: duration.Duration) => {
  return l.asMilliseconds() < r.asMilliseconds() ? l : r;
};

export const max = (l: duration.Duration, r: duration.Duration) => {
  return l.asMilliseconds() >= r.asMilliseconds() ? l : r;
};
