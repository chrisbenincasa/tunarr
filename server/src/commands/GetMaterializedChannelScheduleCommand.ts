import { seq } from '@tunarr/shared/util';
import { Show } from '@tunarr/types';
import {
  MaterializedCustomShowRandomSlot,
  MaterializedCustomShowTimeSlot,
  MaterializedFillerTimeSlot,
  MaterializedRedirectTimeSlot,
  MaterializedSchedule,
  MaterializedSlot,
  MaterializedTimeSlot,
  RandomSlot,
  TimeSlot,
} from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { uniq } from 'lodash-es';
import { match } from 'ts-pattern';
import { ormChannelToApiChannel } from '../db/converters/channelConverters.ts';
import { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import { ServerContext } from '../ServerContext.ts';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
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

      const [
        materializedShows,
        materializedFiller,
        materializedCustomShows,
        smartCollections,
      ] = await Promise.all([
        this.materializeShows(
          uniq(
            getTimeSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'show',
              (show) => show.showId,
            ),
          ),
        ),
        this.materializeFiller(
          uniq(
            getTimeSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'filler',
              (filler) => filler.fillerListId,
            ),
          ),
        ),
        this.materializeCustomShows(
          uniq(
            getTimeSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'custom-show',
              (cs) => cs.customShowId,
            ),
          ),
        ),
        this.materializeSmartCollections(
          uniq(
            getTimeSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'smart-collection',
              (sc) => sc.smartCollectionId,
            ),
          ),
        ),
      ]);

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
            const materializedShow = materializedShows[showSlot.showId];
            if (
              !materializedShow ||
              !materializedShow.show ||
              materializedShow.raw.state === 'missing'
            ) {
              this.logger.error(
                `Could not materialize show with ID ${showSlot.showId} from schedule!`,
              );
              return {
                ...showSlot,
                show: null,
                missingShow: {
                  title: materializedShow?.raw.title,
                },
              } satisfies MaterializedTimeSlot;
            }

            return {
              ...showSlot,
              show: materializedShow.show,
            };
          })
          .with({ type: 'filler' }, (slot) => {
            const filler = materializedFiller[slot.fillerListId];
            if (!filler) {
              this.logger.warn(
                'Filler with ID %s not found in database, but it scheduled in a time slot',
                slot.fillerListId,
              );
            }
            return {
              ...slot,
              fillerList: filler
                ? {
                    contentCount: filler.contentCount,
                    id: filler.uuid,
                    name: filler.name,
                  }
                : null,
              isMissing: !filler,
            } satisfies MaterializedFillerTimeSlot;
          })
          .with({ type: 'custom-show' }, (slot) => {
            const customShow = materializedCustomShows[slot.customShowId];
            if (!customShow) {
              this.logger.warn(
                'Custom show with ID %s not found in database, but is scheduled in a time slot',
                slot.customShowId,
              );
            }
            return {
              ...slot,
              customShow: customShow
                ? {
                    ...customShow,
                    id: customShow.uuid,
                  }
                : null,
              isMissing: !customShow,
            } satisfies MaterializedCustomShowTimeSlot;
          })
          .with({ type: 'redirect' }, (slot) => {
            const channel = channels[slot.channelId];
            if (!channel) {
              this.logger.warn(
                'Channel with ID %s not found in database, but is scheduled in a slot',
              );
            }
            return {
              ...slot,
              channel: channel ? ormChannelToApiChannel(channel) : null,
              isMissing: !channel,
            } satisfies MaterializedRedirectTimeSlot;
          })
          .with({ type: 'smart-collection' }, (slot) => {
            return {
              ...slot,
              smartCollection: smartCollections[slot.smartCollectionId] ?? null,
              isMissing: !smartCollections[slot.smartCollectionId],
            };
          })
          .otherwise((slot) => slot);
      });

      return {
        ...schedule,
        slots: materializedSlots,
      };
    } else {
      const slotsByType = seq.groupBy(schedule.slots, (slot) => slot.type);
      const [
        materializedShows,
        materializedFiller,
        materializedCustomShows,
        smartCollections,
      ] = await Promise.all([
        this.materializeShows(
          uniq(
            getSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'show',
              (show) => show.showId,
            ),
          ),
        ),
        this.materializeFiller(
          uniq(
            getSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'filler',
              (filler) => filler.fillerListId,
            ),
          ),
        ),
        this.materializeCustomShows(
          uniq(
            getSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'custom-show',
              (cs) => cs.customShowId,
            ),
          ),
        ),
        this.materializeSmartCollections(
          uniq(
            getSlotIdsForType(
              schedule.slots,
              (slot) => slot.type === 'smart-collection',
              (sc) => sc.smartCollectionId,
            ),
          ),
        ),
      ]);

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
            const materializedShow = materializedShows[showSlot.showId];
            if (
              !materializedShow ||
              !materializedShow.show ||
              materializedShow.raw.state === 'missing'
            ) {
              this.logger.error(
                `Could not materialize show with ID ${showSlot.showId} from schedule!`,
              );
              return {
                ...showSlot,
                show: null,
                missingShow: {
                  title: materializedShow?.raw?.title,
                },
              } satisfies MaterializedSlot;
            }

            return {
              ...showSlot,
              show: materializedShow.show,
            };
          })
          .with({ type: 'filler' }, (slot) => {
            const filler = materializedFiller[slot.fillerListId];
            if (!filler) {
              this.logger.warn(
                'Filler with ID %s not found in database, but it scheduled in a slot',
                slot.fillerListId,
              );
            }
            return {
              ...slot,
              fillerList: filler
                ? {
                    contentCount: filler.contentCount,
                    id: filler.uuid,
                    name: filler.name,
                  }
                : null,
              isMissing: !filler,
            };
          })
          .with({ type: 'custom-show' }, (slot) => {
            const customShow = materializedCustomShows[slot.customShowId];
            if (!customShow) {
              this.logger.warn(
                'Custom show with ID %s not found in database, but is scheduled in a slot',
                slot.customShowId,
              );
            }
            return {
              ...slot,
              customShow: customShow
                ? {
                    ...customShow,
                    id: customShow.uuid,
                  }
                : null,
              isMissing: !customShow,
            } satisfies MaterializedCustomShowRandomSlot;
          })
          .with({ type: 'redirect' }, (slot) => {
            const channel = channels[slot.channelId];
            if (!channel) {
              this.logger.warn(
                'Channel with ID %s not found in database, but is scheduled in a slot',
              );
            }
            return {
              ...slot,
              channel: channel ? ormChannelToApiChannel(channel) : null,
              isMissing: !channel,
            };
          })
          .with({ type: 'smart-collection' }, (slot) => {
            return {
              ...slot,
              smartCollection: smartCollections[slot.smartCollectionId] ?? null,
              isMissing: !smartCollections[slot.smartCollectionId],
            };
          })
          .otherwise((slot) => slot);
      });

      return {
        ...schedule,
        slots: materializedSlots,
      };
    }
  }

  private async materializeShows(
    showIds: string[],
  ): Promise<Record<string, ShowAndRawShow>> {
    const showsFromDB =
      await this.serverContext.programDB.getProgramGroupings(showIds);

    const materialized = groupByUniq(
      await this.materializeProgramGroupings.execute(
        Object.values(showsFromDB),
      ),
      (group) => group.uuid,
    );

    const showsById: Record<string, ShowAndRawShow> = {};
    for (const [id, dbShow] of Object.entries(showsFromDB)) {
      if (dbShow.type !== 'show') {
        continue;
      }
      const materializedShow = materialized[id];
      showsById[id] = {
        show: materializedShow?.type === 'show' ? materializedShow : undefined,
        raw: dbShow,
      };
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

  private async materializeSmartCollections(smartCollections: string[]) {
    const collections =
      await this.serverContext.smartCollectionsDB.getByIds(smartCollections);
    return groupByUniq(collections, (coll) => coll.uuid);
  }
}

type ShowAndRawShow = {
  show: Maybe<Show>;
  raw: ProgramGroupingOrmWithRelations;
};

function getTimeSlotIdsForType<SlotTypeT extends TimeSlot>(
  slots: TimeSlot[],
  pred: (slot: TimeSlot) => slot is SlotTypeT,
  extractor: (slot: SlotTypeT) => string,
) {
  return slots.filter(pred).map(extractor);
}

function getSlotIdsForType<SlotTypeT extends RandomSlot>(
  slots: RandomSlot[],
  pred: (slot: RandomSlot) => slot is SlotTypeT,
  extractor: (slot: SlotTypeT) => string,
) {
  return slots.filter(pred).map(extractor);
}
