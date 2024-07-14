import { ChannelAndLineup } from '../../types/internal.js';
import { Lineup, LineupItem } from '../../dao/derived_types/Lineup.js';
import { Func } from '../../types/func.js';

export function collapseOfflineTime(lineup: Lineup): Promise<Lineup> {
  const newLineup: LineupItem[] = [];
  let i = 0;
  while (i < lineup.items.length) {
    let item = lineup.items[i];
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
      item = lineup.items[start];
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
  ChannelAndLineup,
  Promise<ChannelAndLineup>
> & { name: string } = {
  name: 'CollapseOfflineTimeOperator',
  apply: ({ channel, lineup }: ChannelAndLineup) =>
    collapseOfflineTime(lineup).then((newLineup) => ({
      channel,
      lineup: newLineup,
    })),
};
