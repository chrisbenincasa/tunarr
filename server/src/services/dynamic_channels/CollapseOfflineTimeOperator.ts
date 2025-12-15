import type { Lineup, LineupItem } from '@/db/derived_types/Lineup.js';
import type { Func } from '@/types/func.js';
import type { LegacyChannelAndLineup } from '../../db/interfaces/IChannelDB.ts';

export function collapseOfflineTime(lineup: Lineup): Promise<Lineup> {
  const newLineup: LineupItem[] = [];
  let i = 0;
  while (i < lineup.items.length) {
    let item = lineup.items[i]!;
    if (item.type !== 'offline') {
      newLineup.push(item);
      i++;
      continue;
    }

    let newDur = 0,
      start = i;
    while (item.type === 'offline') {
      newDur += item.durationMs;
      start++;
      if (start >= lineup.items.length) {
        break;
      }
      item = lineup.items[start]!;
    }

    newLineup.push({
      type: 'offline',
      durationMs: newDur,
    });

    i = start;
  }

  return Promise.resolve({
    ...lineup,
    items: newLineup,
  });
}

export const CollapseOfflineTimeOperator: Func<
  LegacyChannelAndLineup,
  Promise<LegacyChannelAndLineup>
> & { name: string } = {
  name: 'CollapseOfflineTimeOperator',
  apply: ({ channel, lineup }: LegacyChannelAndLineup) =>
    collapseOfflineTime(lineup).then((newLineup) => ({
      channel,
      lineup: newLineup,
    })),
};
