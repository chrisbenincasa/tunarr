import type { Kysely, Migration } from 'kysely';
import { sql } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    // create table `cached_image` (`hash` text not null, `url` text not null, `mime_type` text null, primary key (`hash`));
    await db.schema
      .createTable('cached_image')
      .ifNotExists()
      .addColumn('hash', 'text', (col) => col.notNull().primaryKey())
      .addColumn('url', 'text', (col) => col.notNull())
      .addColumn('mime_type', 'text')
      .execute();

    /**
     * create table `channel` (`uuid` text not null,
     *    `created_at` datetime null,
     *    `updated_at` datetime null,
     *    `number` integer not null,
     *    `icon` json null,
     *    `guide_minimum_duration` integer not null,
     *    `disable_filler_overlay` integer not null default false,
     *    `name` text not null,
     *    `duration` integer not null,
     *    `stealth` integer not null default false,
     *    `group_title` text null,
     *    `start_time` integer not null,
     *    `offline` json null default \'{"mode":"clip"}\',
     *    `filler_repeat_cooldown` integer null,
     *    `watermark` json null,
     *    `transcoding` json null,
     *    primary key (`uuid`));
     */
    await db.schema
      .createTable('channel')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('number', 'integer', (col) => col.notNull())
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
      .execute();

    // create unique index `channel_number_unique` on `channel` (`number`);
    await db.schema
      .createIndex('channel_number_unique')
      .on('channel')
      .unique()
      .column('number')
      .execute();

    /**
     * create table `custom_show` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `name` text not null, primary key (`uuid`));
     */

    await db.schema
      .createTable('custom_show')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.notNull().primaryKey())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('name', 'text', (col) => col.notNull())
      .execute();

    /**
     * create table `channel_custom_shows` (
     *  `channel_uuid` text not null,
     *  `custom_show_uuid` text not null,
     *  constraint `channel_custom_shows_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade,
     *  constraint `channel_custom_shows_custom_show_uuid_foreign` foreign key(`custom_show_uuid`) references `custom_show`(`uuid`) on delete cascade on update cascade,
     *  primary key (`channel_uuid`, `custom_show_uuid`));
     */
    await db.schema
      .createTable('channel_custom_shows')
      .ifNotExists()
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('custom_show_uuid', 'text', (col) => col.notNull())
      .addForeignKeyConstraint(
        'channel_custom_shows_channel_uuid_foreign',
        ['channel_uuid'],
        'channel',
        ['uuid'],
        (cb) => cb.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'channel_custom_shows_custom_show_uuid_foreign',
        ['custom_show_uuid'],
        'custom_show',
        ['uuid'],
        (cb) => cb.onDelete('cascade').onUpdate('cascade'),
      )
      .addPrimaryKeyConstraint('primary_key', [
        'channel_uuid',
        'custom_show_uuid',
      ])
      .execute();

    // create index `channel_custom_shows_channel_uuid_index` on `channel_custom_shows` (`channel_uuid`);
    await db.schema
      .createIndex('channel_custom_shows_channel_uuid_index')
      .on('channel_custom_shows')
      .column('channel_uuid')
      .execute();

    // create index `channel_custom_shows_custom_show_uuid_index` on `channel_custom_shows` (`custom_show_uuid`);
    await db.schema
      .createIndex('channel_custom_shows_custom_show_uuid_index')
      .on('channel_custom_shows')
      .column('custom_show_uuid')
      .execute();

    // create table `filler_show` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `name` text not null, primary key (`uuid`));
    await db.schema
      .createTable('filler_show')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.notNull().primaryKey())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('name', 'text', (col) => col.notNull())
      .execute();

    /**
     * create table `channel_filler_show` (
     *  `channel_uuid` text not null,
     *  `filler_show_uuid` text not null,
     *  `weight` integer not null,
     *  `cooldown` integer not null,
     *  constraint `channel_filler_show_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on update cascade,
     *  constraint `channel_filler_show_filler_show_uuid_foreign` foreign key(`filler_show_uuid`) references `filler_show`(`uuid`) on update cascade,
     *  primary key (`channel_uuid`, `filler_show_uuid`));
     */

    await db.schema
      .createTable('channel_filler_show')
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

    // create index `channel_filler_show_channel_uuid_index` on `channel_filler_show` (`channel_uuid`);
    await db.schema
      .createIndex('channel_filler_show_channel_uuid_index')
      .on('channel_filler_show')
      .column('channel_uuid')
      .execute();

    // create index `channel_filler_show_filler_show_uuid_index` on `channel_filler_show` (`filler_show_uuid`);
    await db.schema
      .createIndex('channel_filler_show_filler_show_uuid_index')
      .on('channel_filler_show')
      .column('filler_show_uuid')
      .execute();

    /**
     * create table `plex_server_settings` (
     *  `uuid` text not null,
     *  `created_at` datetime null,
     *  `updated_at` datetime null,
     *  `name` text not null,
     *  `uri` text not null,
     *  `access_token` text not null,
     *  `send_guide_updates` integer not null default true,
     *  `send_channel_updates` integer not null default true,
     *  `index` integer not null,
     *  primary key (`uuid`));
     */
    await db.schema
      .createTable('plex_server_settings')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('uri', 'text', (col) => col.notNull())
      .addColumn('access_token', 'text', (col) => col.notNull())
      .addColumn('send_guide_updates', 'boolean', (col) =>
        col.notNull().defaultTo(true),
      )
      .addColumn('send_channel_updates', 'boolean', (col) =>
        col.notNull().defaultTo(true),
      )
      .addColumn('index', 'integer', (col) => col.notNull())
      .execute();

    // create unique index `plex_server_settings_name_uri_unique` on `plex_server_settings` (`name`, `uri`);
    await db.schema
      .createIndex('plex_server_settings_name_uri_unique')
      .on('plex_server_settings')
      .columns(['name', 'uri'])
      .unique()
      .execute();

    /**
     * create table `program` (
     *  `uuid` text not null,
     * `created_at` datetime null,
     * `updated_at` datetime null,
     * `source_type` text check (`source_type` in ('plex')) not null,
     * `original_air_date` text null,
     * `duration` integer not null,
     * `episode` integer null,
     * `episode_icon` text null,
     * `file_path` text null,
     * `icon` text null,
     * `external_source_id` text not null,
     * `external_key` text not null,
     * `plex_rating_key` text null,
     * `plex_file_path` text null,
     * `parent_external_key` text null,
     * `grandparent_external_key` text null,
     * `rating` text null,
     * `season` integer null,
     * `season_icon` text null,
     * `show_icon` text null,
     * `show_title` text null,
     * `summary` text null,
     * `title` text not null,
     * `type` text not null,
     * `year` integer null,
     * `custom_order` integer null,
     *  primary key (`uuid`));
     */

    await db.schema
      .createTable('program')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (col) =>
        col.check(sql`(\`source_type\` in ('plex'))`).notNull(),
      )
      .addColumn('original_air_date', 'text')
      .addColumn('duration', 'integer', (col) => col.notNull())
      .addColumn('episode', 'integer')
      .addColumn('episode_icon', 'text')
      .addColumn('file_path', 'text')
      .addColumn('icon', 'text')
      .addColumn('external_source_id', 'text', (col) => col.notNull())
      .addColumn('external_key', 'text', (col) => col.notNull())
      .addColumn('plex_rating_key', 'text')
      .addColumn('plex_file_path', 'text')
      .addColumn('parent_external_key', 'text')
      .addColumn('grandparent_external_key', 'text')
      .addColumn('rating', 'text')
      .addColumn('season', 'integer')
      .addColumn('season_icon', 'text')
      .addColumn('show_icon', 'text')
      .addColumn('show_title', 'text')
      .addColumn('summary', 'text')
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) =>
        col.notNull().check(sql`(\`type\` in ('movie', 'episode', 'track'))`),
      )
      .addColumn('year', 'integer')
      .addColumn('custom_order', 'integer')
      .execute();

    // create unique index `program_source_type_external_source_id_external_key_unique` on `program` (`source_type`, `external_source_id`, `external_key`);
    await db.schema
      .createIndex('program_source_type_external_source_id_external_key_unique')
      .on('program')
      .columns(['source_type', 'external_source_id', 'external_key'])
      .unique()
      .execute();

    /**
     * create table `filler_show_content` (
     *  `filler_show_uuid` text not null,
     *  `program_uuid` text not null,
     *  constraint `filler_show_content_filler_show_uuid_foreign` foreign key(`filler_show_uuid`) references `filler_show`(`uuid`) on delete cascade on update cascade,
     *  constraint `filler_show_content_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on delete cascade on update cascade,
     *  primary key (`filler_show_uuid`, `program_uuid`));
     */
    await db.schema
      .createTable('filler_show_content')
      .ifNotExists()
      .addColumn('filler_show_uuid', 'text', (col) => col.notNull())
      .addColumn('program_uuid', 'text', (col) => col.notNull())
      .addForeignKeyConstraint(
        'filler_show_content_filler_show_uuid_foreign',
        ['filler_show_uuid'],
        'filler_show',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'filler_show_content_program_uuid_foreign',
        ['program_uuid'],
        'program',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addPrimaryKeyConstraint('primary_key', [
        'filler_show_uuid',
        'program_uuid',
      ])
      .execute();

    /**
     * create index `filler_show_content_filler_show_uuid_index` on `filler_show_content` (`filler_show_uuid`);
     */
    await db.schema
      .createIndex('filler_show_content_filler_show_uuid_index')
      .on('filler_show_content')
      .column('filler_show_uuid')
      .execute();

    /**
     * create index `filler_show_content_program_uuid_index` on `filler_show_content` (`program_uuid`);
     */
    await db.schema
      .createIndex('filler_show_content_program_uuid_index')
      .on('filler_show_content')
      .column('program_uuid')
      .execute();

    /**
     * create table `custom_show_content` (
     * `custom_show_uuid` text not null,
     * `content_uuid` text not null,
     * `index` integer not null,
     * constraint `custom_show_content_custom_show_uuid_foreign` foreign key(`custom_show_uuid`) references `custom_show`(`uuid`) on update cascade,
     * constraint `custom_show_content_content_uuid_foreign` foreign key(`content_uuid`) references `program`(`uuid`) on update cascade,
     * primary key (`custom_show_uuid`, `content_uuid`));
     */
    await db.schema
      .createTable('custom_show_content')
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

    /**
     * create table `channel_programs` (
     * `channel_uuid` text not null,
     * `program_uuid` text not null,
     * constraint `channel_programs_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade,
     * constraint `channel_programs_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on delete cascade on update cascade,
     * primary key (`channel_uuid`,
     * `program_uuid`));
     */
    await db.schema
      .createTable('channel_programs')
      .ifNotExists()
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('program_uuid', 'text', (col) => col.notNull())
      .addForeignKeyConstraint(
        'channel_programs_channel_uuid_foreign',
        ['channel_uuid'],
        'channel',
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
      .addPrimaryKeyConstraint('primary_key', ['channel_uuid', 'program_uuid'])
      .execute();

    /**
     * create index `channel_programs_channel_uuid_index` on `channel_programs` (`channel_uuid`);
     */
    await db.schema
      .createIndex('channel_programs_channel_uuid_index')
      .on('channel_programs')
      .column('channel_uuid')
      .execute();

    /**
     * create index `channel_programs_program_uuid_index` on `channel_programs` (`program_uuid`);
     */

    await db.schema
      .createIndex('channel_programs_program_uuid_index')
      .on('channel_programs')
      .column('program_uuid')
      .execute();

    /**
     * create table `channel_fallback` (
     * `channel_uuid` text not null,
     * `program_uuid` text not null,
     * constraint `channel_fallback_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade,
     * constraint `channel_fallback_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on delete cascade on update cascade,
     * primary key (`channel_uuid`, `program_uuid`));
     */

    await db.schema
      .createTable('channel_fallback')
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('program_uuid', 'text', (col) => col.notNull())
      .addForeignKeyConstraint(
        'channel_fallback_channel_uuid_foreign',
        ['channel_uuid'],
        'channel',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'channel_fallback_program_uuid_foreign',
        ['program_uuid'],
        'program',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addPrimaryKeyConstraint('primary_key', ['channel_uuid', 'program_uuid'])
      .execute();

    /**
     * create index `channel_fallback_channel_uuid_index` on `channel_fallback` (`channel_uuid`);
     */

    await db.schema
      .createIndex('channel_fallback_channel_uuid_index')
      .on('channel_fallback')
      .column('channel_uuid')
      .execute();

    /**
     * create index `channel_fallback_program_uuid_index` on `channel_fallback` (`program_uuid`);
     */

    await db.schema
      .createIndex('channel_fallback_program_uuid_index')
      .on('channel_fallback')
      .column('program_uuid')
      .execute();
  },

  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('cached_image').ifExists().execute();
    await db.schema.dropTable('channel').ifExists().execute();
    await db.schema.dropIndex('channel_number_unique').ifExists().execute();
    await db.schema.dropTable('custom_show').ifExists().execute();
    await db.schema.dropTable('channel_custom_shows').ifExists().execute();
    await db.schema
      .dropIndex('channel_custom_shows_channel_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('channel_custom_shows_custom_show_uuid_index')
      .ifExists()
      .execute();
    await db.schema.dropTable('filler_show').ifExists().execute();
    await db.schema.dropTable('channel_filler_show').ifExists().execute();
    await db.schema
      .dropIndex('channel_filler_show_channel_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('channel_filler_show_filler_show_uuid_index')
      .ifExists()
      .execute();
    await db.schema.dropTable('plex_server_settings').ifExists().execute();
    await db.schema
      .dropIndex('plex_server_settings_name_uri_unique')
      .ifExists()
      .execute();
    await db.schema.dropTable('program').ifExists().execute();
    await db.schema
      .dropIndex('program_source_type_external_source_id_external_key_unique')
      .ifExists()
      .execute();
    await db.schema.dropTable('filler_show_content').ifExists().execute();
    await db.schema
      .dropIndex('filler_show_content_filler_show_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('filler_show_content_program_uuid_index')
      .ifExists()
      .execute();
    await db.schema.dropTable('custom_show_content').ifExists().execute();
    await db.schema
      .dropIndex('custom_show_content_custom_show_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('custom_show_content_content_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex(
        'custom_show_content_custom_show_uuid_content_uuid_index_unique',
      )
      .ifExists()
      .execute();
    await db.schema.dropTable('channel_programs').ifExists().execute();
    await db.schema
      .dropIndex('channel_programs_channel_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('channel_programs_program_uuid_index')
      .ifExists()
      .execute();
    await db.schema.dropTable('channel_fallback').ifExists().execute();
    await db.schema
      .dropIndex('channel_fallback_channel_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('channel_programs_program_uuid_index')
      .ifExists()
      .execute();
  },
} satisfies Migration;
