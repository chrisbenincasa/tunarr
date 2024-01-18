import inst, { Dayjs, ManipulateType, PluginFunc, isDuration } from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';

declare module 'dayjs' {
  interface Dayjs {
    mod(value: number, unit?: inst.ManipulateType): duration.Duration;
    mod(value: duration.Duration): duration.Duration;
  }
}

export const mod: PluginFunc = (_opts, dayjsClass, dayjsFactory) => {
  dayjsFactory.extend(duration);

  dayjsClass.prototype['mod'] = function (
    value: number | Duration,
    unit?: ManipulateType,
  ) {
    let dur: Duration;
    if (isDuration(value)) {
      dur = value;
    } else {
      dur = dayjsFactory.duration(value, unit ?? 'milliseconds');
    }

    const djs = this as Dayjs;

    return dayjsFactory.duration((djs.unix() * 1000) % dur.asMilliseconds());
  };
};
