import type { Kysely } from 'kysely';
import type { TunarrDatabaseMigrationLegacy } from '../DirectMigrationProvider.ts';

export default {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createIndex('media_source_type_name_uri_unique')
      .ifNotExists()
      .on('media_source')
      .columns(['type', 'name', 'uri'])
      .unique()
      .execute();
  },
  kyselyOnly: true,
} satisfies TunarrDatabaseMigrationLegacy;
