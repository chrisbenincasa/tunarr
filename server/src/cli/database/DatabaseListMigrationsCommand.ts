import { DBAccess } from '@/db/DBAccess.js';
import { isEmpty } from 'lodash-es';
import type { CommandModule } from 'yargs';

export const DatabaseListMigrationsCommand: CommandModule = {
  command: 'list',
  describe: 'Tunarr database migration commands',

  handler: async () => {
    const migrator = new DBAccess().getOrCreateConnection().getMigrator();
    const migrations = await migrator.getMigrations();
    if (isEmpty(migrations)) {
      console.info('No migrations found!');
      return;
    }

    console.info(
      `Found ${migrations.length} migration${migrations.length > 1 ? 's' : ''}`,
    );

    for (const migration of migrations) {
      console.log(`${migration.executedAt ? '✓' : ' '} ${migration.name}`);
    }
  },
};
