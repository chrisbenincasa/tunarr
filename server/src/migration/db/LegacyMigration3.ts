import type { Kysely } from 'kysely';
import type { TunarrDatabaseMigrationLegacy } from '../DirectMigrationProvider.ts';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('plex_server_settings')
      .addColumn('client_identifier', 'text')
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('plex_server_settings')
      .dropColumn('client_identifier')
      .execute();
  },
  kyselyOnly: true,
} satisfies TunarrDatabaseMigrationLegacy;
