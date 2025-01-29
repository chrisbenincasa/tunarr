import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    // create unique index if not exists `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NOT NULL;
    await db.schema
      .createIndex('unique_program_multiple_external_id')
      .ifNotExists()
      .on('program_external_id')
      .columns(['program_uuid', 'source_type'])
      .where(sql`\`external_source_id\``, 'is not', null)
      .execute();

    // This was bugged in the legacy migration, just dupe it here because we're keepingn everything the same...
    // create unique index if not exists `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL;
    await db.schema
      .createIndex('unique_program_single_external_id')
      .ifNotExists()
      .on('program_external_id')
      .columns(['program_uuid', 'source_type'])
      .where(sql`\`external_source_id\``, 'is', null)
      .execute();
  },
};
