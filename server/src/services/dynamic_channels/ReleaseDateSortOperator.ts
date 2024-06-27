import { ReleaseDateSortOrderOperation } from '@tunarr/types/api';
import { filter, isNull, sortBy } from 'lodash-es';
import { ChannelAndLineup } from '../../dao/channelDb';
import { LineupCreatorContext } from './LineupCreatorContext';
import { SchedulingOperator } from './SchedulingOperator';
import { isContentItem } from '../../dao/derived_types/Lineup';

export class ReleaseDateSortOperator extends SchedulingOperator<ReleaseDateSortOrderOperation> {
  public async apply({
    channel,
    lineup,
  }: ChannelAndLineup): Promise<ChannelAndLineup> {
    const ctx = LineupCreatorContext.getContext();
    // We should only ever have content items in dynamic scheduler anyway
    const workingPrograms = filter(lineup.items, isContentItem);
    // TODO include order, right now it'll be asc
    const sortedItems = sortBy(
      workingPrograms,
      (program) => {
        const details = ctx.programById[program.id];
        if (!details) {
          return Number.MAX_SAFE_INTEGER;
        }

        const date = details.original_air_date
          ? new Date(details.original_air_date).getTime()
          : 0;
        return date;
      },
      (program) => {
        const details = ctx.programById[program.id];
        if (!details) {
          return 0;
        }

        let n = 1;
        if (!isNull(details.season_number)) {
          n *= details.season_number * 1e4;
        }

        if (!isNull(details.episode)) {
          n += details.episode * 1e2;
        }

        return n;
      },
    );

    return Promise.resolve({
      channel,
      lineup: { ...lineup, items: sortedItems },
    });
  }
}
