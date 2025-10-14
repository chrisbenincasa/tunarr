import type { MediaSourceType } from '@/db/schema/base.js';
import type { ProgramGroupingType } from '@/db/schema/ProgramGrouping.js';
import type { Kysely } from 'kysely';
import { CompiledQuery, sql } from 'kysely';
import type {
  ProgramExternalIdSourceType,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from '../../db/schema/base.js';

interface ProgramGroupingInMigration
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  artistUuid: string | null;
  icon: string | null;
  index: number | null;
  showUuid: string | null;
  summary: string | null;
  title: string;
  type: `${ProgramGroupingType}`;
  year: number | null;
}

interface ProgramInMigration extends WithCreatedAt, WithUpdatedAt, WithUuid {
  albumName: string | null;
  albumUuid: string | null;
  artistName: string | null;
  artistUuid: string | null;
  duration: number;
  episode: number | null;
  episodeIcon: string | null;
  externalKey: string;
  externalSourceId: string;
  filePath: string | null;
  grandparentExternalKey: string | null;
  icon: string | null;
  originalAirDate: string | null;
  parentExternalKey: string | null;
  plexFilePath: string | null;
  plexRatingKey: string | null;
  rating: string | null;
  seasonIcon: string | null;
  seasonNumber: number | null;
  seasonUuid: string | null;
  showIcon: string | null;
  showTitle: string | null;
  sourceType: MediaSourceType;
  summary: string | null;
  title: string;
  tvShowUuid: string | null;
  type: 'movie' | 'episode' | 'track';
  year: number | null;
}

interface ChannelProgramsInMigration {
  channelUuid: string;
  programUuid: string;
}

interface CurrentProgramExternalIdTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  directFilePath: string | null;
  externalFilePath: string | null;
  externalKey: string;
  externalSourceId: string | null;
  programUuid: string;
  sourceType: ProgramExternalIdSourceType;
}

interface ProgramGroupingExternalIdInMigration
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  externalFilePath: string | null;
  externalKey: string;
  externalSourceId: string | null;
  groupUuid: string;
  sourceType: ProgramExternalIdSourceType;
}

type DBTemp = {
  programGroupingTempAlter: ProgramGroupingInMigration;
  programGrouping: ProgramGroupingInMigration;
  programTempAlter: ProgramInMigration;
  program: ProgramInMigration;
  channelPrograms: ChannelProgramsInMigration;
  channelProgramsTempAlter: ChannelProgramsInMigration;
  programExternalIdAlter: CurrentProgramExternalIdTable;
  programExternalId: CurrentProgramExternalIdTable;
  programGroupingExternalIdTempAlter: ProgramGroupingExternalIdInMigration;
  programGroupingExternalId: ProgramGroupingExternalIdInMigration;
};

export default {
  async up(db: Kysely<DBTemp>): Promise<void> {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    /**
     * create table `program_grouping__temp_alter` (
     *  `uuid` text not null,
     * `created_at` datetime not null,
     * `updated_at` datetime not null,
     * `type` ProgramGroupingType not null,
     * `title` text not null,
     * `summary` text null,
     * `icon` text null,
     * `year` integer null,
     * `index` integer null,
     * `show_uuid` text null,
     * `artist_uuid` text null,
     * constraint `program_grouping_show_uuid_foreign` foreign key(`show_uuid`) references `program_grouping__temp_alter`(`uuid`) on delete set null on update cascade,
     * constraint `program_grouping_artist_uuid_foreign` foreign key(`artist_uuid`) references `program_grouping__temp_alter`(`uuid`) on delete set null on update cascade,
     * primary key (`uuid`));
     */
    await db.schema
      .createTable('program_grouping_temp_alter')
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

    // this.addSql(
    //   'insert into `program_grouping__temp_alter` select * from `program_grouping`;',
    // );

    await db
      .insertInto('programGroupingTempAlter')
      .columns([
        'artistUuid',
        'createdAt',
        'icon',
        'index',
        'showUuid',
        'summary',
        'title',
        'type',
        'updatedAt',
        'uuid',
        'year',
      ])
      .expression(
        db
          .selectFrom('programGrouping')
          .select([
            'artistUuid',
            'createdAt',
            'icon',
            'index',
            'showUuid',
            'summary',
            'title',
            'type',
            'updatedAt',
            'uuid',
            'year',
          ]),
      )
      .execute();

    // this.addSql('drop table `program_grouping`;');

    await db.schema.dropTable('program_grouping').execute();

    // this.addSql(
    //   'alter table `program_grouping__temp_alter` rename to `program_grouping`;',
    // );
    await db.schema
      .alterTable('program_grouping_temp_alter')
      .renameTo('program_grouping')
      .execute();

    /**
     * create index `program_grouping_show_uuid_index` on `program_grouping` (`show_uuid`);
     */
    await db.schema
      .createIndex('program_grouping_show_uuid_index')
      .ifNotExists()
      .on('program_grouping')
      .column('show_uuid')
      .execute();

    /**
     * create index `program_grouping_artist_uuid_index` on `program_grouping` (`artist_uuid`);
     */
    await db.schema
      .createIndex('program_grouping_artist_uuid_index')
      .ifNotExists()
      .on('program_grouping')
      .column('artist_uuid')
      .execute();

    /**
     * create table `program__temp_alter` (`uuid` text not null,
     * `created_at` datetime not null,
     * `updated_at` datetime not null,
     * `source_type` text check (`source_type` in ('plex', 'jellyfin')) not null,
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
     * `season_number` integer null,
     * `season_icon` text null,
     * `show_icon` text null,
     * `show_title` text null,
     * `summary` text null,
     * `title` text not null,
     * `type` text check (`type` in ('movie', 'episode', 'track')) not null,
     * `year` integer null,
     * `artist_name` text null,
     * `album_name` text null,
     * `season_uuid` text null,
     * `tv_show_uuid` text null,
     * `album_uuid` text null,
     * `artist_uuid` text null,
     * constraint `program_season_uuid_foreign` foreign key(`season_uuid`) references `program_grouping`(`uuid`) on delete set null,
     * constraint `program_tv_show_uuid_foreign` foreign key(`tv_show_uuid`) references `program_grouping`(`uuid`) on delete set null,
     * constraint `program_album_uuid_foreign` foreign key(`album_uuid`) references `program_grouping`(`uuid`) on delete set null,
     * constraint `program_artist_uuid_foreign` foreign key(`artist_uuid`) references `program_grouping`(`uuid`) on delete set null,
     * primary key (`uuid`));
     */

    await db.schema
      .createTable('program_temp_alter')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (col) =>
        col.check(sql`(\`source_type\` in ('plex', 'jellyfin'))`).notNull(),
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
      .addColumn('season_number', 'integer')
      .addColumn('season_icon', 'text')
      .addColumn('show_icon', 'text')
      .addColumn('show_title', 'text')
      .addColumn('summary', 'text')
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) =>
        col.notNull().check(sql`(\`type\` in ('movie', 'episode', 'track'))`),
      )
      .addColumn('year', 'integer')
      .addColumn('artist_name', 'text')
      .addColumn('album_name', 'text')
      .addColumn('season_uuid', 'text')
      .addColumn('album_uuid', 'text')
      .addColumn('artist_uuid', 'text')
      .addColumn('tv_show_uuid', 'text')
      .addForeignKeyConstraint(
        'program_season_uuid_foreign',
        ['season_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'program_album_uuid_foreign',
        ['album_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'program_artist_uuid_foreign',
        ['artist_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onUpdate('cascade'),
      )
      .addForeignKeyConstraint(
        'program_tv_show_uuid_foreign',
        ['tv_show_uuid'],
        'program_grouping',
        ['uuid'],
        (b) => b.onUpdate('cascade'),
      )
      .execute();

    // Create a channel_programs table without a foreign key reference as a backup.
    // Deleting the program table in the migration deletes all of the references
    // this.addSql(
    //   'CREATE TABLE `channel_programs__temp_alter` (`channel_uuid` text not null, `program_uuid` text not null, constraint `channel_programs_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade, constraint `channel_programs_program_uuid_foreign` foreign key(`program_uuid`) references `program__temp_alter`(`uuid`) on delete cascade on update cascade primary key (`channel_uuid`, `program_uuid`));',
    // );
    await db.schema
      .createTable('channel_programs_temp_alter')
      .addColumn('channel_uuid', 'text', (col) => col.notNull())
      .addColumn('program_uuid', 'text', (col) => col.notNull())
      // .addForeignKeyConstraint(
      //   'channel_programs_channel_uuid_foreign',
      //   ['channel_uuid'],
      //   'channel',
      //   ['uuid'],
      //   (b) => b.onDelete('cascade').onUpdate('cascade'),
      // )
      // .addForeignKeyConstraint(
      //   'channel_programs_program_uuid_foreign',
      //   ['program_uuid'],
      //   'program',
      //   ['uuid'],
      //   (b) => b.onDelete('cascade').onUpdate('cascade'),
      // )
      .addPrimaryKeyConstraint('primary_key', ['channel_uuid', 'program_uuid'])
      .execute();

    await db
      .insertInto('programTempAlter')
      .columns([
        'albumName',
        'albumUuid',
        'artistName',
        'artistUuid',
        'createdAt',
        'duration',
        'episode',
        'episodeIcon',
        'externalKey',
        'externalSourceId',
        'filePath',
        'grandparentExternalKey',
        'icon',
        'originalAirDate',
        'parentExternalKey',
        'plexFilePath',
        'plexRatingKey',
        'rating',
        'seasonIcon',
        'seasonNumber',
        'showTitle',
        'sourceType',
        'summary',
        'title',
        'tvShowUuid',
        'type',
        'updatedAt',
        'uuid',
        'year',
      ])
      .expression(
        db
          .selectFrom('program')
          .select([
            'albumName',
            'albumUuid',
            'artistName',
            'artistUuid',
            'createdAt',
            'duration',
            'episode',
            'episodeIcon',
            'externalKey',
            'externalSourceId',
            'filePath',
            'grandparentExternalKey',
            'icon',
            'originalAirDate',
            'parentExternalKey',
            'plexFilePath',
            'plexRatingKey',
            'rating',
            'seasonIcon',
            'seasonNumber',
            'showTitle',
            'sourceType',
            'summary',
            'title',
            'tvShowUuid',
            'type',
            'updatedAt',
            'uuid',
            'year',
          ]),
      )
      .execute();

    // this.addSql('insert into `program__temp_alter` select * from `program`;');
    // this.addSql(
    //   'insert into `channel_programs__temp_alter` select * from `channel_programs`;',
    // );

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

    await db.schema.dropTable('program').execute();
    await db.schema.dropTable('channel_programs').execute();
    // this.addSql('drop table `program`;');
    // this.addSql('drop table `channel_programs`;');
    // this.addSql('alter table `program__temp_alter` rename to `program`;');
    await db.schema
      .alterTable('program_temp_alter')
      .renameTo('program')
      .execute();

    // this.addSql(
    //   'alter table `channel_programs__temp_alter` rename to `channel_programs`;',
    // );

    await db.schema
      .alterTable('channel_programs_temp_alter')
      .renameTo('channel_programs')
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

    // this.addSql(
    //   'create index `program_source_type_external_source_id_plex_rating_key_index` on `program` (`source_type`, `external_source_id`, `plex_rating_key`);',
    // );
    // this.addSql(
    //   'create unique index `program_source_type_external_source_id_external_key_unique` on `program` (`source_type`, `external_source_id`, `external_key`);',
    // );
    // create unique index `program_source_type_external_source_id_external_key_unique` on `program` (`source_type`, `external_source_id`, `external_key`);

    await db.schema
      .createIndex('program_source_type_external_source_id_external_key_unique')
      .on('program')
      .columns(['source_type', 'external_source_id', 'external_key'])
      .unique()
      .execute();

    // this.addSql(
    //   "create table `program_external_id__temp_alter` (`uuid` text not null, `created_at` datetime not null, `updated_at` datetime not null, `source_type` text check (`source_type` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin')) not null, `external_source_id` text null, `external_key` text not null, `external_file_path` text null, `direct_file_path` text null, `program_uuid` text not null, constraint `program_external_id_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on update cascade, primary key (`uuid`));",
    // );
    await db.schema
      .createTable('program_external_id_alter')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (b) =>
        b
          .check(
            sql`(\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin'))`,
          )
          .notNull(),
      )
      .addColumn('external_source_id', 'text')
      .addColumn('external_key', 'text', (b) => b.notNull())
      .addColumn('external_file_path', 'text')
      .addColumn('direct_file_path', 'text')
      .addColumn('program_uuid', 'text', (b) => b.notNull())
      .addForeignKeyConstraint(
        'program_external_id_program_uuid_foreign',
        ['program_uuid'],
        'program',
        ['uuid'],
        (b) => b.onUpdate('cascade'),
      )
      .execute();

    // this.addSql(
    //   'insert into `program_external_id__temp_alter` select * from `program_external_id`;',
    // );
    await db
      .insertInto('programExternalIdAlter')
      .columns([
        'createdAt',
        'directFilePath',
        'externalFilePath',
        'externalKey',
        'externalSourceId',
        'programUuid',
        'sourceType',
        'updatedAt',
        'uuid',
      ])
      .expression(
        db
          .selectFrom('programExternalId')
          .select([
            'createdAt',
            'directFilePath',
            'externalFilePath',
            'externalKey',
            'externalSourceId',
            'programUuid',
            'sourceType',
            'updatedAt',
            'uuid',
          ]),
      )
      .execute();

    // this.addSql(
    //   'INSERT INTO "_knex_temp_alter808" SELECT * FROM "program_external_id";',
    // );
    await db.schema.dropTable('program_external_id').execute();

    // this.addSql('DROP TABLE "program_external_id";');
    // this.addSql(
    //   'ALTER TABLE "_knex_temp_alter808" RENAME TO "program_external_id";',
    // );

    await db.schema
      .alterTable('program_external_id_alter')
      .renameTo('program_external_id')
      .execute();

    // this.addSql(
    //   'create index `program_external_id_program_uuid_index` on `program_external_id` (`program_uuid`);',
    // );
    await db.schema
      .createIndex('program_external_id_program_uuid_index')
      .on('program_external_id')
      .column('program_uuid')
      .execute();

    // this.addSql(
    //   'create unique index if not exists `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NOT NULL;',
    // );
    // this.addSql(
    //   'create unique index if not exists `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL;',
    // );

    await db.schema
      .createIndex('unique_program_multiple_external_id')
      .ifNotExists()
      .on('program_external_id')
      .columns(['program_uuid', 'source_type', 'external_source_id'])
      .unique()
      .where(sql`\`external_source_id\``, 'is not', null)
      .execute();
    await db.schema
      .createIndex('unique_program_single_external_id')
      .ifNotExists()
      .on('program_external_id')
      .columns(['program_uuid', 'source_type'])
      .unique()
      .where(sql`\`external_source_id\``, 'is', null)
      .execute();

    /**
     * create table `program_grouping_external_id__temp_alter` (
     * `uuid` text not null,
     * `created_at` datetime not null,
     * `updated_at` datetime not null,
     * `source_type` text check (`source_type` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin')) not null,
     * `external_source_id` text null,
     * `external_key` text not null,
     * `external_file_path` text null,
     * `group_uuid` text not null,
     * constraint `program_grouping_external_id_group_uuid_foreign` foreign key(`group_uuid`) references `program_grouping`(`uuid`) on update cascade,
     * primary key (`uuid`));
     */
    await db.schema
      .createTable('program_grouping_external_id_temp_alter')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (col) =>
        col
          .notNull()
          .check(
            sql`(\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin'))`,
          ),
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

    await db
      .insertInto('programGroupingExternalIdTempAlter')
      .columns([
        'createdAt',
        'externalFilePath',
        'externalKey',
        'externalSourceId',
        'groupUuid',
        'sourceType',
        'updatedAt',
        'uuid',
      ])
      .expression(
        db
          .selectFrom('programGroupingExternalId')
          .select([
            'createdAt',
            'externalFilePath',
            'externalKey',
            'externalSourceId',
            'groupUuid',
            'sourceType',
            'updatedAt',
            'uuid',
          ]),
      )
      .execute();

    // this.addSql(
    //   'insert into `program_grouping_external_id__temp_alter` select * from `program_grouping_external_id`;',
    // );

    // this.addSql('drop table `program_grouping_external_id`;');
    await db.schema.dropTable('program_grouping_external_id').execute();

    // this.addSql(
    //   'alter table `program_grouping_external_id__temp_alter` rename to `program_grouping_external_id`;',
    // );
    await db.schema
      .alterTable('program_grouping_external_id_temp_alter')
      .renameTo('program_grouping_external_id')
      .execute();

    // this.addSql(
    //   'create index `program_grouping_external_id_group_uuid_index` on `program_grouping_external_id` (`group_uuid`);',
    // );
    // this.addSql(
    //   'create unique index `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);',
    // );
    await db.schema
      .createIndex('program_grouping_external_id_group_uuid_index')
      .ifNotExists()
      .on('program_grouping_external_id')
      .column('group_uuid')
      .execute();

    /**
     * create unique index `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);
     */
    await db.schema
      .createIndex('program_grouping_external_id_uuid_source_type_unique')
      .ifNotExists()
      .on('program_grouping_external_id')
      .columns(['uuid', 'source_type'])
      .unique()
      .execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },
};
