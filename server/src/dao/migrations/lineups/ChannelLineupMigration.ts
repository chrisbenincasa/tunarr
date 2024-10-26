import { ChannelDB } from '../../channelDb.ts';
import { Lineup } from '../../derived_types/Lineup.ts';
import { ProgramDB } from '../../programDB.ts';
import { Migration } from '../Migration.ts';

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
