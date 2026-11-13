import type { LibraryScanSchedule } from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import {
  formValuesToScanSchedule,
  scanScheduleToFormValues,
} from './scanScheduleForm.ts';

describe('scan schedule form values', () => {
  test.each<LibraryScanSchedule>([
    { type: 'off' },
    { type: 'interval', hours: 12, minute: 5 },
    { type: 'days', daysOfWeek: [1, 3], hour: 4, minute: 45 },
    { type: 'cron', cron: '0 4 * * 0' },
  ])('round-trips $type', (schedule) => {
    expect(
      formValuesToScanSchedule(scanScheduleToFormValues(schedule)),
    ).toEqual(schedule);
  });

  test('keeps other types at their defaults when switching', () => {
    const values = scanScheduleToFormValues({
      type: 'cron',
      cron: '0 4 * * 0',
    });

    expect(formValuesToScanSchedule({ ...values, type: 'interval' })).toEqual({
      type: 'interval',
      hours: 6,
      minute: 30,
    });
  });

  test('sorts days and trims cron input', () => {
    const values = scanScheduleToFormValues({ type: 'off' });

    expect(
      formValuesToScanSchedule({ ...values, type: 'days', daysOfWeek: [5, 0] }),
    ).toMatchObject({ daysOfWeek: [0, 5] });
    expect(
      formValuesToScanSchedule({
        ...values,
        type: 'cron',
        cron: ' 0 4 * * 0 ',
      }),
    ).toEqual({ type: 'cron', cron: '0 4 * * 0' });
  });
});
