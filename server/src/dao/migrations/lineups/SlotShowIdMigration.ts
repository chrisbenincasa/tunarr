import {
  ShowProgrammingRandomSlot,
  ShowProgrammingTimeSlot,
} from '@tunarr/types/api';
import { LoggerFactory } from '../../../util/logging/LoggerFactory';
import { Lineup } from '../../derived_types/Lineup';
import { ChannelLineupMigration } from './ChannelLineupMigration';

export class SlotShowIdMigration extends ChannelLineupMigration<0, 1> {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  readonly from = 0;
  readonly to = 1;

  async migrate(schema: Lineup): Promise<void> {
    // Nothing to do if we don't have a schedule.
    if (!schema.schedule) {
      return;
    }

    const slots = schema.schedule.slots;
    for (const slot of slots) {
      switch (slot.programming.type) {
        case 'show':
          await this.handleSlot(slot.programming);
          console.log(slot.programming);
          break;
        default:
          continue;
      }
    }

    return;
  }

  private async handleSlot(
    slot: ShowProgrammingTimeSlot | ShowProgrammingRandomSlot,
  ) {
    if (
      !slot.showId.match(
        /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      )
    ) {
      const id = await this.programDB.getShowIdFromTitle(slot.showId);
      if (id) {
        slot.showId = id;
      } else {
        this.#logger.warn('Could not find show_id for slot: %s', slot.showId);
      }
    }
  }
}
