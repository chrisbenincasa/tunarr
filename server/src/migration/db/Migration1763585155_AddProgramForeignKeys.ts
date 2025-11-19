import { makeKyselyMigrationFromSqlFile } from './util.ts';

export default makeKyselyMigrationFromSqlFile(
  './sql/0024_messy_hammerhead.sql',
);
