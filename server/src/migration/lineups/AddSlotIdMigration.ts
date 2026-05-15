import { seq } from '@tunarr/shared/util';
import { BaseSlot, slotIsLinkable } from '@tunarr/types/api';
import { injectable } from 'inversify';
import { isArray } from 'lodash-es';
import { v4 } from 'uuid';
import { Json, JsonObject, isJsonObject } from '../../types/schemas.ts';
import { InjectLogger } from '../../util/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';

@injectable()
export class AddSlotIdMigration extends ChannelLineupMigration<4, 5> {
  @InjectLogger() declare private readonly logger: Logger;

  readonly from = 4;
  readonly to = 5;

  migrate(lineup: JsonObject): Promise<void> {
    if (!lineup.schedule) {
      return Promise.resolve();
    }

    const slots = lineup['schedule']['slots'] as Json;
    if (!isArray(slots)) {
      this.logger.warn('Malformed slot schedule: %s', JSON.stringify(slots));
      return Promise.resolve();
    }

    const newSlots = seq.collect(slots, (slot) => {
      if (!isJsonObject(slot)) {
        return;
      }

      const slotType = slot['type'];
      if (!slotIsLinkable(slotType as BaseSlot['type'])) {
        return slot;
      }

      return {
        ...slot,
        id: v4(),
      };
    });

    lineup['schedule']['slots'] = newSlots;

    return Promise.resolve();
  }
}
