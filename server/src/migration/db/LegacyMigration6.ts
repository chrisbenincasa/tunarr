import type { DB } from '@/db/schema/db.js';
import type { Kysely } from 'kysely';
import type { TunarrDatabaseMigrationLegacy } from '../DirectMigrationProvider.ts';

export default {
  async up(db: Kysely<DB>): Promise<void> {
    await db
      .updateTable('program')
      // eslint-disable-next-line @typescript-eslint/unbound-method
      .set(({ ref }) => ({
        externalKey: ref('plexRatingKey').$notNull(),
      }))
      .where('plexRatingKey', 'is not', null)
      .execute();
  },
  kyselyOnly: true,
} satisfies TunarrDatabaseMigrationLegacy;
