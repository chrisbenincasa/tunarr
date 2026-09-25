import { describe, expect, test } from 'vitest';
import type { ProgramOption } from './slotSchedulerUtil.ts';
import {
  customShowAvailability,
  isSelectableForNewSlot,
  unavailableCustomShowSlotIndexes,
} from './slotSchedulerUtil.ts';

const customShow = (
  customShowId: string,
  schedulableProgramCount: number,
): ProgramOption => ({
  type: 'custom-show',
  customShowId,
  schedulableProgramCount,
  value: `custom-show.${customShowId}`,
  description: customShowId,
});

const flex: ProgramOption = {
  type: 'flex',
  value: 'flex',
  description: 'Flex',
};

const options: ProgramOption[] = [
  flex,
  customShow('full', 3),
  customShow('empty', 0),
];

describe('isSelectableForNewSlot', () => {
  test('offers custom shows that have content', () => {
    expect(isSelectableForNewSlot(customShow('full', 3))).toBe(true);
  });

  test('withholds custom shows without content', () => {
    expect(isSelectableForNewSlot(customShow('empty', 0))).toBe(false);
  });

  test('offers other programming types regardless of count', () => {
    expect(isSelectableForNewSlot(flex)).toBe(true);
  });
});

describe('customShowAvailability', () => {
  test.each([
    ['full', 'available'],
    ['empty', 'empty'],
    ['deleted', 'missing'],
  ])('reports %s as %s', (customShowId, expected) => {
    expect(customShowAvailability(options, customShowId)).toBe(expected);
  });
});

describe('unavailableCustomShowSlotIndexes', () => {
  test('finds custom-show slots whose show is empty or deleted', () => {
    const slots = [
      { type: 'movie' },
      { type: 'custom-show', customShowId: 'full' },
      { type: 'custom-show', customShowId: 'empty' },
      { type: 'custom-show', customShowId: 'deleted' },
      { type: 'flex' },
    ];

    expect(unavailableCustomShowSlotIndexes(slots, options)).toEqual([2, 3]);
  });

  test('returns nothing when every custom show has content', () => {
    const slots = [{ type: 'custom-show', customShowId: 'full' }];

    expect(unavailableCustomShowSlotIndexes(slots, options)).toEqual([]);
  });
});
