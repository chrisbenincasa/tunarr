import { Migration } from '@mikro-orm/migrations';

export class Migration20240719145409 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `plex_server_settings` rename to `media_source`;');
    this.addSql(
      "alter table `media_source` add column `type` text check (`type` in ('plex', 'jellyfin')) not null default 'plex';",
    );
    this.addSql('drop index if exists `plex_server_settings_name_uri_unique`;');
    this.addSql(
      'create unique index `media_source_type_name_uri_unique` on `media_source` (`type`, `name`, `uri`);',
    );
  }

  async down() {
    this.addSql('alter table `media_source` drop column `type`');
    this.addSql('alter table `media_source` rename to `plex_server_settings`;');
    this.addSql('drop index if exists `media_source_type_name_uri_unique`;');
    this.addSql(
      'CREATE UNIQUE INDEX `plex_server_settings_name_uri_unique` on `plex_server_settings` (`name`, `uri`);',
    );
  }
}
