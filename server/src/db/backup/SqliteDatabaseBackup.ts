import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
// import { Database } from '@db/sqlite';
import BetterSqlite3 from 'better-sqlite3';

export class SqliteDatabaseBackup {
  #logger = LoggerFactory.child({ className: SqliteDatabaseBackup.name });

  async backup(dbName: string, outFile: string) {
    // const conn = new Database(dbName, { readonly: true, create: false });
    const conn = BetterSqlite3(dbName, {
      fileMustExist: true,
    });

    // await wait();

    // try {
    //   conn.exec(`VACUUM INTO '${outFile}'`);
    // } catch (e) {
    //   this.#logger.error(e, 'Error while backing up database!');
    // } finally {
    //   conn.close();
    // }

    // return outFile;
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
