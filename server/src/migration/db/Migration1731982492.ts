import type { Kysely, Migration } from 'kysely';
import { CompiledQuery } from 'kysely';
import type { CustomShowContent } from '../../db/schema/CustomShowContent.ts';

type DBTemp = {
  customShowContentTmp: CustomShowContent;
  customShowContent: CustomShowContent;
};

/**
 * This migration fixes a typo in the custom_show_content foreign key
 */
export default {
  async up(db: Kysely<DBTemp>) {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    await db.schema
      .createTable('custom_show_content_tmp')
      .ifNotExists()
      .ifNotExists()
      .addColumn('custom_show_uuid', 'text', (col) => col.notNull())
      .addColumn('content_uuid', 'text', (col) => col.notNull())
      .addColumn('index', 'integer', (col) => col.notNull())
      .addForeignKeyConstraint(
        'custom_show_content_custom_show_uuid_foreign',
        ['custom_show_uuid'],
        'custom_show',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'custom_show_content_content_uuid_foreign',
        ['content_uuid'],
        'program',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addPrimaryKeyConstraint('primary_key', [
        'custom_show_uuid',
        'content_uuid',
      ])
      .execute();

    await db
      .insertInto('customShowContentTmp')
      .columns(['contentUuid', 'customShowUuid', 'index'])
      .expression(
        db
          .selectFrom('customShowContent')
          .select(['contentUuid', 'customShowUuid', 'index']),
      )
      .execute();

    await db.schema.dropTable('custom_show_content').execute();
    await db.schema
      .alterTable('custom_show_content_tmp')
      .renameTo('custom_show_content')
      .execute();

    /**
     * create index `custom_show_content_custom_show_uuid_index` on `custom_show_content` (`custom_show_uuid`);
     */
    await db.schema
      .createIndex('custom_show_content_custom_show_uuid_index')
      .on('custom_show_content')
      .column('custom_show_uuid')
      .execute();

    /**
     * create index `custom_show_content_content_uuid_index` on `custom_show_content` (`content_uuid`);
     */
    await db.schema
      .createIndex('custom_show_content_content_uuid_index')
      .on('custom_show_content')
      .column('content_uuid')
      .execute();

    /**
     * create unique index `custom_show_content_custom_show_uuid_content_uuid_index_unique` on `custom_show_content` (`custom_show_uuid`, `content_uuid`, `index`);
     */
    await db.schema
      .createIndex(
        'custom_show_content_custom_show_uuid_content_uuid_index_unique',
      )
      .on('custom_show_content')
      .columns(['custom_show_uuid', 'content_uuid', 'index'])
      .unique()
      .execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },
} satisfies Migration;
