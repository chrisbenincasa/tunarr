import { describe, expect, test } from 'vitest';
import {
  nextSlotStartTime,
  OneDayMillis,
  slotDayOfWeek,
  slotPeriodMillis,
  slotsForDayColumn,
  withSlotDayOfWeek,
  withSlotTimeOfDay,
} from './slotSchedulerUtil';

const HOUR = 60 * 60 * 1000;
const at = (startTime: number) => ({ startTime });

describe('slotPeriodMillis', () => {
  test('a day is 24 hours, a week is seven of them', () => {
    expect(slotPeriodMillis('day')).toBe(OneDayMillis);
    expect(slotPeriodMillis('week')).toBe(7 * OneDayMillis);
  });
});

describe('slotsForDayColumn', () => {
  test('a daily schedule has one column, so every slot is relevant', () => {
    const slots = [at(0), at(5 * HOUR), at(23 * HOUR)];
    expect(slotsForDayColumn(slots, 'day', 0)).toEqual(slots);
  });

  test('a weekly schedule keeps only the slots inside the requested day', () => {
    const slots = [at(0), at(OneDayMillis + HOUR), at(2 * OneDayMillis)];
    expect(slotsForDayColumn(slots, 'week', 1)).toEqual([
      at(OneDayMillis + HOUR),
    ]);
  });

  test('a weekly day with no slots yields nothing', () => {
    expect(slotsForDayColumn([at(0)], 'week', 3)).toEqual([]);
  });
});

describe('slotDayOfWeek', () => {
  test('reads the day a weekly offset encodes', () => {
    expect(slotDayOfWeek(0)).toBe(0);
    expect(slotDayOfWeek(23 * HOUR)).toBe(0);
    expect(slotDayOfWeek(OneDayMillis)).toBe(1);
    expect(slotDayOfWeek(3 * OneDayMillis + 5 * HOUR)).toBe(3);
  });
});

describe('withSlotDayOfWeek', () => {
  test('moves a slot between days and keeps its time', () => {
    const wednesdayAt6 = 3 * OneDayMillis + 6 * HOUR;
    expect(withSlotDayOfWeek(wednesdayAt6, 5)).toBe(
      5 * OneDayMillis + 6 * HOUR,
    );
  });

  test('day zero strips the day entirely', () => {
    expect(withSlotDayOfWeek(4 * OneDayMillis + 2 * HOUR, 0)).toBe(2 * HOUR);
  });
});

describe('withSlotTimeOfDay', () => {
  test('sets the time of day on a same-day slot', () => {
    expect(withSlotTimeOfDay(0, 5, 50, 'day')).toBe(5 * HOUR + 50 * 60 * 1000);
  });

  test('keeps the day a weekly offset encodes', () => {
    const tuesday = 2 * OneDayMillis;
    expect(withSlotTimeOfDay(tuesday, 9, 0, 'week')).toBe(
      2 * OneDayMillis + 9 * HOUR,
    );
  });
});

describe('nextSlotStartTime', () => {
  test('an empty daily schedule starts at midnight', () => {
    expect(nextSlotStartTime([], 'day', 0)).toBe(0);
  });

  test('an empty weekly column starts at the top of its day', () => {
    expect(nextSlotStartTime([], 'week', 4)).toBe(4 * OneDayMillis);
  });

  test('otherwise it is an hour after the latest slot', () => {
    expect(nextSlotStartTime([0, 2 * HOUR, HOUR], 'day', 0)).toBe(3 * HOUR);
  });
});

// The two defects that produced a daily slot at 29h50m in the field.
describe('offsets stay inside the schedule period', () => {
  test('adding past the end of a day wraps instead of running on', () => {
    expect(nextSlotStartTime([23 * HOUR], 'day', 0)).toBe(0);
  });

  test('repeatedly adding to a daily schedule never leaves the day', () => {
    const starts: number[] = [];
    for (let i = 0; i < 30; i++) {
      starts.push(nextSlotStartTime(starts, 'day', 0));
    }
    expect(Math.max(...starts)).toBeLessThan(OneDayMillis);
  });

  test('adding past the end of a week wraps too', () => {
    expect(nextSlotStartTime([7 * OneDayMillis - HOUR], 'week', 6)).toBe(0);
  });

  test('a daily schedule has no day component to preserve', () => {
    // 24h with the time set to 05:50 is how 107400000 was produced.
    expect(withSlotTimeOfDay(OneDayMillis, 5, 50, 'day')).toBe(
      5 * HOUR + 50 * 60 * 1000,
    );
  });

  test('a weekly schedule still keeps its day', () => {
    expect(withSlotTimeOfDay(2 * OneDayMillis, 9, 0, 'week')).toBe(
      2 * OneDayMillis + 9 * HOUR,
    );
  });
});
