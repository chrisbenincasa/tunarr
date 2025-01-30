import { type Database } from 'bun:sqlite';
import {
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
} from 'kysely';
import { BunSqliteDriver } from './BunSqliteDriver.ts';

export interface BunSqliteDialectConfig {
  database: Database;

  onCreateConnection?: (connection: DatabaseConnection) => Promise<void>;
}

export class BunSqliteDialect implements Dialect {
  constructor(private config: BunSqliteDialectConfig) {}

  createDriver(): Driver {
    return new BunSqliteDriver(this.config);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
