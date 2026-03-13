import { CompiledQuery } from 'kysely';
import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';

export default {
  fullCopy: true,
  async up(db) {
    const statements = [
      'PRAGMA foreign_keys = OFF',
      'ALTER TABLE `custom_show_content` RENAME TO `old_custom_show_content`',
      `
      CREATE TABLE IF NOT EXISTS "custom_show_content" (
        "custom_show_uuid" text not null,
        "content_uuid" text not null,
        "index" integer not null,
        constraint "custom_show_content_custom_show_uuid_foreign" foreign key ("custom_show_uuid") references "custom_show" ("uuid") on delete cascade on update cascade,
        constraint "custom_show_content_content_uuid_foreign" foreign key ("content_uuid") references "program" ("uuid") on delete cascade on update cascade,
        constraint "primary_key" primary key ("custom_show_uuid", "content_uuid", "index")
      )
      `,
      'INSERT INTO `custom_show_content`(custom_show_uuid, content_uuid, "index") SELECT custom_show_uuid, content_uuid, "index" FROM `old_custom_show_content`',
      'DROP TABLE `old_custom_show_content`',
      'PRAGMA foreign_keys = ON',
    ];

    for (const statement of statements) {
      await db.executeQuery(CompiledQuery.raw(statement.trim()));
    }
  },
} satisfies TunarrDatabaseMigration;
