import type { Kysely, Migration } from 'kysely';
import { CompiledQuery } from 'kysely';
import type { ChannelFillerShowTable } from '../../db/schema/ChannelFillerShow.ts';

type DBTemp = {
  channelFillerShowTmp: ChannelFillerShowTable;
  channelFillerShow: ChannelFillerShowTable;
};

/**
 * This migration fixes a typo in the channel_filler_show foreign key
 */
export default {
  async up(db: Kysely<DBTemp>) {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    await db.schema
      .createTable('channel_filler_show_tmp')
      .ifNotExists()
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('filler_show_uuid', 'text', (col) => col.notNull())
      .addColumn('weight', 'integer', (col) => col.notNull())
      .addColumn('cooldown', 'integer', (col) => col.notNull())
      .addForeignKeyConstraint(
        'channel_filler_show_channel_uuid_foreign',
        ['channel_uuid'],
        'channel',
        ['uuid'],
        (cb) => cb.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'channel_filler_show_filler_show_uuid_foreign',
        ['filler_show_uuid'],
        'filler_show',
        ['uuid'],
        (cb) => cb.onDelete('cascade').onUpdate('cascade'),
      )
      .addPrimaryKeyConstraint('primary_key', [
        'channel_uuid',
        'filler_show_uuid',
      ])
      .execute();

    await db
      .insertInto('channelFillerShowTmp')
      .columns(['channelUuid', 'cooldown', 'fillerShowUuid', 'weight'])
      .expression(
        db
          .selectFrom('channelFillerShow')
          .select(['channelUuid', 'cooldown', 'fillerShowUuid', 'weight']),
      )
      .execute();

    await db.schema.dropTable('channel_filler_show').execute();
    await db.schema
      .alterTable('channel_filler_show_tmp')
      .renameTo('channel_filler_show')
      .execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },
} satisfies Migration;
