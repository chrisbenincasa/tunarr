import type { Kysely } from 'kysely';
import type { TunarrDatabaseMigrationLegacy } from '../DirectMigrationProvider.ts';
import { columnExists } from './util.ts';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('channel')
      .addColumn('guide_flex_title', 'text')
      .execute();
  },
  async down(db) {
    if (await columnExists(db, 'channel', 'guide_flex_title')) {
      await db.schema
        .alterTable('channel')
        .dropColumn('guide_flex_title')
        .execute();
    }
  },
  kyselyOnly: true,
} satisfies TunarrDatabaseMigrationLegacy;
