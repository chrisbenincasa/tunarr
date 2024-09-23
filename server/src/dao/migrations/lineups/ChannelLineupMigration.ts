import { ChannelDB } from '../../channelDb';
import { Lineup } from '../../derived_types/Lineup';
import { ProgramDB } from '../../programDB';
import { Migration } from '../Migration';

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
