import type { NamedFunc } from '@/types/func.js';
import { last } from 'lodash-es';
import type { LegacyChannelAndLineup } from '../../db/interfaces/IChannelDB.ts';
import { calculateStartTimeOffsets } from '../../db/lineupUtil.ts';

function fix(
  channelAndLineup: LegacyChannelAndLineup,
): Promise<LegacyChannelAndLineup> {
  const { channel, lineup } = channelAndLineup;
  // Recalculate startTimeOffsets
  lineup.startTimeOffsets = calculateStartTimeOffsets(lineup.items);
  channel.duration = last(lineup.startTimeOffsets) ?? 0;

  return Promise.resolve({ channel, lineup });
}

// This operator runs in between each user-defined scheduling operator
// It's responsibility is to fix up internal data structures so that
// each operator as an updated and correct view of the current state
// of the channel lineup
export const IntermediateOperator: NamedFunc<
  LegacyChannelAndLineup,
  Promise<LegacyChannelAndLineup>
> = {
  name: 'FixStartTimeOffsets',
  apply: fix,
};
