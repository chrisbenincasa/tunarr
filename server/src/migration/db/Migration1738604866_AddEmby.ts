import { CompiledQuery, sql, type Kysely } from 'kysely';
import { copyTable, swapTables } from '../../db/migrationUtil.ts';

export default {
  fullCopy: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async up(db: Kysely<any>) {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    // Alter programs.
    // Create all child tables first, so we don't lose foreign keys

    const createProgramGroupingExternalIdTemp = sql`
CREATE TABLE IF NOT EXISTS "program_external_id_temp" (
    "uuid" text not null primary key,
    "created_at" datetime,
    "updated_at" datetime,
    "source_type" text not null check ((\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby', 'local'))),
    "external_source_id" text,
    "external_key" text not null,
    "external_file_path" text,
    "direct_file_path" text,
    "program_uuid" text not null,
    constraint "program_external_id_program_uuid_foreign" foreign key ("program_uuid") references "program" ("uuid") on update cascade
  );
`;

    await db.executeQuery(createProgramGroupingExternalIdTemp.compile(db));
    await copyTable(db, 'program_external_id', 'program_external_id_temp');

    const createChannelprogramsTemp = sql`
CREATE TABLE IF NOT EXISTS "channel_programs_tmp" (
  "channel_uuid" text not null,
  "program_uuid" text not null,
  constraint "primary_key" primary key ("channel_uuid", "program_uuid"),
  constraint "channel_programs_channel_uuid_foreign" foreign key ("channel_uuid") references "channel" ("uuid") on delete cascade on update cascade,
  constraint "channel_programs_program_uuid_foreign" foreign key ("program_uuid") references "program" ("uuid") on delete cascade on update cascade);
`;

    await db.executeQuery(createChannelprogramsTemp.compile(db));
    await copyTable(db, 'channel_programs', 'channel_programs_tmp');

    const createFillerContentTemp = sql`
CREATE TABLE IF NOT EXISTS "filler_show_content_tmp" (
  "filler_show_uuid" text not null,
  "program_uuid" text not null,
  "index" integer not null,
  constraint "filler_show_content_filler_show_uuid_foreign" foreign key ("filler_show_uuid") references "filler_show" ("uuid") on delete cascade on update cascade,
  constraint "filler_show_content_program_uuid_foreign" foreign key ("program_uuid") references "program" ("uuid") on delete cascade on update cascade,
  constraint "primary_key" primary key ("filler_show_uuid", "program_uuid"));    
`;

    await db.executeQuery(createFillerContentTemp.compile(db));
    await copyTable(db, 'filler_show_content', 'filler_show_content_tmp');

    const createChannelFallbackTemp = sql`
CREATE TABLE IF NOT EXISTS "channel_fallback_tmp" (
  "channel_uuid" text not null,
  "program_uuid" text not null,
  constraint "channel_fallback_channel_uuid_foreign" foreign key ("channel_uuid") references "channel" ("uuid") on delete cascade on update cascade,
  constraint "channel_fallback_program_uuid_foreign" foreign key ("program_uuid") references "program" ("uuid") on delete cascade on update cascade,
  constraint "primary_key" primary key ("channel_uuid", "program_uuid"));
`;

    await db.executeQuery(createChannelFallbackTemp.compile(db));
    await copyTable(db, 'channel_fallback', 'channel_fallback_tmp');

    const createCustomShowContentTemp = sql`
CREATE TABLE IF NOT EXISTS "custom_show_content_tmp" (
    "custom_show_uuid" text not null,
    "content_uuid" text not null,
    "index" integer not null,
    constraint "custom_show_content_custom_show_uuid_foreign" foreign key ("custom_show_uuid") references "custom_show" ("uuid") on delete cascade on update cascade,
    constraint "custom_show_content_content_uuid_foreign" foreign key ("content_uuid") references "program" ("uuid") on delete cascade on update cascade,
    constraint "primary_key" primary key ("custom_show_uuid", "content_uuid")
);
`;

    await db.executeQuery(createCustomShowContentTemp.compile(db));
    await copyTable(db, 'custom_show_content', 'custom_show_content_tmp');

    const createProgramTableTemp = sql`
CREATE TABLE IF NOT EXISTS "program_tmp" (
  "uuid" text not null primary key,
  "created_at" datetime,
  "updated_at" datetime,
  "source_type" text not null check ((\`source_type\` in ('plex', 'jellyfin', 'emby', 'local'))),
  "original_air_date" text,
  "duration" integer not null,
  "episode" integer,
  "episode_icon" text,
  "file_path" text,
  "icon" text,
  "external_source_id" text not null,
  "external_key" text not null,
  "plex_rating_key" text,
  "plex_file_path" text,
  "parent_external_key" text,
  "grandparent_external_key" text,
  "rating" text,
  "season_number" integer,
  "season_icon" text,
  "show_icon" text,
  "show_title" text,
  "summary" text,
  "title" text not null,
  "type" text not null check ((\`type\` in ('movie', 'episode', 'track'))),
  "year" integer,
  "artist_name" text,
  "album_name" text,
  "season_uuid" text,
  "album_uuid" text,
  "artist_uuid" text,
  "tv_show_uuid" text,
  constraint "program_season_uuid_foreign" foreign key ("season_uuid") references "program_grouping" ("uuid") on update cascade,
  constraint "program_album_uuid_foreign" foreign key ("album_uuid") references "program_grouping" ("uuid") on update cascade,
  constraint "program_artist_uuid_foreign" foreign key ("artist_uuid") references "program_grouping" ("uuid") on update cascade,
  constraint "program_tv_show_uuid_foreign" foreign key ("tv_show_uuid") references "program_grouping" ("uuid") on update cascade);
`;

    await db.executeQuery(createProgramTableTemp.compile(db));
    await copyTable(db, 'program', 'program_tmp');

    await swapTables(db, 'program_external_id', 'program_external_id_temp');
    await swapTables(db, 'channel_programs', 'channel_programs_tmp');
    await swapTables(db, 'filler_show_content', 'filler_show_content_tmp');
    await swapTables(db, 'channel_fallback', 'channel_fallback_tmp');
    await swapTables(db, 'custom_show_content', 'custom_show_content_tmp');
    await swapTables(db, 'program', 'program_tmp');

    const indexes = [
      `CREATE INDEX "program_external_id_program_uuid_index" on "program_external_id" ("program_uuid")`,
      `CREATE UNIQUE INDEX "unique_program_multiple_external_id" on "program_external_id" ("program_uuid", "source_type", "external_source_id") where \`external_source_id\` is not null`,
      `CREATE UNIQUE INDEX "unique_program_single_external_id" on "program_external_id" ("program_uuid", "source_type") where \`external_source_id\` is null`,
      `CREATE INDEX "program_season_uuid_index" on "program" ("season_uuid")`,
      `CREATE INDEX "program_tv_show_uuid_index" on "program" ("tv_show_uuid")`,
      `CREATE INDEX "program_album_uuid_index" on "program" ("album_uuid")`,
      `CREATE INDEX "program_artist_uuid_index" on "program" ("artist_uuid")`,
      `CREATE UNIQUE INDEX "program_source_type_external_source_id_external_key_unique" on "program" ("source_type", "external_source_id", "external_key")`,
      `CREATE UNIQUE INDEX "custom_show_content_custom_show_uuid_content_uuid_index_unique" on "custom_show_content" ("custom_show_uuid", "content_uuid", "index")`,
      `CREATE UNIQUE INDEX \`filler_show_content_filler_show_uuid_program_uuid_index_unique\` on \`filler_show_content\` (\`filler_show_uuid\`, \`program_uuid\`, \`index\`)`,
    ];
    for (const index of indexes) {
      await db.executeQuery(CompiledQuery.raw(index));
    }

    // END programs copy

    const createProgramGroupExternalIdTemp = sql`
CREATE TABLE IF NOT EXISTS "program_grouping_external_id_tmp" (
  "uuid" text not null primary key,
  "created_at" datetime,
  "updated_at" datetime,
  "source_type" text not null check ((\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby', 'local'))),
  "external_source_id" text,
  "external_key" text not null,
  "group_uuid" text not null,
  "external_file_path" text,
  constraint "program_grouping_external_id_group_uuid_foreign" foreign key ("group_uuid") references "program_grouping" ("uuid") on delete cascade on update cascade
);
`;
    await db.executeQuery(createProgramGroupExternalIdTemp.compile(db));
    await copyTable(
      db,
      'program_grouping_external_id',
      'program_grouping_external_id_tmp',
    );

    const createProgramGroupingTemp = sql`
CREATE TABLE IF NOT EXISTS "program_grouping_tmp" (
  "uuid" text not null primary key,
  "created_at" datetime,
  "updated_at" datetime,
  "type" text not null check ((\`type\` in ('album', 'artist', 'season', 'show'))),
  "title" text not null,
  "summary" text,
  "icon" text,
  "year" integer,
  "index" integer,
  "show_uuid" text,
  "artist_uuid" text,
  constraint "program_grouping_show_uuid_foreign" foreign key ("show_uuid") references "program_grouping" ("uuid") on delete cascade on update cascade, 
  constraint "program_grouping_artist_uuid_foreign" foreign key ("artist_uuid") references "program_grouping" ("uuid") on delete cascade on update cascade
);
`;

    await db.executeQuery(createProgramGroupingTemp.compile(db));

    await copyTable(db, 'program_grouping', 'program_grouping_tmp');

    await swapTables(
      db,
      'program_grouping_external_id',
      'program_grouping_external_id_tmp',
    );
    await swapTables(db, 'program_grouping', 'program_grouping_tmp');

    const programGroupingIndexes = [
      `CREATE INDEX "program_grouping_show_uuid_index" on "program_grouping" ("show_uuid")`,
      `CREATE INDEX "program_grouping_artist_uuid_index" on "program_grouping" ("artist_uuid")`,
    ];

    for (const index of programGroupingIndexes) {
      await db.executeQuery(CompiledQuery.raw(index));
    }

    /**
     * CREATE TABLE IF NOT EXISTS "media_source" ("uuid" text not null primary key,
     * "created_at" datetime,
     * "updated_at" datetime,
     * "name" text not null,
     * "uri" text not null,
     * "access_token" text not null,
     * "send_guide_updates" boolean default true not null,
     * "send_channel_updates" boolean default true not null,
     * "index" integer not null,
     * "client_identifier" text,
     * "type" text default 'plex' not null check ((`type` in ('plex', 'jellyfin'))));
       CREATE UNIQUE INDEX "media_source_type_name_uri_unique" on "media_source" ("type", "name", "uri");
     */
    await db.schema
      .createTable('media_source_alter_temp')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('uri', 'text', (col) => col.notNull())
      .addColumn('access_token', 'text', (col) => col.notNull())
      .addColumn('send_guide_updates', 'boolean', (col) =>
        col.defaultTo(false).notNull(),
      )
      .addColumn('send_channel_updates', 'boolean', (col) =>
        col.defaultTo(false).notNull(),
      )
      .addColumn('index', 'integer', (col) => col.notNull())
      .addColumn('client_identifier', 'text')
      .addColumn('type', 'text', (col) =>
        col
          .notNull()
          .check(sql`(\`type\`) in ('plex', 'jellyfin', 'emby', 'local')`),
      )
      .execute();

    const columns = [
      'uuid',
      'created_at',
      'updated_at',
      'name',
      'uri',
      'access_token',
      'send_guide_updates',
      'send_channel_updates',
      'index',
      'client_identifier',
      'type',
    ];
    await db
      .insertInto('media_source_alter_temp')
      .columns(columns)
      .expression(db.selectFrom('media_source').select(columns))
      .execute();

    await db.schema
      .alterTable('media_source')
      .renameTo('media_source_old')
      .execute();
    await db.schema
      .alterTable('media_source_alter_temp')
      .renameTo('media_source')
      .execute();

    await db.schema.dropTable('media_source_old').execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },

  async down() {},
};
