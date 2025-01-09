import { Lineup } from '@/db/derived_types/Lineup.ts';
import { ChannelLineupMigration } from '@/migration/lineups/ChannelLineupMigration.ts';
import { isUndefined } from 'lodash-es';

export class RandomSlotDurationSpecMigration extends ChannelLineupMigration<
  1,
  2
> {
  readonly from = 1;
  readonly to = 2;

  migrate(schema: Lineup): Promise<void> {
    if (!schema.schedule) {
      return Promise.resolve();
    }

    if (schema.schedule.type === 'time') {
      return Promise.resolve();
    }

    schema.schedule.slots.forEach((slot) => {
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
