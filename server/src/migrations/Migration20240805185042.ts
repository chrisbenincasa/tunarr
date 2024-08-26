import { Migration } from '@mikro-orm/migrations';

export class Migration20240805185042 extends Migration {
  async up(): Promise<void> {
    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql('PRAGMA defer_foreign_keys = ON;');
    this.addSql(
      'create table `program_grouping__temp_alter` (`uuid` text not null, `created_at` datetime not null, `updated_at` datetime not null, `type` ProgramGroupingType not null, `title` text not null, `summary` text null, `icon` text null, `year` integer null, `index` integer null, `show_uuid` text null, `artist_uuid` text null, constraint `program_grouping_show_uuid_foreign` foreign key(`show_uuid`) references `program_grouping__temp_alter`(`uuid`) on delete set null on update cascade, constraint `program_grouping_artist_uuid_foreign` foreign key(`artist_uuid`) references `program_grouping__temp_alter`(`uuid`) on delete set null on update cascade, primary key (`uuid`));',
    );
    this.addSql(
      'insert into `program_grouping__temp_alter` select * from `program_grouping`;',
    );
    this.addSql('drop table `program_grouping`;');
    this.addSql(
      'alter table `program_grouping__temp_alter` rename to `program_grouping`;',
    );
    this.addSql(
      'create index `program_grouping_show_uuid_index` on `program_grouping` (`show_uuid`);',
    );
    this.addSql(
      'create index `program_grouping_artist_uuid_index` on `program_grouping` (`artist_uuid`);',
    );
    this.addSql(
      "create table `program__temp_alter` (`uuid` text not null, `created_at` datetime not null, `updated_at` datetime not null, `source_type` text check (`source_type` in ('plex', 'jellyfin')) not null, `original_air_date` text null, `duration` integer not null, `episode` integer null, `episode_icon` text null, `file_path` text null, `icon` text null, `external_source_id` text not null, `external_key` text not null, `plex_rating_key` text null, `plex_file_path` text null, `parent_external_key` text null, `grandparent_external_key` text null, `rating` text null, `season_number` integer null, `season_icon` text null, `show_icon` text null, `show_title` text null, `summary` text null, `title` text not null, `type` text check (`type` in ('movie', 'episode', 'track')) not null, `year` integer null, `artist_name` text null, `album_name` text null, `season_uuid` text null, `tv_show_uuid` text null, `album_uuid` text null, `artist_uuid` text null, constraint `program_season_uuid_foreign` foreign key(`season_uuid`) references `program_grouping`(`uuid`) on delete set null, constraint `program_tv_show_uuid_foreign` foreign key(`tv_show_uuid`) references `program_grouping`(`uuid`) on delete set null, constraint `program_album_uuid_foreign` foreign key(`album_uuid`) references `program_grouping`(`uuid`) on delete set null, constraint `program_artist_uuid_foreign` foreign key(`artist_uuid`) references `program_grouping`(`uuid`) on delete set null, primary key (`uuid`));",
    );

    // Create a channel_programs table without a foreign key reference as a backup.
    // Deleting the program table in the migration deletes all of the references
    this.addSql(
      'CREATE TABLE `channel_programs__temp_alter` (`channel_uuid` text not null, `program_uuid` text not null, constraint `channel_programs_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade, constraint `channel_programs_program_uuid_foreign` foreign key(`program_uuid`) references `program__temp_alter`(`uuid`) on delete cascade on update cascade primary key (`channel_uuid`, `program_uuid`));',
    );

    this.addSql('insert into `program__temp_alter` select * from `program`;');
    this.addSql(
      'insert into `channel_programs__temp_alter` select * from `channel_programs`;',
    );

    this.addSql('drop table `program`;');
    this.addSql('drop table `channel_programs`;');
    this.addSql('alter table `program__temp_alter` rename to `program`;');
    this.addSql(
      'alter table `channel_programs__temp_alter` rename to `channel_programs`;',
    );

    this.addSql(
      'create index `program_season_uuid_index` on `program` (`season_uuid`);',
    );
    this.addSql(
      'create index `program_tv_show_uuid_index` on `program` (`tv_show_uuid`);',
    );
    this.addSql(
      'create index `program_album_uuid_index` on `program` (`album_uuid`);',
    );
    this.addSql(
      'create index `program_artist_uuid_index` on `program` (`artist_uuid`);',
    );
    this.addSql(
      'create index `program_source_type_external_source_id_plex_rating_key_index` on `program` (`source_type`, `external_source_id`, `plex_rating_key`);',
    );
    this.addSql(
      'create unique index `program_source_type_external_source_id_external_key_unique` on `program` (`source_type`, `external_source_id`, `external_key`);',
    );
    this.addSql(
      "create table `program_external_id__temp_alter` (`uuid` text not null, `created_at` datetime not null, `updated_at` datetime not null, `source_type` text check (`source_type` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin')) not null, `external_source_id` text null, `external_key` text not null, `external_file_path` text null, `direct_file_path` text null, `program_uuid` text not null, constraint `program_external_id_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on update cascade, primary key (`uuid`));",
    );
    this.addSql(
      'insert into `program_external_id__temp_alter` select * from `program_external_id`;',
    );
    this.addSql('drop table `program_external_id`;');
    this.addSql(
      'alter table `program_external_id__temp_alter` rename to `program_external_id`;',
    );
    this.addSql(
      'create index `program_external_id_program_uuid_index` on `program_external_id` (`program_uuid`);',
    );
    this.addSql(
      'create unique index `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`, `external_source_id`) WHERE `external_source_id` IS NOT NULL;',
    );
    this.addSql(
      'create unique index `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL;',
    );
    this.addSql(
      "create table `program_grouping_external_id__temp_alter` (`uuid` text not null, `created_at` datetime not null, `updated_at` datetime not null, `source_type` text check (`source_type` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin')) not null, `external_source_id` text null, `external_key` text not null, `external_file_path` text null, `group_uuid` text not null, constraint `program_grouping_external_id_group_uuid_foreign` foreign key(`group_uuid`) references `program_grouping`(`uuid`) on update cascade, primary key (`uuid`));",
    );
    this.addSql(
      'insert into `program_grouping_external_id__temp_alter` select * from `program_grouping_external_id`;',
    );
    this.addSql('drop table `program_grouping_external_id`;');
    this.addSql(
      'alter table `program_grouping_external_id__temp_alter` rename to `program_grouping_external_id`;',
    );
    this.addSql(
      'create index `program_grouping_external_id_group_uuid_index` on `program_grouping_external_id` (`group_uuid`);',
    );
    this.addSql(
      'create unique index `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);',
    );
    this.addSql('PRAGMA foreign_keys = ON;');
    this.addSql('PRAGMA defer_foreign_keys = OFF;');
  }
}
