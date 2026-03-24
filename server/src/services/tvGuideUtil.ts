import type { LineupItem } from '@/db/derived_types/Lineup.js';
import { isNonEmptyString, isDefined } from '@/util/index.js';
import { isUndefined } from 'lodash-es';
import type { DeepReadonly } from 'ts-essentials';

export function isPartOfMidRollGroup(item: DeepReadonly<LineupItem>): boolean {
  if (item.type !== 'content') return false;
  if (isNonEmptyString(item.fillerListId) && item.fillerType === 'mid') {
    return true;
  }
  if (
    !isNonEmptyString(item.fillerListId) &&
    isDefined(item.startOffsetMs) &&
    item.startOffsetMs > 0
  ) {
    return true;
  }
  return false;
}

export function isMidRollAnchor(item: DeepReadonly<LineupItem>): boolean {
  return (
    item.type === 'content' &&
    !isNonEmptyString(item.fillerListId) &&
    (item.startOffsetMs ?? 0) === 0
  );
}

export function isSameProgramSegment(
  a: DeepReadonly<LineupItem>,
  b: DeepReadonly<LineupItem>,
): boolean {
  return (
    a.type === 'content' &&
    b.type === 'content' &&
    !isNonEmptyString(a.fillerListId) &&
    !isNonEmptyString(b.fillerListId) &&
    a.id === b.id
  );
}

/**
 * Given a lineup index that falls within a mid-roll group (either a mid-roll
 * filler or a later content segment with startOffsetMs > 0), walk backwards
 * to find the anchor — the first content segment of the program
 * (startOffsetMs === 0 or undefined). Returns the anchor index, or the
 * original index if no lookback is needed.
 */
export function findMidRollAnchorIndex(
  items: ReadonlyArray<DeepReadonly<LineupItem>>,
  index: number,
): number {
  const item = items[index];
  if (isUndefined(item) || !isPartOfMidRollGroup(item)) {
    return index;
  }

  for (let i = index - 1; i >= 0; i--) {
    const candidate = items[i]!;
    if (isMidRollAnchor(candidate)) {
      return i;
    }
    if (!isPartOfMidRollGroup(candidate)) {
      break;
    }
  }

  return index;
}
