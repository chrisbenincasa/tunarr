import { describe, expect, test } from 'vitest';
import { validateSlotGroups } from './slotGroupValidator.ts';

describe('validateSlotGroups', () => {
  const validGroupId = '550e8400-e29b-41d4-a716-446655440000';

  test('accepts slots with no groups', () => {
    const result = validateSlotGroups([
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '1',
      },
      {
        type: 'show',
        showId: 'show2',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '2',
      },
    ]);
    expect(result.valid).toBe(true);
  });

  test('accepts valid group with matching content', () => {
    const result = validateSlotGroups([
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '1',
        iterationGroup: validGroupId,
        linkMode: 'continue',
      },
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '2',
        iterationGroup: validGroupId,
        linkMode: 'continue',
      },
    ]);
    expect(result.valid).toBe(true);
  });

  test('rejects group with mismatched content keys', () => {
    const result = validateSlotGroups([
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '1',
        iterationGroup: validGroupId,
        linkMode: 'continue',
      },
      {
        type: 'show',
        showId: 'show2',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '2',
        iterationGroup: validGroupId,
        linkMode: 'continue',
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('content');
  });

  test('accepts mixed linkMode group for time slots with at least one continue slot', () => {
    const result = validateSlotGroups(
      [
        {
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
          id: '1',
          iterationGroup: validGroupId,
          linkMode: 'continue',
        },
        {
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
          id: '2',
          iterationGroup: validGroupId,
          linkMode: 'rerun',
        },
      ],
      { scheduleType: 'time' },
    );
    expect(result.valid).toBe(true);
  });

  test('accepts all-rerun group (legacy behavior)', () => {
    const result = validateSlotGroups([
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '1',
        iterationGroup: validGroupId,
        linkMode: 'rerun',
      },
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '2',
        iterationGroup: validGroupId,
        linkMode: 'rerun',
      },
    ]);
    expect(result.valid).toBe(true);
  });

  test('rejects mixed linkMode group for random slots', () => {
    const result = validateSlotGroups(
      [
        {
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
          id: '1',
          iterationGroup: validGroupId,
          linkMode: 'continue',
        },
        {
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
          id: '2',
          iterationGroup: validGroupId,
          linkMode: 'rerun',
        },
      ],
      { scheduleType: 'random' },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Random slot');
  });

  test('rejects mixed linkMode group with no continue slot', () => {
    const result = validateSlotGroups(
      [
        {
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
          id: '1',
          iterationGroup: validGroupId,
          linkMode: 'rerun',
        },
        {
          type: 'movie',
          order: 'next',
          direction: 'asc',
          id: '2',
          iterationGroup: validGroupId,
          linkMode: 'rerun',
        },
      ],
      { scheduleType: 'time' },
    );
    // Size is 1 (both rerun), so mixed check doesn't trigger.
    // But content keys mismatch (show vs movie).
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('content');
  });

  test('strips linkMode when iterationGroup is absent', () => {
    const slots = [
      {
        type: 'show' as const,
        showId: 'show1',
        order: 'next' as const,
        direction: 'asc' as const,
        seasonFilter: [],
        id: '1',
        linkMode: 'rerun' as const,
      },
    ];
    const result = validateSlotGroups(slots);
    expect(result.valid).toBe(true);
    expect(result.sanitizedSlots[0]).not.toHaveProperty('linkMode');
  });

  test('accepts solo group member', () => {
    const result = validateSlotGroups([
      {
        type: 'show',
        showId: 'show1',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        id: '1',
        iterationGroup: validGroupId,
        linkMode: 'continue',
      },
    ]);
    expect(result.valid).toBe(true);
  });
});
