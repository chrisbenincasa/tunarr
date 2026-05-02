import { sql } from 'drizzle-orm';
import { CompiledQuery, type Kysely } from 'kysely';
import { castArray, identity } from 'lodash-es';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { isNonEmptyString } from '../../util/index.ts';
import type { TunarrDatabaseMigrationWithDrizzle } from '../DirectMigrationProvider.ts';

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

export async function processSqlMigrationFile(
  filePath: string,
  statementBreakpoint: string = '--> statement-breakpoint',
) {
  const contents = await fs.readFile(
    path.join(dirname(fileURLToPath(import.meta.url)), filePath),
    'utf-8',
  );
  return processSqlMigrationString(
    contents,
    (statement) => CompiledQuery.raw(statement),
    statementBreakpoint,
  );
}

function processSqlMigrationString<OutType>(
  queryString: string,
  processor: (singleStatement: string) => OutType,
  statementBreakpoint: string = '--> statement-breakpoint',
) {
  return queryString
    .split(statementBreakpoint)
    .map((s) => s.trim())
    .filter(isNonEmptyString)
    .map((s) => processor(s));
}

function processSqlMigrationFileForDrizzle(
  filePath: string,
  statementBreakpoint: string = '--> statement-breakpoint',
) {
  const contents = readFileSync(
    path.join(dirname(fileURLToPath(import.meta.url)), filePath),
    'utf-8',
  );

  return processSqlMigrationString(
    contents,
    identity<string>,
    statementBreakpoint,
  );
}

export function makeMigrationFromSqlFile(
  filePaths: string | Array<string>,
  fullCopy: boolean = false,
): TunarrDatabaseMigrationWithDrizzle {
  filePaths = castArray(filePaths);
  const allStatements = filePaths.flatMap((path) =>
    processSqlMigrationFileForDrizzle(path),
  );
  return makeMigrationFromSqlStatements(allStatements, fullCopy);
}

export function makeMigrationFromSqlString(
  queryString: string,
  fullCopy: boolean = false,
): TunarrDatabaseMigrationWithDrizzle {
  return makeMigrationFromSqlStatements(
    processSqlMigrationString(queryString, identity<string>),
    fullCopy,
  );
}

export function makeMigrationFromSqlStatements(
  allStatements: string[],
  fullCopy: boolean,
) {
  return {
    fullCopy,
    async up(db) {
      for (const statement of allStatements) {
        await db.executeQuery(CompiledQuery.raw(statement));
      }
    },
    upDrizzle(db) {
      for (const statement of allStatements) {
        db.run(sql.raw(statement));
      }
    },
    kyselyOnly: false,
  } satisfies TunarrDatabaseMigrationWithDrizzle;
}
