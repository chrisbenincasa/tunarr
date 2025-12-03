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
import { ormChannelToApiChannel } from '../db/converters/channelConverters.ts';
import { ServerContext } from '../ServerContext.ts';
import { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { MaterializeProgramGroupings } from './MaterializeProgramGroupings.ts';

type GetMaterializedChannelScheduleRequest = {
  channelId: string;
};

@injectable()
export class GetMaterializedChannelScheduleCommand {
  constructor(
    @inject(ServerContext) private serverContext: ServerContext,
    @inject(MaterializeProgramGroupings)
    private materializeProgramGroupings: MaterializeProgramGroupings,
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

              channel: ormChannelToApiChannel(channel),
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
              channel: ormChannelToApiChannel(channel),
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

    const materialized = await this.materializeProgramGroupings.execute(
      Object.values(showsFromDB),
    );

    const showsById: Record<string, Show> = {};
    for (const grouping of materialized) {
      if (grouping.type !== 'show') {
        continue;
      }
      showsById[grouping.uuid] = grouping;
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
