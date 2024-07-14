import { last, reduce } from 'lodash-es';
import { NamedFunc } from '../../types/func';
import { ChannelAndLineup } from '../../types/internal.js';

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

// This operator runs in between each user-defined scheduling operator
// It's responsibility is to fix up internal data structures so that
// each operator as an updated and correct view of the current state
// of the channel lineup
export const IntermediateOperator: NamedFunc<
  ChannelAndLineup,
  Promise<ChannelAndLineup>
> = {
  name: 'FixStartTimeOffsets',
  apply: fix,
};
