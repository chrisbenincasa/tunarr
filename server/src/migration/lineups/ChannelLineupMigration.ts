import type { Migration } from '@/migration/Migration.js';
import { injectable } from 'inversify';
import type { JsonObject } from '../../types/schemas.ts';

@injectable()
export abstract class ChannelLineupMigration<
  From extends number,
  To extends number,
> implements Migration<JsonObject, From, To>
{
  abstract from: From;
  abstract to: To;
  abstract migrate(schema: JsonObject): Promise<void>;
}
