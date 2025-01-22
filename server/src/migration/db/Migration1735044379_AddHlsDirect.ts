import type { Channel } from '@/db/schema/Channel.js';
import type { Kysely } from 'kysely';
import { CompiledQuery, sql } from 'kysely';

interface ChannelProgramsInMigration {
  channelUuid: string;
  programUuid: string;
}

type DB = {
  channel: Channel;
  channelTempAlter: Channel;
  channelPrograms: ChannelProgramsInMigration;
  channelProgramsTempAlter: ChannelProgramsInMigration;
};

export default {
  async up(db: Kysely<DB>) {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    await db.schema
      .createTable('channel_temp_alter')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('number', 'integer', (col) => col.notNull().unique())
      .addColumn('icon', 'json')
      .addColumn('guide_minimum_duration', 'integer', (col) => col.notNull())
      .addColumn('disable_filler_overlay', 'boolean', (col) =>
        col.notNull().defaultTo(false),
      )
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('duration', 'integer', (col) => col.notNull())
      .addColumn('stealth', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('group_title', 'text')
      .addColumn('start_time', 'integer', (col) => col.notNull())
      .addColumn('offline', 'json', (col) =>
        col.notNull().defaultTo(`{"mode":"clip"}`),
      )
      .addColumn('filler_repeat_cooldown', 'integer')
      .addColumn('watermark', 'json')
      .addColumn('transcoding', 'json')
      .addColumn('guide_flex_title', 'text')
      .addColumn('stream_mode', 'text', (b) =>
        b
          .check(
            sql`(\`stream_mode\`) in ('hls', 'hls_slower', 'mpegts', 'hls_direct')`,
          )
          .notNull()
          .defaultTo('hls'),
      )
      .addColumn('transcode_config_id', 'text', (col) =>
        col.references('transcode_config.uuid'),
      )
      .execute();

    await db
      .insertInto('channelTempAlter')
      .columns([
        'uuid',
        'createdAt',
        'updatedAt',
        'number',
        'icon',
        'guideMinimumDuration',
        'disableFillerOverlay',
        'name',
        'duration',
        'stealth',
        'groupTitle',
        'startTime',
        'offline',
        'fillerRepeatCooldown',
        'watermark',
        'transcoding',
        'guideFlexTitle',
        'streamMode',
      ])
      .expression(
        db
          .selectFrom('channel')
          .select([
            'uuid',
            'createdAt',
            'updatedAt',
            'number',
            'icon',
            'guideMinimumDuration',
            'disableFillerOverlay',
            'name',
            'duration',
            'stealth',
            'groupTitle',
            'startTime',
            'offline',
            'fillerRepeatCooldown',
            'watermark',
            'transcoding',
            'guideFlexTitle',
            'streamMode',
          ]),
      )
      .execute();

    await db.schema
      .createTable('channel_programs_temp_alter')
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('program_uuid', 'text', (col) => col.notNull())
      .addPrimaryKeyConstraint('primary_key', ['channel_uuid', 'program_uuid'])
      .addForeignKeyConstraint(
        'channel_programs_channel_uuid_foreign',
        ['channel_uuid'],
        'channel_temp_alter',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'channel_programs_program_uuid_foreign',
        ['program_uuid'],
        'program',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .execute();

    await db
      .insertInto('channelProgramsTempAlter')
      .columns(['channelUuid', 'programUuid'])
      .expression(
        db
          .selectFrom('channelPrograms')
          .select([
            'channelPrograms.channelUuid',
            'channelPrograms.programUuid',
          ]),
      )
      .execute();

    await db.schema.dropTable('channel').execute();
    await db.schema
      .alterTable('channel_temp_alter')
      .renameTo('channel')
      .execute();

    await db.schema.dropTable('channel_programs').execute();
    await db.schema
      .alterTable('channel_programs_temp_alter')
      .renameTo('channel_programs')
      .execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },

  async down(db: Kysely<DB>) {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    await db.schema
      .createTable('channel_temp_alter')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('number', 'integer', (col) => col.notNull().unique())
      .addColumn('icon', 'json')
      .addColumn('guide_minimum_duration', 'integer', (col) => col.notNull())
      .addColumn('disable_filler_overlay', 'boolean', (col) =>
        col.notNull().defaultTo(false),
      )
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('duration', 'integer', (col) => col.notNull())
      .addColumn('stealth', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('group_title', 'text')
      .addColumn('start_time', 'integer', (col) => col.notNull())
      .addColumn('offline', 'json', (col) =>
        col.notNull().defaultTo(`{"mode":"clip"}`),
      )
      .addColumn('filler_repeat_cooldown', 'integer')
      .addColumn('watermark', 'json')
      .addColumn('transcoding', 'json')
      .addColumn('guide_flex_title', 'text')
      .addColumn('stream_mode', 'text', (b) =>
        b
          .check(sql`(\`stream_mode\`) in ('hls', 'hls_slower', 'mpegts')`)
          .notNull()
          .defaultTo('hls'),
      )
      .addColumn('transcode_config_id', 'text', (col) =>
        col.references('transcode_config.uuid'),
      )
      .execute();

    await db
      .insertInto('channelTempAlter')
      .columns([
        'uuid',
        'createdAt',
        'updatedAt',
        'number',
        'icon',
        'guideMinimumDuration',
        'disableFillerOverlay',
        'name',
        'duration',
        'stealth',
        'groupTitle',
        'startTime',
        'offline',
        'fillerRepeatCooldown',
        'watermark',
        'transcoding',
        'guideFlexTitle',
        'streamMode',
      ])
      .expression(
        db
          .selectFrom('channel')
          .select([
            'uuid',
            'createdAt',
            'updatedAt',
            'number',
            'icon',
            'guideMinimumDuration',
            'disableFillerOverlay',
            'name',
            'duration',
            'stealth',
            'groupTitle',
            'startTime',
            'offline',
            'fillerRepeatCooldown',
            'watermark',
            'transcoding',
            'guideFlexTitle',
            'streamMode',
          ]),
      )
      .execute();

    await db.schema
      .createTable('channel_programs_temp_alter')
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('program_uuid', 'text', (col) => col.notNull())
      .addPrimaryKeyConstraint('primary_key', ['channel_uuid', 'program_uuid'])
      .addForeignKeyConstraint(
        'channel_programs_channel_uuid_foreign',
        ['channel_uuid'],
        'channel_temp_alter',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'channel_programs_program_uuid_foreign',
        ['program_uuid'],
        'program',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .execute();

    await db
      .insertInto('channelProgramsTempAlter')
      .columns(['channelUuid', 'programUuid'])
      .expression(
        db
          .selectFrom('channelPrograms')
          .select([
            'channelPrograms.channelUuid',
            'channelPrograms.programUuid',
          ]),
      )
      .execute();

    await db.schema.dropTable('channel').execute();
    await db.schema
      .alterTable('channel_temp_alter')
      .renameTo('channel')
      .execute();

    await db.schema.dropTable('channel_programs').execute();
    await db.schema
      .alterTable('channel_programs_temp_alter')
      .renameTo('channel_programs')
      .execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },
};
