import { makeKyselyMigrationFromSqlFile } from './util.ts';

export default makeKyselyMigrationFromSqlFile(
  './sql/0020_whole_the_hand.sql',
  true,
);
