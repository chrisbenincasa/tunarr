import { ReleaseDateSortOrderOperation } from '@tunarr/types/api';
import { filter, isNull, sortBy } from 'lodash-es';
import { ChannelAndLineup } from '../../types/internal.js';
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

        const date = details.originalAirDate
          ? new Date(details.originalAirDate).getTime()
          : 0;
        return date;
      },
      (program) => {
        const details = ctx.programById[program.id];
        if (!details) {
          return 0;
        }

        let n = 1;
        if (!isNull(details.seasonNumber)) {
          n *= details.seasonNumber * 1e4;
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
