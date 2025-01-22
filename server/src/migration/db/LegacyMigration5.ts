import type { Kysely, Migration } from 'kysely';
import { sql } from 'kysely';
import { columnExists } from './util.ts';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    /**
     * create table `program_grouping` (
     *  `uuid` text not null,
     * `created_at` datetime null,
     * `updated_at` datetime null,
     * `type` text not null,
     * `title` text not null,
     * `summary` text null,
     * `icon` text null,
     * `year` integer null,
     * `index` integer null,
     * `show_uuid` text null,
     * `artist_uuid` text null,
     * constraint `program_grouping_show_uuid_foreign` foreign key(`show_uuid`) references `program_grouping`(`uuid`) on delete set null on update cascade,
     * constraint `program_grouping_artist_uuid_foreign` foreign key(`artist_uuid`) references `program_grouping`(`uuid`) on delete set null on update cascade,
     * primary key (`uuid`));
     */
    await db.schema
      .createTable('program_grouping')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('type', 'text', (col) =>
        col
          .notNull()
          .check(sql`(\`type\` in ('album', 'artist', 'season', 'show'))`),
      )
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('summary', 'text')
      .addColumn('icon', 'text')
      .addColumn('year', 'integer')
      .addColumn('index', 'integer')
      .addColumn('show_uuid', 'text')
      .addColumn('artist_uuid', 'text')
      .addForeignKeyConstraint(
        'program_grouping_show_uuid_foreign',
        ['show_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'program_grouping_artist_uuid_foreign',
        ['artist_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onDelete('cascade').onUpdate('cascade'),
      )
      .execute();

    /**
     * create index `program_grouping_show_uuid_index` on `program_grouping` (`show_uuid`);
     */
    await db.schema
      .createIndex('program_grouping_show_uuid_index')
      .on('program_grouping')
      .column('show_uuid')
      .execute();

    /**
     * create index `program_grouping_artist_uuid_index` on `program_grouping` (`artist_uuid`);
     */
    await db.schema
      .createIndex('program_grouping_artist_uuid_index')
      .on('program_grouping')
      .column('artist_uuid')
      .execute();

    /**
     * create table `program_grouping_external_id` (`uuid` text not null,
     * `created_at` datetime null,
     * `updated_at` datetime null,
     * `source_type` text check (`source_type` in ('plex')) not null,
     * `external_source_id` text not null,
     * `external_key` text not null,
     * `external_file_path` text null,
     * `group_uuid` text not null,
     * constraint `program_grouping_external_id_group_uuid_foreign` foreign key(`group_uuid`) references `program_grouping`(`uuid`) on update cascade, primary key (`uuid`));
     */
    await db.schema
      .createTable('program_grouping_external_id')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (col) =>
        col.notNull().check(sql`(\`source_type\` in ('plex'))`),
      )
      .addColumn('external_source_id', 'text')
      .addColumn('external_key', 'text', (col) => col.notNull())
      .addColumn('group_uuid', 'text', (col) => col.notNull())
      .addColumn('external_file_path', 'text')
      .addForeignKeyConstraint(
        'program_grouping_external_id_group_uuid_foreign',
        ['group_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onUpdate('cascade').onDelete('cascade'),
      )
      .execute();

    /**
     * create index `program_grouping_external_id_group_uuid_index` on `program_grouping_external_id` (`group_uuid`);
     */
    await db.schema
      .createIndex('program_grouping_external_id_group_uuid_index')
      .on('program_grouping_external_id')
      .column('group_uuid')
      .execute();

    /**
     * create unique index `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);
     */
    await db.schema
      .createIndex('program_grouping_external_id_uuid_source_type_unique')
      .on('program_grouping_external_id')
      .columns(['uuid', 'source_type'])
      .unique()
      .execute();

    /**
     * alter table `program` add column `season_uuid` text null constraint `program_season_uuid_foreign` references `program_grouping` (`uuid`) on update cascade
     * constraint `program_tv_show_uuid_foreign` references `program_grouping` (`uuid`) on update cascade
     * constraint `program_album_uuid_foreign` references `program_grouping` (`uuid`) on update cascade
     * constraint `program_artist_uuid_foreign` references `program_grouping` (`uuid`) on update cascade;
     */

    await db.schema
      .alterTable('program')
      .addColumn(
        'season_uuid',
        sql`text null constraint \`program_season_uuid_foreign\` references \`program_grouping\` (\`uuid\`) on update cascade`,
      )
      .execute();
    await db.schema
      .alterTable('program')
      .addColumn(
        'album_uuid',
        sql`text null constraint \`program_album_uuid_foreign\` references \`program_grouping\` (\`uuid\`) on update cascade`,
      )
      .execute();
    await db.schema
      .alterTable('program')
      .addColumn(
        'artist_uuid',
        sql`text null constraint \`program_artist_uuid_foreign\` references \`program_grouping\` (\`uuid\`) on update cascade`,
      )
      .execute();
    await db.schema
      .alterTable('program')
      .addColumn(
        'tv_show_uuid',
        sql`text null constraint \`program_tv_show_uuid_foreign\` references \`program_grouping\` (\`uuid\`) on update cascade`,
      )
      .execute();

    await db.schema
      .createIndex('program_season_uuid_index')
      .on('program')
      .column('season_uuid')
      .execute();
    await db.schema
      .createIndex('program_tv_show_uuid_index')
      .on('program')
      .column('tv_show_uuid')
      .execute();
    await db.schema
      .createIndex('program_album_uuid_index')
      .on('program')
      .column('album_uuid')
      .execute();
    await db.schema
      .createIndex('program_artist_uuid_index')
      .on('program')
      .column('artist_uuid')
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('program_grouping').ifExists().execute();
    await db.schema
      .dropIndex('program_grouping_show_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('program_grouping_artist_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropTable('program_grouping_external_id')
      .ifExists()
      .execute();

    await db.schema
      .dropIndex('program_grouping_external_id_group_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('program_grouping_external_id_uuid_source_type_unique')
      .ifExists()
      .execute();

    if (await columnExists(db, 'program', 'season_uuid')) {
      await db.schema.alterTable('program').dropColumn('season_uuid').execute();
    }

    if (await columnExists(db, 'program', 'album_uuid')) {
      await db.schema.alterTable('program').dropColumn('album_uuid').execute();
    }

    if (await columnExists(db, 'program', 'artist_uuid')) {
      await db.schema.alterTable('program').dropColumn('artist_uuid').execute();
    }

    if (await columnExists(db, 'program', 'tv_show_uuid')) {
      await db.schema
        .alterTable('program')
        .dropColumn('tv_show_uuid')
        .execute();
    }

    await db.schema.dropIndex('program_season_uuid_index').ifExists().execute();
    await db.schema
      .dropIndex('program_tv_show_uuid_index')
      .ifExists()
      .execute();
    await db.schema.dropIndex('program_album_uuid_index').ifExists().execute();
    await db.schema.dropIndex('program_artist_uuid_index').ifExists().execute();
  },
} satisfies Migration;
