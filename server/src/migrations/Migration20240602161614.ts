import { Migration } from '@mikro-orm/migrations';

export class Migration20240602161614 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'drop index if exists `program_external_id_uuid_source_type_unique`;',
    );

    this.addSql(
      'create unique index if not exists `program_external_id_program_uuid_source_type_external_source_id_unique` on `program_external_id` (`program_uuid`, `source_type`, `external_source_id`);',
    );

    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql(
      "CREATE TABLE `_knex_temp_alter101` (`uuid` text NOT NULL, `created_at` datetime NULL, `updated_at` datetime NULL, `source_type` text check (`source_type` in ('plex', 'plex-guid', 'imdb', 'tmdb', 'tvdb')) NOT NULL, `external_source_id` text, `external_key` text NOT NULL, `external_file_path` text NULL, `group_uuid` text NOT NULL, CONSTRAINT `program_grouping_external_id_group_uuid_foreign` FOREIGN KEY (`group_uuid`) REFERENCES `program_grouping` (`uuid`) ON UPDATE CASCADE, PRIMARY KEY (`uuid`));",
    );
    this.addSql(
      'INSERT INTO "_knex_temp_alter101" SELECT * FROM "program_grouping_external_id";;',
    );
    this.addSql('DROP TABLE "program_grouping_external_id";');
    this.addSql(
      'ALTER TABLE "_knex_temp_alter101" RENAME TO "program_grouping_external_id";',
    );
    this.addSql(
      'CREATE INDEX if not exists `program_grouping_external_id_group_uuid_index` on `program_grouping_external_id` (`group_uuid`);',
    );
    this.addSql(
      'CREATE UNIQUE INDEX if not exists `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);',
    );

    this.addSql(
      "CREATE TABLE `_knex_temp_alter102` (`uuid` text not null, `created_at` datetime null, `updated_at` datetime null, `source_type` text check (`source_type` in ('plex', 'plex-guid', 'imdb', 'tmdb', 'tvdb')) not null, `external_source_id` text null, `external_key` text not null, `external_file_path` text null, `direct_file_path` text null, `program_uuid` text not null, constraint `program_external_id_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on update cascade, primary key (`uuid`));",
    );
    this.addSql(
      'INSERT INTO "_knex_temp_alter102" SELECT * FROM "program_external_id";',
    );
    this.addSql('DROP TABLE "program_external_id";');
    this.addSql(
      'ALTER TABLE "_knex_temp_alter102" RENAME TO "program_external_id";',
    );

    this.addSql('PRAGMA foreign_keys = ON;');
  }
}
