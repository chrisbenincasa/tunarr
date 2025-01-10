import { Lineup } from '@/db/derived_types/Lineup.js';
import { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { Migration } from '@/migration/Migration.js';

export abstract class ChannelLineupMigration<
  From extends number,
  To extends number,
> implements Migration<Lineup, From, To>
{
  constructor(
    protected channelDB: IChannelDB,
    protected programDB: IProgramDB,
  ) {}

  abstract from: From;
  abstract to: To;
  abstract migrate(schema: Lineup): Promise<void>;
}
