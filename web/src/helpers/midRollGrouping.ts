import { sumBy } from 'lodash-es';
import type { UIChannelProgram } from '../types/index.ts';

export type MidRollGroup = {
  parentProgram: UIChannelProgram;
  items: UIChannelProgram[];
  breakCount: number;
  totalDuration: number;
  startTimeOffset?: number;
  groupKey: number;
};

export type LineupDisplayItem =
  | { kind: 'program'; program: UIChannelProgram }
  | { kind: 'mid-roll-group'; group: MidRollGroup };

export type FlatDisplayItem =
  | { kind: 'program'; program: UIChannelProgram }
  | { kind: 'group-header'; group: MidRollGroup; expanded: boolean }
  | { kind: 'group-child'; program: UIChannelProgram; group: MidRollGroup };

function isMidRollBreak(p: UIChannelProgram): boolean {
  if (p.type === 'filler' && p.fillerType === 'mid') return true;
  if (p.type === 'flex' && p.fillerConfig?.origin === 'midroll') return true;
  return false;
}

/**
 * A break is rarely filled to the millisecond: whatever the mid filler cannot
 * cover is emitted as plain flex. Those leftovers carry no mid-roll marker of
 * their own, so they only count as break time when they sit between two
 * segments of the same program.
 */
function isBreakFiller(p: UIChannelProgram): boolean {
  return isMidRollBreak(p) || p.type === 'flex';
}

function isContentLike(
  p: UIChannelProgram,
): p is UIChannelProgram & { id: string } {
  return p.type === 'content' || p.type === 'custom';
}

function getContentId(p: UIChannelProgram): string | undefined {
  if (isContentLike(p)) {
    return p.id;
  }
  return;
}

export function groupMidRollItems(
  programs: UIChannelProgram[],
): LineupDisplayItem[] {
  const result: LineupDisplayItem[] = [];
  let i = 0;

  while (i < programs.length) {
    const current = programs[i];

    if (isContentLike(current)) {
      const contentId = getContentId(current);
      const groupItems: UIChannelProgram[] = [current];
      let j = i + 1;

      while (j < programs.length) {
        // Collect the run of break items that follows the current segment. It
        // only belongs to this program if it contains a real mid-roll break
        // and another segment of the same program picks up after it.
        let k = j;
        let sawMidRollBreak = false;
        while (k < programs.length && isBreakFiller(programs[k])) {
          sawMidRollBreak ||= isMidRollBreak(programs[k]);
          k++;
        }

        const nextSegment = k < programs.length ? programs[k] : undefined;
        if (
          k === j ||
          !sawMidRollBreak ||
          !nextSegment ||
          getContentId(nextSegment) !== contentId
        ) {
          break;
        }

        groupItems.push(...programs.slice(j, k + 1));
        j = k + 1;
      }

      if (groupItems.length > 1) {
        const contentSegments = groupItems.filter(isContentLike);
        result.push({
          kind: 'mid-roll-group',
          group: {
            parentProgram: current,
            items: groupItems,
            breakCount: contentSegments.length - 1,
            totalDuration: sumBy(groupItems, 'duration'),
            startTimeOffset: current.startTimeOffset,
            groupKey: current.originalIndex,
          },
        });
        i = j;
        continue;
      }
    }

    result.push({ kind: 'program', program: current });
    i++;
  }

  return result;
}

export function buildFlatDisplayList(
  displayItems: LineupDisplayItem[],
  expandedGroups: Set<number>,
): FlatDisplayItem[] {
  const flat: FlatDisplayItem[] = [];

  for (const item of displayItems) {
    if (item.kind === 'program') {
      flat.push(item);
    } else {
      const expanded = expandedGroups.has(item.group.groupKey);
      flat.push({ kind: 'group-header', group: item.group, expanded });
      if (expanded) {
        for (const child of item.group.items) {
          flat.push({
            kind: 'group-child',
            program: child,
            group: item.group,
          });
        }
      }
    }
  }

  return flat;
}
