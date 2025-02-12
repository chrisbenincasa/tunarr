import { inject, injectable } from 'inversify';
import { isArray } from 'lodash-es';
import { KEYS } from '../../types/inject.ts';
import {
  isJsonObject,
  type Json,
  type JsonObject,
} from '../../types/schemas.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';

@injectable()
export class SlotProgrammingMigration extends ChannelLineupMigration<3, 4> {
  readonly from = 3;
  readonly to = 4;

  constructor(@inject(KEYS.Logger) private logger: Logger) {
    super();
  }

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
