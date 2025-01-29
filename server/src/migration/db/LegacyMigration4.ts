import type { Kysely } from 'kysely';
import { columnExists } from './util.ts';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema.alterTable('program').dropColumn('custom_order').execute();

    await db.schema
      .alterTable('program')
      .addColumn('album_name', 'text')
      .execute();

    await db.schema
      .alterTable('program')
      .addColumn('artist_name', 'text')
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('program')
      .addColumn('custom_order', 'integer')
      .execute();

    if (await columnExists(db, 'program', 'artist_name')) {
      await db.schema.alterTable('program').dropColumn('artist_name').execute();
    }
    if (await columnExists(db, 'program', 'album_name')) {
      await db.schema.alterTable('program').dropColumn('album_name').execute();
    }
  },
};
