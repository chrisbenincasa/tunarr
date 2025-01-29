import type { Kysely, Migration } from 'kysely';
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
} satisfies Migration;
