import { RandomSortOrderOperation } from '@tunarr/types/api';
import { SchedulingOperator } from './SchedulingOperator';
import { ChannelAndLineup } from '../../dao/channelDb';
import { random } from '../../util/random';

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
