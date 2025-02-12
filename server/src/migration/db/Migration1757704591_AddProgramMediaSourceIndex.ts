import { type Kysely } from 'kysely';
import { processSqlMigrationFile } from './util.ts';

export default {
  // fullCopy: true,

  async up(db: Kysely<unknown>) {
    for (const statement of await processSqlMigrationFile(
      './sql/0011_stormy_stark_industries.sql',
    )) {
      await db.executeQuery(statement);
    }
  },
};
