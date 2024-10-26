import { RandomSortOrderOperation } from '@tunarr/types/api';
import { ChannelAndLineup } from '../../types/internal.js';
import { random } from '../../util/random.ts';
import { SchedulingOperator } from './SchedulingOperator.ts';

export class RandomSortOperator extends SchedulingOperator<RandomSortOrderOperation> {
  public apply({
    channel,
    lineup,
  }: ChannelAndLineup): Promise<ChannelAndLineup> {
    const newLineup = random.shuffle(lineup.items);
    return Promise.resolve({
      channel,
      lineup: { ...lineup, items: newLineup },
    });
  }
}
