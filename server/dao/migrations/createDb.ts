import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('plexServerSettings')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('plexServerSettings').execute();
}
