import { ChannelLineupMigration } from '@/migration/lineups/ChannelLineupMigration.js';
import { injectable } from 'inversify';
import { isArray, isUndefined } from 'lodash-es';
import { isJsonObject, Json, JsonObject } from '../../types/schemas.ts';
import { InjectLogger } from '../../util/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';

@injectable()
export class RandomSlotDurationSpecMigration extends ChannelLineupMigration<
  2,
  3
> {
  @InjectLogger() private declare readonly logger: Logger;

  readonly from = 2;
  readonly to = 3;

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
