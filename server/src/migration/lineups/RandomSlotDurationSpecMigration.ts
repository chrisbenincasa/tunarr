import { ChannelLineupMigration } from '@/migration/lineups/ChannelLineupMigration.js';
import { inject, injectable } from 'inversify';
import { isArray, isUndefined } from 'lodash-es';
import { KEYS } from '../../types/inject.ts';
import { isJsonObject, Json, JsonObject } from '../../types/schemas.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';

@injectable()
export class RandomSlotDurationSpecMigration extends ChannelLineupMigration<
  2,
  3
> {
  readonly from = 2;
  readonly to = 3;

  constructor(@inject(KEYS.Logger) private logger: Logger) {
    super();
  }

  migrate(schema: JsonObject): Promise<void> {
    if (!schema.schedule) {
      return Promise.resolve();
    }

    if (schema.schedule['type'] === 'time') {
      return Promise.resolve();
    }

    const slots = schema['schedule']['slots'] as Json;
    if (!isArray(slots)) {
      this.logger.warn('Malformed slot schedule: %s', JSON.stringify(slots));
      return Promise.resolve();
    }

    slots.forEach((slot) => {
      if (!isJsonObject(slot)) {
        return;
      }

      if (isUndefined(slot.durationMs)) {
        return;
      }

      slot.durationSpec = {
        type: 'fixed',
        durationMs: slot.durationMs,
      };
    });

    return Promise.resolve();
  }
}
