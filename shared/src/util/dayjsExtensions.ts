import inst, { Dayjs, ManipulateType, PluginFunc } from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';

declare module 'dayjs' {
  interface Dayjs {
    mod(value: number, unit?: inst.ManipulateType): duration.Duration;
    mod(value: duration.Duration): duration.Duration;
  }
}

export const mod: PluginFunc = (_opts, dayjsClass, dayjsFactory) => {
  dayjsFactory.extend(duration);

  // Returns the remaining duration in milliseconds of
  // timestamp % duration.
  // For instance, dayjs().mod(dayjs.duration(1, 'day')) gives us the
  // milliseconds _into_ the current day.
  // NOTE: For the resultant durations to be useful, they may need to
  // be timezone adjusted (i.e. duration - new Date().getTimezoneOffset())
  // before being used with new timestamps.
  dayjsClass.prototype['mod'] = function (
    value: number | Duration,
    unit?: ManipulateType,
  ) {
    let dur: Duration;
    if (dayjsFactory.isDuration(value)) {
      dur = value;
    } else {
      dur = dayjsFactory.duration(value, unit ?? 'milliseconds');
    }

    const djs = this as Dayjs;

    return dayjsFactory.duration((djs.unix() * 1000) % dur.asMilliseconds());
  };
};

export const min = (l: duration.Duration, r: duration.Duration) => {
  return l.asMilliseconds() < r.asMilliseconds() ? l : r;
};

export const max = (l: duration.Duration, r: duration.Duration) => {
  return l.asMilliseconds() >= r.asMilliseconds() ? l : r;
};
