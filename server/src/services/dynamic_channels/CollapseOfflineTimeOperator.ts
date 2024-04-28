// import { SchedulingOperator } from "./SchedulingOperator";

import { ChannelAndLineup } from '../../dao/channelDb.js';
import { Lineup, LineupItem } from '../../dao/derived_types/Lineup.js';
import { Func } from '../../types/func.js';

export function collapseOfflineTime(lineup: Lineup): Promise<Lineup> {
  const newLineup: LineupItem[] = [];
  for (let i = 0; i < lineup.items.length; i++) {
    let item = lineup.items[i];
    if (item.type !== 'offline') {
      newLineup.push(item);
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
> = {
  apply: ({ channel, lineup }: ChannelAndLineup) =>
    collapseOfflineTime(lineup).then((newLineup) => ({
      channel,
      lineup: newLineup,
    })),
};
