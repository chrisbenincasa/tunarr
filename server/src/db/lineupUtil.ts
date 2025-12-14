import { reduce } from 'lodash-es';
import type { LineupItem } from './derived_types/Lineup.ts';

export function calculateStartTimeOffsets(
  lineup: LineupItem[] | ReadonlyArray<LineupItem>,
) {
  return reduce(
    lineup,
    (acc, item, index) => {
      acc.push(acc[index]! + item.durationMs);
      return acc;
    },
    [0],
  );
}
