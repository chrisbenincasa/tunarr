import { Mutex } from 'async-mutex';
import { type Database } from 'bun:sqlite';
import {
  CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
  type TransactionSettings,
} from 'kysely';
import { type BunSqliteDialectConfig } from './BunSqliteDialect.ts';

export class BunSqliteDriver implements Driver {
  private lock = new Mutex();
  private connection?: BunSqliteConnection;

  constructor(private config: BunSqliteDialectConfig) {}

  async init(): Promise<void> {
    this.connection = new BunSqliteConnection(this.config.database);
    if (this.config.onCreateConnection) {
      await this.config.onCreateConnection(this.connection);
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    await this.lock.acquire();
    return this.connection!;
  }

  // TODO implement isolation level if necessary
  async beginTransaction(
    connection: DatabaseConnection,
    _settings: TransactionSettings,
  ): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'));
  }

  releaseConnection(): Promise<void> {
    return Promise.resolve(this.lock.release());
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async destroy(): Promise<void> {
    this.config.database?.close();
  }
}

class BunSqliteConnection implements DatabaseConnection {
  constructor(private db: Database) {}

  executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const stmt = this.db.prepare(sql);
    return Promise.resolve({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      rows: stmt.all(parameters as any) as R[],
    });
  }

  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Method not implemented.');
  }
}
