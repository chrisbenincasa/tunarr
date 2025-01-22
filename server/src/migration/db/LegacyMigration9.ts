import type { Kysely, Migration } from 'kysely';
import { sql } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('program_external_id').ifExists().execute();
    await db.schema
      .dropIndex('program_external_id_program_uuid_index')
      .ifExists()
      .execute();
    await db.schema
      .dropIndex('program_external_id_uuid_source_type_unique')
      .ifExists()
      .execute();
    /**
     * create table `program_external_id` (`uuid` text not null
     * `created_at` datetime null
     * `updated_at` datetime null
     * `source_type` text check (`source_type` in ('plex', 'plex-guid')) not null
     * `external_source_id` text null
     * `external_key` text not null
     * `external_file_path` text null
     * `direct_file_path` text null
     * `program_uuid` text not null
     * constraint `program_external_id_program_uuid_foreign` foreign key(`program_uuid`) references `program`(`uuid`) on update cascade
     * primary key (`uuid`));
     */
    await db.schema
      .createTable('program_external_id')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (b) =>
        b.check(sql`(\`source_type\` in ('plex', 'plex-guid'))`).notNull(),
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
      .ifNotExists()
      .execute();

    //create index `program_external_id_program_uuid_index` on `program_external_id` (`program_uuid`);
    await db.schema
      .createIndex('program_external_id_program_uuid_index')
      .on('program_external_id')
      .column('program_uuid')
      .ifNotExists()
      .execute();

    // create unique index `program_external_id_uuid_source_type_unique` on `program_external_id` (`uuid`, `source_type`);
    await db.schema
      .createIndex('program_external_id_uuid_source_type_unique')
      .on('program_external_id')
      .columns(['uuid', 'source_type'])
      .unique()
      .ifNotExists()
      .execute();
  },
} satisfies Migration;
