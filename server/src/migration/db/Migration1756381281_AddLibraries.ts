import { type Kysely } from 'kysely';
import { processSqlMigrationFile } from './util.ts';

export default {
  fullCopy: true,

  async up(db: Kysely<unknown>) {
    for (const statement of await processSqlMigrationFile(
      './sql/0010_lazy_nova.sql',
    )) {
      await db.executeQuery(statement);
    }
  },
};
