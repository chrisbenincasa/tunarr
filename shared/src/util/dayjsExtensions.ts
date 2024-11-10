import { Dayjs, PluginFunc } from 'dayjs';
import duration, { DurationUnitsObjectType } from 'dayjs/plugin/duration.js';
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

    const djs = this as Dayjs;

    const outDur = dayjsFactory.duration(+djs % dur.asMilliseconds());

    if (tzAware) {
      return outDur.add(djs.utcOffset(), 'minutes');
    }

    return outDur;
  };
};

export const min = (l: duration.Duration, r: duration.Duration) => {
  return l.asMilliseconds() < r.asMilliseconds() ? l : r;
};

export const max = (l: duration.Duration, r: duration.Duration) => {
  return l.asMilliseconds() >= r.asMilliseconds() ? l : r;
};
