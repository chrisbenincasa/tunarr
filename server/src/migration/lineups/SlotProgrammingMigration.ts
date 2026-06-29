import { injectable } from 'inversify';
import { isArray } from 'lodash-es';
import {
  isJsonObject,
  type Json,
  type JsonObject,
} from '../../types/schemas.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';

@injectable()
export class SlotProgrammingMigration extends ChannelLineupMigration<3, 4> {
  @InjectLogger() private declare readonly logger: Logger;

  readonly from = 3;
  readonly to = 4;

  migrate(lineup: JsonObject): Promise<void> {
    if (!lineup.schedule) {
      return Promise.resolve();
    }

    const slots = lineup['schedule']['slots'] as Json;
    if (!isArray(slots)) {
      this.logger.warn('Malformed slot schedule: %s', JSON.stringify(slots));
      return Promise.resolve();
    }

    const newSlots = slots.map((slot) => {
      if (!isJsonObject(slot)) {
        return;
      }

      if (!isJsonObject(slot['programming'])) {
        return;
      }

      const newSlot = {
        ...slot,
        ...slot['programming'],
      };
      delete newSlot['programming'];
      return newSlot;
    });

    lineup['schedule']['slots'] = newSlots;

    return Promise.resolve();
  }
}
