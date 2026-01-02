import type { TunarrDBMigration } from './util.ts';
import { processSqlMigrationFile } from './util.ts';

export default {
  up: async (db) => {
    for (const statement of await processSqlMigrationFile(
      './sql/0033_free_nekra.sql',
    )) {
      await db.executeQuery(statement);
    }

    for (const statement of await processSqlMigrationFile(
      './sql/0034_cooing_bloodscream.sql',
    )) {
      await db.executeQuery(statement);
    }

    for (const statement of await processSqlMigrationFile(
      './sql/0035_military_ben_grimm.sql',
    )) {
      await db.executeQuery(statement);
    }
  },
  fullCopy: false,
} satisfies TunarrDBMigration;
