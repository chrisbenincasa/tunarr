import {
  MaterializedFillerScheduleSlot,
  MaterializedRedirectScheduleSlot,
  MaterializedScheduleSlot,
  MaterializedShowScheduleSlot,
} from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { match } from 'ts-pattern';
import { slotDaoToDto } from '../api/converters/scheduleConverters.ts';
import { InfiniteScheduleDB } from '../db/InfiniteScheduleDB.ts';
import { MaterializeSlotHelper } from '../services/scheduling/MaterializeSlotHelper.ts';
import { GenericNotFoundError } from '../types/errors.ts';
import { KEYS } from '../types/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { Command } from './Command.ts';

type Request = {
  slotId: string;
};

@injectable()
export class MaterializeScheduleSlotCommand
  implements Command<Request, MaterializedScheduleSlot>
{
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(InfiniteScheduleDB) private infiniteScheduleDB: InfiniteScheduleDB,
    @inject(MaterializeSlotHelper)
    private materializeSlotHelper: MaterializeSlotHelper,
  ) {}

  async run(request: Request): Promise<MaterializedScheduleSlot> {
    const slot = await this.infiniteScheduleDB.getSlot(request.slotId);
    if (!slot) {
      throw new GenericNotFoundError(request.slotId, 'slot');
    }

    const x = await match(slotDaoToDto(slot))
      .returnType<Promise<MaterializedScheduleSlot>>()
      .with({ type: 'show' }, async (showSlot) => {
        const materializedShow = (
          await this.materializeSlotHelper.materializeShows([showSlot.showId])
        )[showSlot.showId];
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
      .with({ type: 'filler' }, async (slot) => {
        const filler = await this.materializeSlotHelper.materializeFiller(
          slot.fillerListId,
        );
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
        const customShow = this.materializeSlotHelper.materializeCustomShows materializedCustomShows[slot.customShowId];
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
      .otherwise((slot) => slot);
    // .otherwise(() =>
    //   Promise.reject(
    //     new Error(
    //       `Could not materialize slot of type ${slot.slotType} because it was invalid: ${JSON.stringify(slot)}`,
    //     ),
    //   ),
    // );
  }
}
