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

function getContentId(p: UIChannelProgram): string | undefined {
  if (p.type === 'content' || p.type === 'custom') {
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

    if (
      (current.type === 'content' || current.type === 'custom') &&
      i + 1 < programs.length &&
      isMidRollBreak(programs[i + 1])
    ) {
      const contentId = getContentId(current);
      const groupItems: UIChannelProgram[] = [current];
      let j = i + 1;

      while (j < programs.length) {
        const next = programs[j];
        if (isMidRollBreak(next)) {
          groupItems.push(next);
          j++;
        } else if (
          (next.type === 'content' || next.type === 'custom') &&
          getContentId(next) === contentId
        ) {
          groupItems.push(next);
          j++;
        } else {
          break;
        }
      }

      if (groupItems.length > 1) {
        const contentSegments = groupItems.filter(
          (p) => p.type === 'content' || p.type === 'custom',
        );
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
      } else {
        result.push({ kind: 'program', program: current });
        i++;
      }
    } else {
      result.push({ kind: 'program', program: current });
      i++;
    }
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
