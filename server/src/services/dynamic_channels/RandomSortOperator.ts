import { random } from '@/util/random.js';
import type { RandomSortOrderOperation } from '@tunarr/types/api';
import type { LegacyChannelAndLineup } from '../../db/interfaces/IChannelDB.ts';
import { SchedulingOperator } from './SchedulingOperator.ts';

export class RandomSortOperator extends SchedulingOperator<RandomSortOrderOperation> {
  public apply({
    channel,
    lineup,
  }: LegacyChannelAndLineup): Promise<LegacyChannelAndLineup> {
    const newLineup = random.shuffle([...lineup.items]);
    return Promise.resolve({
      channel,
      lineup: { ...lineup, items: newLineup },
    });
  }
}
