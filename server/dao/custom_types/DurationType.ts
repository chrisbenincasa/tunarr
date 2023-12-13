import { Type } from '@mikro-orm/core';
import dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(duration);

export class DurationType extends Type<Duration, number> {
  convertToDatabaseValue(value: number | Duration): number {
    if (dayjs.isDuration(value)) {
      return value.asMilliseconds();
    }

    return value;
  }

  convertToJSValue(value: number | Duration): duration.Duration {
    if (dayjs.isDuration(value)) {
      return value;
    }

    return dayjs.duration({ milliseconds: value });
  }

  getColumnType(): string {
    return 'integer';
  }
}
