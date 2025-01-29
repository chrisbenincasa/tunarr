import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable('channel')
      .addColumn('stream_mode', 'text', (b) =>
        b
          .check(sql`(\`stream_mode\`) in ('hls', 'hls_slower', 'mpegts')`)
          .notNull()
          .defaultTo('hls'),
      )
      .execute();
    // this.addSql(
    //   "alter table `channel` add column `stream_mode` text check (`stream_mode` in ('hls', 'hls_slower', 'mpegts')) not null default 'hls';",
    // );
  },

  async down(db: Kysely<unknown>): Promise<void> {
    // this.addSql('alter table `channel` drop column `stream_mode`;');
    await db.schema.alterTable('channel').dropColumn('stream_mode').execute();
  },
};
