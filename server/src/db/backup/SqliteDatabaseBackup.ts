import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
// import Database from 'bun:sqlite';
import { Database } from '@db/sqlite';
import { wait } from '../../util/index.ts';

export class SqliteDatabaseBackup {
  #logger = LoggerFactory.child({ className: SqliteDatabaseBackup.name });

  async backup(dbName: string, outFile: string) {
    const conn = new Database(dbName, { readonly: true, create: false });
    // const conn = BetterSqlite3(dbOptions().dbName, {
    //   fileMustExist: true,
    // });

    await wait();

    try {
      conn.exec(`VACCUM INTO '${outFile}'`);
    } catch (e) {
      this.#logger.error(e, 'Error while backing up database!');
    } finally {
      conn.close();
    }

    return outFile;
    // try {
    //   await conn.backup(outFile, {
    //     progress: (info) => {
    //       this.#logger.trace(
    //         'Backed up %d pages of DB, with %d reminaing',
    //         info.totalPages - info.remainingPages,
    //         info.remainingPages,
    //       );
    //       return 100;
    //     },
    //   });
    // } finally {
    //   conn.close();
    // }

    // return outFile;
  }
}
