import {
  type DialectAdapterBase,
  type Kysely,
  type MigrationLockOptions,
} from 'kysely';

export class DenoSqliteAdapter implements DialectAdapterBase {
  get supportsCreateIfNotExists(): boolean {
    return true;
  }

  get supportsTransactionalDdl(): boolean {
    return false;
  }

  get supportsReturning(): boolean {
    return true;
  }

  get supportsOutput(): boolean {
    return false;
  }

  async acquireMigrationLock(
    db: Kysely<any>,
    options: MigrationLockOptions,
  ): Promise<void> {
    // throw new Error("Method not implemented.");
  }

  async releaseMigrationLock(
    db: Kysely<any>,
    options: MigrationLockOptions,
  ): Promise<void> {
    // throw new Error("Method not implemented.");
  }
}
