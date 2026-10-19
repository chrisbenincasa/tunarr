import { describe, expect, test } from 'vitest';
import { fitTopBar, type TopBarMeasurements } from './fitTopBar.ts';

// Rough comfortable-density widths for the five sections.
const base: TopBarMeasurements = {
  available: 1376,
  logo: 40,
  wordmark: 72,
  sections: [70, 92, 78, 76, 74],
  sectionGap: 2,
  more: 80,
  searchFull: 240,
  searchIcon: 36,
  actions: 124,
  actionGap: 8,
  groupGap: 24,
};

describe('fitTopBar', () => {
  test('shows everything when there is room', () => {
    expect(fitTopBar(base, 2)).toEqual({
      search: 'full',
      wordmark: true,
      visible: [0, 1, 2, 3, 4],
      overflow: [],
    });
  });

  test('shrinks the search pill below 1000 px even when it would fit', () => {
    const layout = fitTopBar({ ...base, available: 960 }, 2);
    expect(layout.search).toBe('icon');
    expect(layout.wordmark).toBe(true);
    expect(layout.overflow).toEqual([]);
  });

  test('drops the wordmark before hiding any section', () => {
    // Needs 40 + 24 + 398 + 24 + 168 = 654 without the wordmark.
    const layout = fitTopBar({ ...base, available: 700 }, 2);
    expect(layout).toEqual({
      search: 'icon',
      wordmark: false,
      visible: [0, 1, 2, 3, 4],
      overflow: [],
    });
  });

  // At 560 px the logo, gaps and actions take 256 px, which leaves 304 px
  // for the sections and the More button.
  test('moves sections under More from the right', () => {
    const layout = fitTopBar({ ...base, available: 560 }, 0);
    expect(layout.wordmark).toBe(false);
    expect(layout.visible).toEqual([0, 1]);
    expect(layout.overflow).toEqual([2, 3, 4]);
  });

  test('keeps the active section visible', () => {
    const layout = fitTopBar({ ...base, available: 560 }, 4);
    expect(layout.visible).toEqual([0, 4]);
    expect(layout.overflow).toEqual([1, 2, 3]);
  });

  test('keeps the active section even when nothing else fits', () => {
    const layout = fitTopBar({ ...base, available: 100 }, 3);
    expect(layout.visible).toEqual([3]);
    expect(layout.overflow).toEqual([0, 1, 2, 4]);
  });
});
