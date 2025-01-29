import type { Kysely, Migration } from 'kysely';
import { columnExists } from './util.ts';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    /**
     * alter table `filler_show_content`
     *  add column `index` integer not null
     *  constraint `filler_show_content_filler_show_uuid_foreign` references `filler_show` (`uuid`) on update cascade
     *  constraint `filler_show_content_program_uuid_foreign` references `program` (`uuid`) on update cascade;
     */
    await db.schema
      .alterTable('filler_show_content')
      .addColumn('index', 'integer', (col) => col.notNull())
      .execute();

    /**
     * create unique index `filler_show_content_filler_show_uuid_program_uuid_index_unique` on `filler_show_content` (`filler_show_uuid`, `program_uuid`, `index`);
     */

    await db.schema
      .createIndex(
        'filler_show_content_filler_show_uuid_program_uuid_index_unique',
      )
      .on('filler_show_content')
      .columns(['filler_show_uuid', 'program_uuid', 'index'])
      .unique()
      .execute();
  },
  async down(db) {
    if (await columnExists(db, 'filler_show_content', 'index')) {
      await db.schema
        .alterTable('filler_show_content')
        .dropColumn('index')
        .execute();
    }

    await db.schema
      .dropIndex(
        'filler_show_content_filler_show_uuid_program_uuid_index_unique',
      )
      .ifExists()
      .execute();
  },
} satisfies Migration;
