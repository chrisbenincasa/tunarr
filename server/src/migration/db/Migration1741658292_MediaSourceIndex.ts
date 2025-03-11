import type { Kysely, Migration } from 'kysely';

export default {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createIndex('media_source_type_name_uri_unique')
      .ifNotExists()
      .on('media_source')
      .columns(['type', 'name', 'uri'])
      .unique()
      .execute();
  },
} satisfies Migration;
