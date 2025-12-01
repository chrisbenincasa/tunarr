import { seq } from '@tunarr/shared/util';
import { Show } from '@tunarr/types';
import {
  MaterializedCustomShowTimeSlot,
  MaterializedFillerTimeSlot,
  MaterializedRedirectTimeSlot,
  MaterializedSchedule,
  MaterializedSlot,
  MaterializedTimeSlot,
} from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { uniqBy } from 'lodash-es';
import { match } from 'ts-pattern';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { dbChannelToApiChannel } from '../db/converters/channelConverters.ts';
import { ServerContext } from '../ServerContext.ts';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { isShowProgramSearchDocument } from '../util/search.ts';

type GetMaterializedChannelScheduleRequest = {
  channelId: string;
};

@injectable()
export class GetMaterializedChannelScheduleCommand {
  constructor(
    @inject(ServerContext) private serverContext: ServerContext,
    @inject(KEYS.Logger) private logger: Logger,
  ) {}

  async execute(
    request: GetMaterializedChannelScheduleRequest,
  ): Promise<Maybe<MaterializedSchedule>> {
    const lineup = await this.serverContext.channelDB.loadLineup(
      request.channelId,
    );
    const schedule = lineup.schedule;

    if (!schedule) {
      return;
    }

    if (schedule.type === 'time') {
      const slotsByType = seq.groupBy(schedule.slots, (slot) => slot.type);

      const materializedShows = await this.materializeShows(
        uniqBy(
          slotsByType.show?.filter((slot) => slot.type === 'show'),
          (slot) => slot.showId,
        ).map((slot) => slot.showId),
      );

      const materializedFiller = await this.materializeFiller(
        uniqBy(
          slotsByType.filler?.filter((slot) => slot.type === 'filler'),
          (slot) => slot.fillerListId,
        ).map((slot) => slot.fillerListId),
      );

      const materializedCustomShows = await this.materializeCustomShows(
        uniqBy(
          slotsByType['custom-show']?.filter(
            (slot) => slot.type === 'custom-show',
          ),
          (slot) => slot.customShowId,
        ).map((slot) => slot.customShowId),
      );

      const redirectSlots =
        slotsByType['redirect']?.filter((slot) => slot.type === 'redirect') ??
        [];
      const channels =
        redirectSlots.length === 0
          ? {}
          : await this.serverContext.channelDB.loadAllLineupConfigs();

      const materializedSlots = schedule.slots.map((slot) => {
        return match(slot)
          .returnType<MaterializedTimeSlot>()
          .with({ type: 'show' }, (showSlot) => {
            const show = materializedShows[showSlot.showId];
            if (!show) {
              throw new Error(
                `Could not materialize show with ID ${showSlot.showId} from schedule!`,
              );
            }
            return {
              ...showSlot,
              show,
            };
          })
          .with({ type: 'filler' }, (slot) => {
            const filler = materializedFiller[slot.fillerListId];
            if (!filler) {
              throw new Error(
                `Could not materialize filler with ID ${slot.fillerListId} from schedule!`,
              );
            }
            return {
              ...slot,
              fillerList: {
                contentCount: filler.contentCount,
                id: filler.uuid,
                name: filler.name,
              },
            } satisfies MaterializedFillerTimeSlot;
          })
          .with({ type: 'custom-show' }, (slot) => {
            const customShow = materializedCustomShows[slot.customShowId];
            if (!customShow) {
              throw new Error(
                `Could not materialize custom show with ID ${slot.customShowId} from schedule!`,
              );
            }
            return {
              ...slot,
              customShow: {
                ...customShow,
                id: customShow.uuid,
              },
            } satisfies MaterializedCustomShowTimeSlot;
          })
          .with({ type: 'redirect' }, (slot) => {
            const channel = channels[slot.channelId];
            if (!channel) {
              throw new Error(
                `Could not materialize redirect channel with ID ${slot.channelId} from schedule!`,
              );
            }
            return {
              ...slot,

              channel: dbChannelToApiChannel(channel),
            } satisfies MaterializedRedirectTimeSlot;
          })
          .otherwise((slot) => slot);
      });

      return {
        ...schedule,
        slots: materializedSlots,
      };
    } else {
      const slotsByType = seq.groupBy(schedule.slots, (slot) => slot.type);

      const materializedShows = await this.materializeShows(
        uniqBy(
          slotsByType.show?.filter((slot) => slot.type === 'show'),
          (slot) => slot.showId,
        ).map((slot) => slot.showId),
      );

      const materializedFiller = await this.materializeFiller(
        uniqBy(
          slotsByType.filler?.filter((slot) => slot.type === 'filler'),
          (slot) => slot.fillerListId,
        ).map((slot) => slot.fillerListId),
      );

      const materializedCustomShows = await this.materializeCustomShows(
        uniqBy(
          slotsByType['custom-show']?.filter(
            (slot) => slot.type === 'custom-show',
          ),
          (slot) => slot.customShowId,
        ).map((slot) => slot.customShowId),
      );

      const redirectSlots =
        slotsByType['redirect']?.filter((slot) => slot.type === 'redirect') ??
        [];
      const channels =
        redirectSlots.length === 0
          ? {}
          : await this.serverContext.channelDB.loadAllLineupConfigs();

      const materializedSlots = schedule.slots.map((slot) => {
        return match(slot)
          .returnType<MaterializedSlot>()
          .with({ type: 'show' }, (showSlot) => {
            const show = materializedShows[showSlot.showId];
            if (!show) {
              throw new Error(
                `Could not materialize show with ID ${showSlot.showId} from schedule!`,
              );
            }
            return {
              ...showSlot,
              show,
            };
          })
          .with({ type: 'filler' }, (slot) => {
            const filler = materializedFiller[slot.fillerListId];
            if (!filler) {
              throw new Error(
                `Could not materialize filler with ID ${slot.fillerListId} from schedule!`,
              );
            }
            return {
              ...slot,
              fillerList: {
                contentCount: filler.contentCount,
                id: filler.uuid,
                name: filler.name,
              },
            };
          })
          .with({ type: 'custom-show' }, (slot) => {
            const customShow = materializedCustomShows[slot.customShowId];
            if (!customShow) {
              throw new Error(
                `Could not materialize custom show with ID ${slot.customShowId} from schedule!`,
              );
            }
            return {
              ...slot,
              customShow: {
                ...customShow,
                id: customShow.uuid,
              },
            };
          })
          .with({ type: 'redirect' }, (slot) => {
            const channel = channels[slot.channelId];
            if (!channel) {
              throw new Error(
                `Could not materialize redirect channel with ID ${slot.channelId} from schedule!`,
              );
            }
            return {
              ...slot,
              channel: dbChannelToApiChannel(channel),
            };
          })
          .with({ type: 'smart-collection' }, (slot) => {
            return slot;
          })
          .otherwise((slot) => slot);
      });

      return {
        ...schedule,
        slots: materializedSlots,
      };
    }
  }

  private async materializeShows(showIds: string[]) {
    const showsFromDB =
      await this.serverContext.programDB.getProgramGroupings(showIds);
    const counts =
      await this.serverContext.programDB.getProgramGroupingChildCounts(showIds);
    const results = await this.serverContext.searchService.getPrograms(
      Object.keys(showsFromDB),
    );

    const resultsById = groupByUniq(results, (doc) => doc.id);

    const mediaSources = groupByUniq(
      await this.serverContext.mediaSourceDB.getAll(),
      (ms) => ms.uuid as string,
    );

    const showsById: Record<string, Show> = {};
    for (const [showId, dbShow] of Object.entries(showsFromDB)) {
      const searchDoc = resultsById[dbShow.uuid];

      if (searchDoc && !isShowProgramSearchDocument(searchDoc)) {
        continue;
      }

      const ms = mediaSources[dbShow.mediaSourceId ?? ''];
      if (!ms) {
        continue;
      }
      const lib = ms.libraries.find((lib) => lib.uuid === dbShow.libraryId);
      if (!lib) {
        continue;
      }

      const converted = ApiProgramConverters.convertProgramGroupingDBResult(
        dbShow,
        searchDoc,
        counts[dbShow.uuid],
        ms,
        lib,
      );

      // This should always be true.
      if (converted?.type === 'show') {
        showsById[showId] = converted;
      }
    }

    return showsById;
  }

  private async materializeFiller(fillerIds: string[]) {
    const filler =
      await this.serverContext.fillerDB.getFillerListsByIds(fillerIds);
    return groupByUniq(filler, (filler) => filler.uuid);
  }

  private async materializeCustomShows(showIds: string[]) {
    const customShows = await this.serverContext.customShowDB.getShows(showIds);
    return groupByUniq(customShows, (cs) => cs.uuid);
  }
}
