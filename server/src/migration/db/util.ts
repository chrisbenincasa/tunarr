import { CompiledQuery, type Kysely } from 'kysely';
import { isNonEmptyString } from '../../util/index.ts';

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

export async function applyDrizzleMigrationExpression(
  db: Kysely<unknown>,
  exprString: string,
  breakpoint: string = '--> statement-breakpoint',
) {
  const queries = exprString
    .split(breakpoint)
    .map((s) => s.trim())
    .filter(isNonEmptyString)
    .map((s) => CompiledQuery.raw(s));

  for (const query of queries) {
    await db.executeQuery(query);
  }
}
