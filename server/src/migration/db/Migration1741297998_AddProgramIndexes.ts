import type { Kysely } from 'kysely';
import type { TunarrDatabaseMigrationLegacy } from '../DirectMigrationProvider.ts';

export default {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createIndex('program_external_id_program_uuid_index')
      .ifNotExists()
      .on('program_external_id')
      .column('program_uuid')
      .execute();
    await db.schema
      .createIndex('program_grouping_external_id_group_uuid_index')
      .ifNotExists()
      .on('program_grouping_external_id')
      .column('group_uuid')
      .execute();
  },
  kyselyOnly: true,
} satisfies TunarrDatabaseMigrationLegacy;
