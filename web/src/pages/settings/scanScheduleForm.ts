import type { LibraryScanSchedule } from '@tunarr/types/schemas';
import { LibraryScanIntervalHours } from '@tunarr/types/schemas';

export type LibraryScanIntervalHour = (typeof LibraryScanIntervalHours)[number];

export const AllDaysOfWeek = [0, 1, 2, 3, 4, 5, 6];

/**
 * Flat form state for every schedule type, so switching types keeps what the
 * user entered for the others.
 */
export type ScanScheduleFormValues = {
  type: LibraryScanSchedule['type'];
  intervalHours: LibraryScanIntervalHour;
  intervalMinute: number;
  daysOfWeek: number[];
  hour: number;
  minute: number;
  cron: string;
};

const defaultFormValues: ScanScheduleFormValues = {
  type: 'interval',
  intervalHours: 6,
  intervalMinute: 30,
  daysOfWeek: AllDaysOfWeek,
  hour: 3,
  minute: 0,
  cron: '',
};

export function scanScheduleToFormValues(
  schedule: LibraryScanSchedule,
): ScanScheduleFormValues {
  switch (schedule.type) {
    case 'off':
      return { ...defaultFormValues, type: 'off' };
    case 'interval':
      return {
        ...defaultFormValues,
        type: 'interval',
        intervalHours: schedule.hours,
        intervalMinute: schedule.minute,
      };
    case 'days':
      return {
        ...defaultFormValues,
        type: 'days',
        daysOfWeek: schedule.daysOfWeek,
        hour: schedule.hour,
        minute: schedule.minute,
      };
    case 'cron':
      return { ...defaultFormValues, type: 'cron', cron: schedule.cron };
  }
}

export function formValuesToScanSchedule(
  values: ScanScheduleFormValues,
): LibraryScanSchedule {
  switch (values.type) {
    case 'off':
      return { type: 'off' };
    case 'interval':
      return {
        type: 'interval',
        hours: values.intervalHours,
        minute: values.intervalMinute,
      };
    case 'days':
      return {
        type: 'days',
        daysOfWeek: [...values.daysOfWeek].sort((a, b) => a - b),
        hour: values.hour,
        minute: values.minute,
      };
    case 'cron':
      return { type: 'cron', cron: values.cron.trim() };
  }
}

export function isLibraryScanIntervalHour(
  value: number,
): value is LibraryScanIntervalHour {
  return LibraryScanIntervalHours.some((hours) => hours === value);
}
