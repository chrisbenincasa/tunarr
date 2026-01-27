import { ormChannelToApiChannel } from '@/db/converters/channelConverters.js';
import { seq } from '@tunarr/shared/util';
import { Show } from '@tunarr/types';
import {
  MaterializedCustomShowScheduleSlot,
  MaterializedFillerScheduleSlot,
  MaterializedRedirectScheduleSlot,
  MaterializedSchedule2,
  MaterializedScheduleSlot,
  MaterializedShowScheduleSlot,
  ScheduleSlot,
} from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { uniq } from 'lodash-es';
import { match } from 'ts-pattern';
import {
  scheduleDaoToDto,
  slotDaoToDto,
} from '../api/converters/scheduleConverters.ts';
import { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import { ServerContext } from '../ServerContext.ts';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { MaterializeProgramGroupings } from './MaterializeProgramGroupings.ts';

type MaterializeScheduleRequest = {
  scheduleId: string;
};

@injectable()
export class MaterializeScheduleCommand {
  constructor(
    @inject(ServerContext) private serverContext: ServerContext,
    @inject(MaterializeProgramGroupings)
    private materializeProgramGroupings: MaterializeProgramGroupings,
    @inject(KEYS.Logger) private logger: Logger,
  ) {}

  async execute(
    request: MaterializeScheduleRequest,
  ): Promise<Maybe<MaterializedSchedule2>> {
    const schedule = await this.serverContext.infiniteScheduleDB.getSchedule(
      request.scheduleId,
    );

    if (!schedule) {
      return;
    }

    const slots = schedule.slots.map(slotDaoToDto);
    const slotsByType = seq.groupBy(slots, (slot) => slot.type);

    const [
      materializedShows,
      materializedFiller,
      materializedCustomShows,
      smartCollections,
    ] = await Promise.all([
      this.materializeShows(
        uniq(
          getSlotIdsForType(
            slots,
            (slot) => slot.type === 'show',
            (show) => show.showId,
          ),
        ),
      ),
      this.materializeFiller(
        uniq(
          getSlotIdsForType(
            slots,
            (slot) => slot.type === 'filler',
            (filler) => filler.fillerListId,
          ),
        ),
      ),
      this.materializeCustomShows(
        uniq(
          getSlotIdsForType(
            slots,
            (slot) => slot.type === 'custom-show',
            (cs) => cs.customShowId,
          ),
        ),
      ),
      this.materializeSmartCollections(
        uniq(
          getSlotIdsForType(
            slots,
            (slot) => slot.type === 'smart-collection',
            (sc) => sc.smartCollectionId,
          ),
        ),
      ),
    ]);

    const redirectSlots =
      slotsByType['redirect']?.filter((slot) => slot.type === 'redirect') ?? [];
    const channels =
      redirectSlots.length === 0
        ? {}
        : await this.serverContext.channelDB.loadAllLineupConfigs();

    const materializedSlots = seq.collect(slots, (slot) => {
      return (
        match(slot)
          .returnType<MaterializedScheduleSlot | null>()
          // TODO: We probably don't want movie slots anymore
          .with({ type: 'movie' }, () => null)
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
              } satisfies MaterializedShowScheduleSlot;
            }

            return {
              ...showSlot,
              show: materializedShow.show,
            } satisfies MaterializedShowScheduleSlot;
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
            } satisfies MaterializedFillerScheduleSlot;
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
            } satisfies MaterializedCustomShowScheduleSlot;
          })
          .with({ type: 'redirect' }, (slot) => {
            const channel = channels[slot.redirectChannelId];
            if (!channel) {
              this.logger.warn(
                'Channel with ID %s not found in database, but is scheduled in a slot',
              );
            }
            return {
              ...slot,
              channel: channel ? ormChannelToApiChannel(channel) : null,
              isMissing: !channel,
            } satisfies MaterializedRedirectScheduleSlot;
          })
          .with({ type: 'smart-collection' }, (slot) => {
            return {
              ...slot,
              smartCollection: smartCollections[slot.smartCollectionId] ?? null,
              isMissing: !smartCollections[slot.smartCollectionId],
            };
          })
          .otherwise((slot) => slot)
      );
    });

    return {
      ...scheduleDaoToDto(schedule),
      slots: materializedSlots,
    } satisfies MaterializedSchedule2;
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

function getSlotIdsForType<SlotTypeT extends ScheduleSlot>(
  slots: ScheduleSlot[],
  pred: (slot: ScheduleSlot) => slot is SlotTypeT,
  extractor: (slot: SlotTypeT) => string,
) {
  return slots.filter(pred).map(extractor);
}
