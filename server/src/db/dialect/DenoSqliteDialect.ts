import { type Database } from '@db/sqlite';
import {
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
} from 'kysely';
import { DenoSqliteAdapter } from './DenoSqliteAdapter.ts';
import { DenoSqliteDriver } from './DenoSqliteDriver.ts';
import { DenoSqliteIntrospector } from './DenoSqliteIntrospector.ts';
import { DenoSqliteQueryCompiler } from './DenoSqliteQueryCompiler.ts';

export interface DenoSqliteDialectConfig {
  database: Database;

  onCreateConnection?: (connection: DatabaseConnection) => Promise<void>;
}

export class DenoSqliteDialect implements Dialect {
  constructor(private config: DenoSqliteDialectConfig) {}

  createDriver(): Driver {
    return new DenoSqliteDriver(this.config);
  }

  createQueryCompiler(): QueryCompiler {
    return new DenoSqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new DenoSqliteAdapter();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new DenoSqliteIntrospector(db);
  }
}
