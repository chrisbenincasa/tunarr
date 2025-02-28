import { type Kysely, CompiledQuery, sql } from 'kysely';

export default {
  fullCopy: true,
  async up(db: Kysely<unknown>) {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

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
  "media_source_id" text references "media_source" ("uuid") on delete cascade,
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

    const createProgramGroupingExternalIdTemp = sql`
CREATE TABLE IF NOT EXISTS "program_external_id_temp" (
    "uuid" text not null primary key,
    "created_at" datetime,
    "updated_at" datetime,
    "source_type" text not null check ((\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby', 'local'))),
    "external_source_id" text,
    "media_source_id" text references "media_source" ("uuid") on delete cascade,
    "external_key" text not null,
    "external_file_path" text,
    "direct_file_path" text,
    "program_uuid" text not null,
    constraint "program_external_id_program_uuid_foreign" foreign key ("program_uuid") references "program" ("uuid") on delete cascade
  );
`;

    await db.executeQuery(createProgramGroupingExternalIdTemp.compile(db));

    const createProgramGroupExternalIdTemp = sql`
CREATE TABLE IF NOT EXISTS "program_grouping_external_id_tmp" (
  "uuid" text not null primary key,
  "created_at" datetime,
  "updated_at" datetime,
  "source_type" text not null check ((\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby', 'local'))),
  "external_source_id" text,
  "media_source_id" text references "media_source" ("uuid") on delete cascade,
  "external_key" text not null,
  "group_uuid" text not null,
  "external_file_path" text,
  constraint "program_grouping_external_id_group_uuid_foreign" foreign key ("group_uuid") references "program_grouping" ("uuid") on delete cascade on update cascade
);
`;
    await db.executeQuery(createProgramGroupExternalIdTemp.compile(db));

    const indexes = [
      // Programs
      'DROP INDEX IF EXISTS "program_season_uuid_index"',
      'CREATE INDEX "program_season_uuid_index" on "program_tmp" ("season_uuid")',
      'DROP INDEX IF EXISTS "program_tv_show_uuid_index"',
      'CREATE INDEX "program_tv_show_uuid_index" on "program_tmp" ("tv_show_uuid")',
      'DROP INDEX IF EXISTS "program_album_uuid_index"',
      'CREATE INDEX "program_album_uuid_index" on "program_tmp" ("album_uuid")',
      'DROP INDEX IF EXISTS "program_artist_uuid_index"',
      'CREATE INDEX "program_artist_uuid_index" on "program_tmp" ("artist_uuid")',
      'DROP INDEX IF EXISTS "program_source_type_external_source_id_external_key_unique"',
      'CREATE UNIQUE INDEX "program_source_type_external_source_id_external_key_unique" on "program_tmp" ("source_type", "external_source_id", "external_key")',
      // New one
      'CREATE UNIQUE INDEX "program_media_source_uniq" on "program_tmp" ("source_type", "media_source_id", "external_key")',
      // Program external IDs
      'DROP INDEX IF EXISTS "unique_program_multiple_external_id"',
      'DROP INDEX IF EXISTS "unique_program_single_external_id"',
      `CREATE UNIQUE INDEX "unique_program_multiple_external_id" on "program_external_id_temp" ("program_uuid", "source_type", "external_source_id") where \`external_source_id\` is not null`,
      `CREATE UNIQUE INDEX "unique_program_single_external_id" on "program_external_id_temp" ("program_uuid", "source_type") where \`external_source_id\` is null`,
      // New indexes on program external ids
      `CREATE UNIQUE INDEX "unique_program_multiple_external_id_media_source" on "program_external_id_temp" ("program_uuid", "source_type", "media_source_id") where \`media_source_id\` is not null`,
      `CREATE UNIQUE INDEX "unique_program_single_external_id_media_source" on "program_external_id_temp" ("program_uuid", "source_type") where \`media_source_id\` is null`,
      // Program grouping external IDs
      // 'DROP INDEX IF EXISTS "unique_program_multiple_external_id"',
      // 'DROP INDEX IF EXISTS "unique_program_single_external_id"',
      // `CREATE UNIQUE INDEX "unique_program_multiple_external_id" on "program_grouping_external_id_tmp" ("program_uuid", "source_type", "external_source_id") where \`external_source_id\` is not null`,
      // `CREATE UNIQUE INDEX "unique_program_single_external_id" on "program_grouping_external_id_tmp" ("program_uuid", "source_type") where \`external_source_id\` is null`,
      // New indexes on program external ids
      `CREATE UNIQUE INDEX "unique_program_grouping_multiple_external_id_media_source" on "program_grouping_external_id_tmp" ("group_uuid", "source_type", "media_source_id") where \`media_source_id\` is not null`,
      `CREATE UNIQUE INDEX "unique_program_grouping_single_external_id_media_source" on "program_grouping_external_id_tmp" ("group_uuid", "source_type") where \`media_source_id\` is null`,
    ];

    await db.executeQuery(createProgramTableTemp.compile(db));

    for (const idx of indexes) {
      await db.executeQuery(CompiledQuery.raw(idx));
    }

    await db.schema.dropTable('program').execute();
    await db.schema.alterTable('program_tmp').renameTo('program').execute();
    await db.schema.dropTable('program_external_id').execute();
    await db.schema
      .alterTable('program_external_id_temp')
      .renameTo('program_external_id')
      .execute();
    await db.schema.dropTable('program_grouping_external_id').execute();
    await db.schema
      .alterTable('program_grouping_external_id_tmp')
      .renameTo('program_grouping_external_id')
      .execute();

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },
};
