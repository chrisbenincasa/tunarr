import { DBAccess } from '@/db/DBAccess.js';
import { isNonEmptyString } from '@/util/index.js';
import type { CommandModule } from 'yargs';
import { isWrongMigrationDirection } from './databaseCommandUtil.ts';

interface DatabaseMigrateUpCommandArgs {
  migrationName?: string;
}

export const DatabaseMigrateUpCommand: CommandModule<
  DatabaseMigrateUpCommandArgs,
  DatabaseMigrateUpCommandArgs
> = {
  command: 'up [migrationName]',
  describe: 'Apply the next run or up to the specificed migration',
  builder: (yargs) =>
    yargs.positional('migrationName', { demandOption: false, type: 'string' }),
  handler: async (args) => {
    const migrator = new DBAccess().getOrCreateConnection().getMigrator();
    if (await isWrongMigrationDirection(args.migrationName, 'up', migrator)) {
      console.warn(
        `Migration skipped: "${args.migrationName}" has already been run`,
      );
      return;
    }

    console.info('Starting migration up');

    const resultSet = isNonEmptyString(args.migrationName)
      ? await migrator.migrateTo(args.migrationName)
      : await migrator.migrateUp();

    console.log(resultSet);
  },
};
