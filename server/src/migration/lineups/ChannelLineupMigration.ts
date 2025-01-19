import { ChannelDB } from '@/db/ChannelDB.js';
import { Lineup } from '@/db/derived_types/Lineup.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import { Migration } from '@/migration/Migration.js';

export abstract class ChannelLineupMigration<
  From extends number,
  To extends number,
> implements Migration<Lineup, From, To>
{
  constructor(
    protected channelDB: ChannelDB,
    protected programDB: ProgramDB,
  ) {}

  abstract from: From;
  abstract to: To;
  abstract migrate(schema: Lineup): Promise<void>;
}
