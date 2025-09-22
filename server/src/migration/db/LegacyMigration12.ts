import type { Kysely } from 'kysely';
import { CompiledQuery, sql } from 'kysely';
import type {
  ProgramExternalIdSourceType,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from '../../db/schema/base.js';

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

type DBTemp = {
  programExternalIdAlter: CurrentProgramExternalIdTable;
  programExternalId: CurrentProgramExternalIdTable;
};

/**
 * Fixes the bug with the conditional indexes
 */
export default {
  async up(db: Kysely<DBTemp>): Promise<void> {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));

    /**
     * CREATE TABLE `_knex_temp_alter808` (
     *  `uuid` text NOT NULL,
     * `created_at` datetime NULL,
     * `updated_at` datetime NULL,
     * `source_type` text check (`source_type` in ('plex',
     * 'plex-guid',
     * 'tmdb',
     * 'imdb',
     * 'tvdb')) NOT NULL,
     * `external_source_id` text NULL,
     * `external_key` text NOT NULL,
     * `external_file_path` text NULL,
     * `direct_file_path` text NULL,
     * `program_uuid` text NOT NULL,
     * CONSTRAINT `program_external_id_program_uuid_foreign` FOREIGN KEY (`program_uuid`) REFERENCES `program` (`uuid`) ON UPDATE CASCADE,
     * PRIMARY KEY (`uuid`));
     */
    await db.schema
      .createTable('program_external_id_alter')
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('created_at', 'datetime')
      .addColumn('updated_at', 'datetime')
      .addColumn('source_type', 'text', (b) =>
        b
          .check(
            sql`(\`source_type\` in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb'))`,
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

    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));

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
  },
};
