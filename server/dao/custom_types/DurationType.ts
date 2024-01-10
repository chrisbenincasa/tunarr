import { Type } from '@mikro-orm/core';
import dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import duration from 'dayjs/plugin/duration.js';
import { isUndefined } from 'lodash-es';

dayjs.extend(duration);

export class DurationType extends Type<
  Duration | undefined,
  number | undefined
> {
  convertToDatabaseValue(
    value: number | Duration | undefined,
  ): number | undefined {
    if (isUndefined(value)) {
      return value;
    }

    if (dayjs.isDuration(value)) {
      return value.asMilliseconds();
    }

    return value;
  }

  convertToJSValue(
    value: number | Duration | undefined,
  ): duration.Duration | undefined {
    if (isUndefined(value)) {
      return value;
    }

    if (dayjs.isDuration(value)) {
      return value;
    }

    return dayjs.duration({ milliseconds: value });
  }

  toJSON(value: Duration | undefined): number | Duration | undefined {
    return value?.asMilliseconds();
  }

  getColumnType(): string {
    return 'integer';
  }
}
