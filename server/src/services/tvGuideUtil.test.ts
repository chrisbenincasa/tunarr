import { describe, expect, it } from 'vitest';
import type { LineupItem } from '../db/derived_types/Lineup.ts';
import {
  findMidRollAnchorIndex,
  isMidRollAnchor,
  isPartOfMidRollGroup,
  isSameProgramSegment,
} from './tvGuideUtil.ts';

function contentItem(
  id: string,
  durationMs: number,
  opts?: { startOffsetMs?: number; fillerListId?: string; fillerType?: string },
): LineupItem {
  return {
    type: 'content',
    id,
    durationMs,
    startOffsetMs: opts?.startOffsetMs,
    fillerListId: opts?.fillerListId,
    fillerType: opts?.fillerType as 'mid' | undefined,
  };
}

function midRollFiller(fillerListId: string, durationMs: number): LineupItem {
  return contentItem(`filler-${fillerListId}`, durationMs, {
    fillerListId,
    fillerType: 'mid',
  });
}

function offlineItem(durationMs: number): LineupItem {
  return { type: 'offline', durationMs };
}

describe('isPartOfMidRollGroup', () => {
  it('returns true for a mid-roll filler', () => {
    expect(isPartOfMidRollGroup(midRollFiller('list-1', 180_000))).toBe(true);
  });

  it('returns true for a content segment with startOffsetMs > 0', () => {
    expect(
      isPartOfMidRollGroup(
        contentItem('prog', 1800_000, { startOffsetMs: 1800_000 }),
      ),
    ).toBe(true);
  });

  it('returns false for a content anchor (startOffsetMs = 0)', () => {
    expect(
      isPartOfMidRollGroup(contentItem('prog', 1800_000, { startOffsetMs: 0 })),
    ).toBe(false);
  });

  it('returns false for a content item with no startOffsetMs', () => {
    expect(isPartOfMidRollGroup(contentItem('prog', 1800_000))).toBe(false);
  });

  it('returns false for a non-mid filler (e.g. pre-roll)', () => {
    const item = contentItem('filler', 60_000, {
      fillerListId: 'list-1',
      fillerType: 'pre',
    });
    expect(isPartOfMidRollGroup(item)).toBe(false);
  });

  it('returns false for offline items', () => {
    expect(isPartOfMidRollGroup(offlineItem(60_000))).toBe(false);
  });
});

describe('isMidRollAnchor', () => {
  it('returns true for a content item with no fillerListId and startOffsetMs = 0', () => {
    expect(
      isMidRollAnchor(contentItem('prog', 1800_000, { startOffsetMs: 0 })),
    ).toBe(true);
  });

  it('returns true for a content item with no startOffsetMs', () => {
    expect(isMidRollAnchor(contentItem('prog', 1800_000))).toBe(true);
  });

  it('returns false for a content item with startOffsetMs > 0', () => {
    expect(
      isMidRollAnchor(
        contentItem('prog', 1800_000, { startOffsetMs: 1800_000 }),
      ),
    ).toBe(false);
  });

  it('returns false for a filler item', () => {
    expect(isMidRollAnchor(midRollFiller('list-1', 180_000))).toBe(false);
  });

  it('returns false for offline items', () => {
    expect(isMidRollAnchor(offlineItem(60_000))).toBe(false);
  });
});

describe('isSameProgramSegment', () => {
  it('returns true for two content items with the same id and no fillerListId', () => {
    const a = contentItem('prog-1', 1800_000);
    const b = contentItem('prog-1', 1800_000, { startOffsetMs: 1800_000 });
    expect(isSameProgramSegment(a, b)).toBe(true);
  });

  it('returns false for content items with different ids', () => {
    const a = contentItem('prog-1', 1800_000);
    const b = contentItem('prog-2', 1800_000);
    expect(isSameProgramSegment(a, b)).toBe(false);
  });

  it('returns false if either item has a fillerListId', () => {
    const a = contentItem('prog-1', 1800_000);
    const b = midRollFiller('list-1', 180_000);
    expect(isSameProgramSegment(a, b)).toBe(false);
    expect(isSameProgramSegment(b, a)).toBe(false);
  });

  it('returns false for non-content items', () => {
    const a = offlineItem(60_000);
    const b = offlineItem(60_000);
    expect(isSameProgramSegment(a, b)).toBe(false);
  });

  it('returns false for mixed types', () => {
    const a = contentItem('prog-1', 1800_000);
    const b = offlineItem(60_000);
    expect(isSameProgramSegment(a, b)).toBe(false);
  });
});

describe('findMidRollAnchorIndex', () => {
  // A typical mid-roll group:
  // [0] content seg1 (anchor)
  // [1] mid-roll filler
  // [2] content seg2
  // [3] mid-roll filler
  // [4] content seg3
  const programId = 'prog-1';
  const fillerId = 'filler-list-1';
  const midRollGroup: LineupItem[] = [
    contentItem(programId, 1800_000, { startOffsetMs: 0 }),
    midRollFiller(fillerId, 180_000),
    contentItem(programId, 1800_000, { startOffsetMs: 1800_000 }),
    midRollFiller(fillerId, 180_000),
    contentItem(programId, 1800_000, { startOffsetMs: 3600_000 }),
  ];

  it('returns the same index for an anchor item', () => {
    expect(findMidRollAnchorIndex(midRollGroup, 0)).toBe(0);
  });

  it('finds the anchor from the first mid-roll filler', () => {
    expect(findMidRollAnchorIndex(midRollGroup, 1)).toBe(0);
  });

  it('finds the anchor from the second content segment', () => {
    expect(findMidRollAnchorIndex(midRollGroup, 2)).toBe(0);
  });

  it('finds the anchor from the second mid-roll filler', () => {
    expect(findMidRollAnchorIndex(midRollGroup, 3)).toBe(0);
  });

  it('finds the anchor from the third content segment', () => {
    expect(findMidRollAnchorIndex(midRollGroup, 4)).toBe(0);
  });

  it('returns the same index for a non-mid-roll content item', () => {
    const items: LineupItem[] = [
      contentItem('other', 3600_000),
      contentItem(programId, 1800_000, { startOffsetMs: 0 }),
    ];
    expect(findMidRollAnchorIndex(items, 0)).toBe(0);
  });

  it('returns the same index for an offline item', () => {
    const items: LineupItem[] = [offlineItem(60_000)];
    expect(findMidRollAnchorIndex(items, 0)).toBe(0);
  });

  it('works when the mid-roll group is preceded by another program', () => {
    const items: LineupItem[] = [
      contentItem('other-program', 3600_000),
      contentItem(programId, 1800_000, { startOffsetMs: 0 }),
      midRollFiller(fillerId, 180_000),
      contentItem(programId, 1800_000, { startOffsetMs: 1800_000 }),
    ];
    // From the filler at index 2, should find anchor at index 1
    expect(findMidRollAnchorIndex(items, 2)).toBe(1);
    // From the second segment at index 3
    expect(findMidRollAnchorIndex(items, 3)).toBe(1);
    // The preceding program at index 0 should stay unchanged
    expect(findMidRollAnchorIndex(items, 0)).toBe(0);
  });

  it('works when the mid-roll group is preceded by offline', () => {
    const items: LineupItem[] = [
      offlineItem(60_000),
      contentItem(programId, 1800_000, { startOffsetMs: 0 }),
      midRollFiller(fillerId, 180_000),
      contentItem(programId, 1800_000, { startOffsetMs: 1800_000 }),
    ];
    expect(findMidRollAnchorIndex(items, 3)).toBe(1);
  });

  it('returns original index if anchor cannot be found (defensive)', () => {
    // Edge case: a segment with startOffsetMs > 0 at position 0 with no anchor before it
    const items: LineupItem[] = [
      contentItem(programId, 1800_000, { startOffsetMs: 1800_000 }),
    ];
    expect(findMidRollAnchorIndex(items, 0)).toBe(0);
  });

  it('handles two consecutive mid-roll groups', () => {
    const prog1 = 'prog-1';
    const prog2 = 'prog-2';
    const items: LineupItem[] = [
      // Group 1
      contentItem(prog1, 1800_000, { startOffsetMs: 0 }),
      midRollFiller(fillerId, 180_000),
      contentItem(prog1, 1800_000, { startOffsetMs: 1800_000 }),
      // Group 2
      contentItem(prog2, 1800_000, { startOffsetMs: 0 }),
      midRollFiller(fillerId, 180_000),
      contentItem(prog2, 1800_000, { startOffsetMs: 1800_000 }),
    ];
    // Items in group 1 should resolve to index 0
    expect(findMidRollAnchorIndex(items, 1)).toBe(0);
    expect(findMidRollAnchorIndex(items, 2)).toBe(0);
    // Group 2's anchor at index 3 should stay
    expect(findMidRollAnchorIndex(items, 3)).toBe(3);
    // Items in group 2 should resolve to index 3
    expect(findMidRollAnchorIndex(items, 4)).toBe(3);
    expect(findMidRollAnchorIndex(items, 5)).toBe(3);
  });
});
