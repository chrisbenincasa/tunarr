import { DBAccess } from '@/db/DBAccess.js';
import { isNonEmptyString } from '@/util/index.js';
import type { CommandModule } from 'yargs';
import { isWrongMigrationDirection } from './databaseCommandUtil.ts';

interface DatabaseMigrateDownCommandArgs {
  migrationName?: string;
}

export const DatabaseMigrateDownCommand: CommandModule<
  DatabaseMigrateDownCommandArgs,
  DatabaseMigrateDownCommandArgs
> = {
  command: 'down [migrationName]',
  describe: 'Undo the last run or specificed migration',
  builder: (yargs) =>
    yargs.positional('migrationName', { demandOption: false, type: 'string' }),

  handler: async (args) => {
    const migrator = new DBAccess().getOrCreateConnection().getMigrator();
    if (await isWrongMigrationDirection(args.migrationName, 'down', migrator)) {
      console.info('No migrations found!');
      return;
    }

    console.info('Starting migration down');

    const resultSet = isNonEmptyString(args.migrationName)
      ? await migrator.migrateTo(args.migrationName)
      : await migrator.migrateDown();

    console.log(resultSet);
  },
};
