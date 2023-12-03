import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  const query = db.schema
    .createTable('plexServerSettings')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('uri', 'text', (col) => col.notNull())
    .addColumn('access_token', 'text', (col) => col.notNull())
    .addColumn('send_guide_updates', 'integer', (col) =>
      col.notNull().defaultTo(sql`TRUE`),
    )
    .addColumn('send_channel_updates', 'integer', (col) =>
      col.notNull().defaultTo(sql`TRUE`),
    )
    .addColumn('index', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`(unixepoch())`),
    );
  console.log(query.compile());
  return query.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('plexServerSettings').execute();
}
