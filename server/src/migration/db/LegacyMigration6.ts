import { Kysely, Migration } from 'kysely';
import { DB } from '../../db/schema/db.ts';

export default {
  async up(db: Kysely<DB>): Promise<void> {
    await db
      .updateTable('program')
      .set(({ ref }) => ({
        externalKey: ref('plexRatingKey').$notNull(),
      }))
      .where('plexRatingKey', 'is not', null)
      .execute();
  },
} satisfies Migration;
