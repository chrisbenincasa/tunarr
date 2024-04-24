// This operator runs in between each user-defined scheduling operator
// It's responsibility is to fix up internal data structures so that
// each operator as an updated and correct view of the current state

import { last, reduce } from 'lodash-es';
import { ChannelAndLineup } from '../../dao/channelDb';
import { Func } from '../../types/func';

function fix(channelAndLineup: ChannelAndLineup): Promise<ChannelAndLineup> {
  const { channel, lineup } = channelAndLineup;
  // Recalculate startTimeOffsets
  // TODO: Centralize this implementation - it exists in channelDB too
  lineup.startTimeOffsets = reduce(
    lineup.items,
    (acc, item, index) => [...acc, acc[index] + item.durationMs],
    [0],
  );
  channel.duration = last(lineup.startTimeOffsets) ?? 0;

  return Promise.resolve({ channel, lineup });
}

// of the channel lineup
export const IntermediateOperator: Func<
  ChannelAndLineup,
  Promise<ChannelAndLineup>
> = {
  apply: fix,
};