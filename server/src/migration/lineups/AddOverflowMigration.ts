import { injectable } from 'inversify';
import { JsonObject } from '../../types/schemas.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';

@injectable()
export class AddOverflowMigration extends ChannelLineupMigration<5, 6> {
  readonly from = 5;
  readonly to = 6;

  migrate(lineup: JsonObject): Promise<void> {
    const schedule = lineup['schedule'] as JsonObject | undefined;
    if (!schedule || schedule['type'] !== 'time') {
      return Promise.resolve();
    }

    schedule['overflow'] = { type: 'duration', maxMs: 0 };

    return Promise.resolve();
  }
}
