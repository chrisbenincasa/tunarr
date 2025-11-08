import Sqlite from 'better-sqlite3';
import { sql, SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SelectResultFields } from 'drizzle-orm/query-builders/select.types';
import { SelectedFields } from 'drizzle-orm/sqlite-core';
import tmp from 'tmp-promise';
import { bootstrapTunarr } from '../bootstrap.ts';
import { setGlobalOptions } from '../globals.ts';
import { schema } from './schema/index.ts';

export function jsonObject<T extends SelectedFields>(shape: T) {
  const chunks: SQL[] = [];

  Object.entries(shape).forEach(([key, value]) => {
    if (chunks.length > 0) {
      chunks.push(sql.raw(`,`));
    }

    chunks.push(sql.raw(`'${key}',`));

    chunks.push(sql`${value}`);
  });

  return sql<SelectResultFields<T>>`coalesce(json_object(${sql.join(
    chunks,
  )}),  ${sql`json_object()`})`;
}

export function jsonAggObject<T extends SelectedFields>(shape: T) {
  return sql<SelectResultFields<T>[]>`coalesce(json_group_array(${jsonObject(
    shape,
  )}), ${sql`json_array()`})`.mapWith(
    (v) => JSON.parse(v) as SelectResultFields<T>[],
  );
}

type Fixture = {
  db: string;
};

const testWithDb = test.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    setGlobalOptions({
      database: dbResult.path,
      force_migration: false,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr();
    await use(dbResult.path);
    await dbResult.cleanup();
  },
});

describe('ProgramDB', () => {
  describe('generated queries', () => {
    const sqlite = new Sqlite(':memory:', {
      timeout: 5000,
    });
    const db = drizzle({
      client: sqlite,
      schema,
      casing: 'snake_case',
      logger: true,
    });

    testWithDb('test another', ({ db }) => {
      console.log('hello', db);
    });
  });
});
