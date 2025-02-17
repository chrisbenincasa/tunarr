import type { CommandModule } from 'yargs';
import { DatabaseCopyMigrator } from '../../migration/db/DatabaseCopyMigrator.ts';
import { getDefaultDatabaseName } from '../../util/defaults.ts';

interface DatabaseMigrateUpCommandArgs {
  migrationName?: string;
}

export const DatabaseMigrateToLatestCommand: CommandModule<
  DatabaseMigrateUpCommandArgs,
  DatabaseMigrateUpCommandArgs
> = {
  command: 'sync',
  describe: 'Apply the next run or up to the specificed migration',
  builder: (yargs) =>
    yargs.positional('migrationName', { demandOption: false, type: 'string' }),
  handler: async () => {
    await new DatabaseCopyMigrator().migrate(getDefaultDatabaseName());
  },
};
