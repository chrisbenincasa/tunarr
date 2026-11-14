import { seq } from '@tunarr/shared/util';
import type { Show } from '@tunarr/types';
import type {
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
import { ormChannelToApiChannel } from '../db/converters/channelConverters.ts';
import type { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import { ServerContext } from '../ServerContext.ts';

import type { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { MaterializeProgramGroupings } from './MaterializeProgramGroupings.ts';

type GetMaterializedChannelScheduleRequest = {
  channelId: string;
};

@injectable()
export class GetMaterializedChannelScheduleCommand {
  @InjectLogger() declare private readonly logger: Logger;

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

      const materializedSlots = schedule.slots.map(
        (slot): MaterializedTimeSlot => {
          switch (slot.type) {
            case 'show': {
              const materializedShow = materializedShows[slot.showId];
              if (
                !materializedShow ||
                !materializedShow.show ||
                materializedShow.raw.state === 'missing'
              ) {
                this.logger.error(
                  `Could not materialize show with ID ${slot.showId} from schedule!`,
                );
                return {
                  ...slot,
                  show: null,
                  missingShow: {
                    title: materializedShow?.raw.title,
                  },
                } satisfies MaterializedTimeSlot;
              }

              return {
                ...slot,
                show: materializedShow.show,
              };
            }
            case 'filler': {
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
            }
            case 'custom-show': {
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
                      lastSyncedAt: customShow.lastSyncedAt?.getTime(),
                      isSyncing: false,
                    }
                  : null,
                isMissing: !customShow,
              } satisfies MaterializedCustomShowTimeSlot;
            }
            case 'redirect': {
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
            }
            case 'smart-collection': {
              return {
                ...slot,
                smartCollection:
                  smartCollections[slot.smartCollectionId] ?? null,
                isMissing: !smartCollections[slot.smartCollectionId],
              };
            }
            case 'flex':
              return slot;
          }
        },
      );

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

      const materializedSlots = schedule.slots.map((slot): MaterializedSlot => {
        switch (slot.type) {
          case 'show': {
            const materializedShow = materializedShows[slot.showId];
            if (
              !materializedShow ||
              !materializedShow.show ||
              materializedShow.raw.state === 'missing'
            ) {
              this.logger.error(
                `Could not materialize show with ID ${slot.showId} from schedule!`,
              );
              return {
                ...slot,
                show: null,
                missingShow: {
                  title: materializedShow?.raw?.title,
                },
              } satisfies MaterializedSlot;
            }

            return {
              ...slot,
              show: materializedShow.show,
            };
          }
          case 'filler': {
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
          }
          case 'custom-show': {
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
                    lastSyncedAt: customShow.lastSyncedAt?.getTime(),
                    isSyncing: false,
                  }
                : null,
              isMissing: !customShow,
            } satisfies MaterializedCustomShowRandomSlot;
          }
          case 'redirect': {
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
          }
          case 'smart-collection': {
            // MaterializedSlot has no smart collection variant, so a fresh
            // object literal here would fail the excess property check.
            const materialized = {
              ...slot,
              smartCollection: smartCollections[slot.smartCollectionId] ?? null,
              isMissing: !smartCollections[slot.smartCollectionId],
            };
            return materialized;
          }
          case 'flex':
            return slot;
        }
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
