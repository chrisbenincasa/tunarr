import type { Kysely } from 'kysely';
import { find, map, sortBy } from 'lodash-es';

export async function copyTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: Kysely<any>,
  oldTableName: string,
  newTableName: string,
) {
  const tables = await db.introspection.getTables();

  const oldTable = find(tables, { name: oldTableName });
  if (!oldTable) {
    throw new Error(
      `Table ${oldTableName} doesn't exist. All tables: Tables ${map(
        tables,
        (table) => table.name,
      ).join(', ')}`,
    );
  }

  const newTable = find(tables, { name: newTableName });
  if (!newTable) {
    throw new Error(
      `Table ${newTableName} doesn't exist. Tables ${map(
        tables,
        (table) => table.name,
      ).join(', ')}`,
    );
  }

  const oldColumns = map(
    sortBy(oldTable.columns, (col) => col.name),
    (col) => col.name,
  );

  await db
    .insertInto(newTableName)
    .columns([...oldColumns])
    .expression(db.selectFrom(oldTableName).select([...oldColumns]))
    .execute();
}

export async function swapTables(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: Kysely<any>,
  oldTableName: string,
  newTableName: string,
  copy = false,
) {
  if (copy) await copyTable(db, oldTableName, newTableName);
  await db.schema.dropTable(oldTableName).execute();
  await db.schema.alterTable(newTableName).renameTo(oldTableName).execute();
}
