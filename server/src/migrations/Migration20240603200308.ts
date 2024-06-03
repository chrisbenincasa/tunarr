import { Migration } from '@mikro-orm/migrations';

export class Migration20240603200308 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop index `program_external_id_uuid_source_type_unique`;');

    this.addSql('create unique index `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NOT NULL;;');
    this.addSql('create unique index `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL;;');

    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql('CREATE TABLE `_knex_temp_alter516` (`uuid` text NOT NULL, `created_at` datetime NULL, `updated_at` datetime NULL, `source_type` text check (`source_type` in (\'plex\', \'plex-guid\', \'imdb\', \'tmdb\', \'tvdb\')) NOT NULL CHECK (`source_type` in(\'plex\')), `external_source_id` text, `external_key` text NOT NULL, `external_file_path` text NULL, `group_uuid` text NOT NULL, CONSTRAINT `program_grouping_external_id_group_uuid_foreign` FOREIGN KEY (`group_uuid`) REFERENCES `program_grouping` (`uuid`) ON UPDATE CASCADE, PRIMARY KEY (`uuid`));');
    this.addSql('INSERT INTO "_knex_temp_alter516" SELECT * FROM "program_grouping_external_id";;');
    this.addSql('DROP TABLE "program_grouping_external_id";');
    this.addSql('ALTER TABLE "_knex_temp_alter516" RENAME TO "program_grouping_external_id";');
    this.addSql('CREATE INDEX `program_grouping_external_id_group_uuid_index` on `program_grouping_external_id` (`group_uuid`);');
    this.addSql('CREATE UNIQUE INDEX `program_grouping_external_id_uuid_source_type_unique` on `program_grouping_external_id` (`uuid`, `source_type`);');
    this.addSql('PRAGMA foreign_keys = ON;');
  }

}
