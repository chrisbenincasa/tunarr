import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { isUndefined } from 'lodash-es';
import type { Nullable } from './util.ts';

export class OpenDateTimeRange {
  private constructor(
    public from?: Dayjs,
    public to?: Dayjs,
  ) {}

  static create(
    from: dayjs.ConfigType | Dayjs | undefined,
    to: Date | Dayjs | undefined,
  ): Nullable<OpenDateTimeRange> {
    from = isUndefined(from) ? from : dayjs.isDayjs(from) ? from : dayjs(from);
    to = isUndefined(to) ? to : dayjs.isDayjs(to) ? to : dayjs(to);

    if (from && to && to.isBefore(from)) {
      return null;
    }

    return new OpenDateTimeRange(from, to);
  }
}
