import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    // this.addSql('alter table `plex_server_settings` rename to `media_source`;');
    await db.schema
      .alterTable('plex_server_settings')
      .renameTo('media_source')
      .execute();

    await db.schema
      .alterTable('media_source')
      .addColumn('type', 'text', (b) =>
        b
          .check(sql`(\`type\` in ('plex', 'jellyfin'))`)
          .notNull()
          .defaultTo('plex'),
      )
      .execute();

    // this.addSql(
    //   "alter table `media_source` add column `type` text check (`type` in ('plex', 'jellyfin')) not null default 'plex';",
    // );

    await db.schema
      .dropIndex('plex_server_settings_name_uri_unique')
      .ifExists()
      .execute();

    // this.addSql('drop index if exists `plex_server_settings_name_uri_unique`;');
    await db.schema
      .createIndex('media_source_type_name_uri_unique')
      .on('media_source')
      .columns(['type', 'name', 'uri'])
      .unique()
      .execute();

    // this.addSql(
    //   'create unique index `media_source_type_name_uri_unique` on `media_source` (`type`, `name`, `uri`);',
    // );
  },

  // async down(db: Kysely<unknown>) {
  // this.addSql('alter table `media_source` drop column `type`');
  // this.addSql('alter table `media_source` rename to `plex_server_settings`;');
  // this.addSql('drop index if exists `media_source_type_name_uri_unique`;');
  // this.addSql(
  //   'CREATE UNIQUE INDEX `plex_server_settings_name_uri_unique` on `plex_server_settings` (`name`, `uri`);',
  // );
  // }
};
