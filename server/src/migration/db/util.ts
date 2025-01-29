import type { Kysely } from 'kysely';

export async function columnExists(
  db: Kysely<unknown>,
  tableName: string,
  colName: string,
): Promise<boolean> {
  const tables = await db.introspection.getTables();
  return (
    tables
      .find((table) => table.name === tableName)
      ?.columns.some((col) => col.name === colName) ?? false
  );
}
