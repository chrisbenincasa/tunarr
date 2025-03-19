import type { CommandModule } from 'yargs';
import { container } from '../../container.ts';
import { DBAccess } from '../../db/DBAccess.ts';
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
    await container
      .get(DBAccess)
      .migrateExistingDatabase(getDefaultDatabaseName());
  },
};
