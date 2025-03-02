import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
// import { Database } from '@db/sqlite';
import BetterSqlite3 from 'better-sqlite3';

export class SqliteDatabaseBackup {
  #logger = LoggerFactory.child({ className: SqliteDatabaseBackup.name });

  async backup(dbName: string, outFile: string) {
    const conn = BetterSqlite3(dbName, {
      fileMustExist: true,
    });
    try {
      await conn.backup(outFile, {
        progress: (info) => {
          this.#logger.trace(
            'Backed up %d pages of DB, with %d reminaing',
            info.totalPages - info.remainingPages,
            info.remainingPages,
          );
          return 100;
        },
      });
    } finally {
      conn.close();
    }

    return outFile;
  }
}
