import type { TupleToUnion } from '@/types/util.js';
import type { EverySchedule } from '@tunarr/types/schemas';
import type {
  CronFields,
  DayOfTheMonthRange,
  HourRange,
  SixtyRange,
} from 'cron-parser';
import parser from 'cron-parser';
import CronExpression from 'cron-parser/lib/expression';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { range, reduce } from 'lodash-es';
import { run } from './index.ts';

dayjs.extend(duration);

const Order: Record<EverySchedule['unit'], number> = {
  second: 0,
  minute: 1,
  hour: 2,
  day: 3,
  week: 4,
};

type Constraints = TupleToUnion<typeof CronExpression.constraints>;

const constraintsByType: Record<keyof CronFields, Constraints> = run(() => {
  return reduce(
    CronExpression.map,
    (acc, key, idx) => {
      const constraint = CronExpression.constraints[idx];
      return {
        ...acc,
        [key]: constraint,
      };
    },
    {} as Record<keyof CronFields, Constraints>,
  );
});

const defaultCronFields: CronFields = run(() => {
  return reduce(
    CronExpression.map,
    (acc, key, idx) => {
      const constraint = CronExpression.constraints[idx]!;
      return {
        ...acc,
        [key]: range(constraint.min, constraint.max + 1),
      };
    },
    {} as Partial<CronFields>,
  ) as Required<CronFields>;
});

export function parseEveryScheduleRule(schedule: EverySchedule) {
  const offset = dayjs.duration(schedule.offsetMs);

  function getRange(
    everyUnit: EverySchedule['unit'],
    cronUnit: keyof CronFields,
  ) {
    const isSmallerUnit = Order[everyUnit] < Order[schedule.unit];
    let rangeEnd: number;
    if (schedule.unit === everyUnit) {
      rangeEnd = constraintsByType[cronUnit].max + 1;
    } else if (isSmallerUnit) {
      // a smaller unit takes into account offset
      rangeEnd =
        Math.min(
          Math.max(offset.get(everyUnit), constraintsByType[cronUnit].min),
          constraintsByType[cronUnit].max,
        ) + 1;
    } else {
      // a larger unit is "all"
      rangeEnd = constraintsByType[cronUnit].max + 1;
    }

    return range(
      Math.min(
        Math.max(constraintsByType[cronUnit].min, offset.get(everyUnit)),
        constraintsByType[cronUnit].max,
      ),
      rangeEnd,
      schedule.unit === everyUnit ? schedule.increment : undefined,
    );
  }

  return parser
    .fieldsToExpression({
      month: defaultCronFields.month,
      dayOfMonth: getRange('day', 'dayOfMonth') as DayOfTheMonthRange[],
      dayOfWeek: defaultCronFields.dayOfWeek,
      hour: getRange('hour', 'hour') as HourRange[],
      minute: getRange('minute', 'minute') as SixtyRange[],
      second: getRange('second', 'second') as SixtyRange[],
    })
    .stringify();
}
