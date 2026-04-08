import type { Kysely } from 'kysely';
import type { TunarrDatabaseMigrationLegacy } from '../DirectMigrationProvider.ts';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('program')
      .renameColumn('season', 'season_number')
      .execute();
  },
  async down(db) {
    await db.schema
      .alterTable('channel')
      .renameColumn('season_number', 'season')
      .execute();
  },
  kyselyOnly: true,
} satisfies TunarrDatabaseMigrationLegacy;
