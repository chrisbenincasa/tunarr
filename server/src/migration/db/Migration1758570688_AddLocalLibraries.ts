import { makeKyselyMigrationFromSqlFile } from './util.ts';

export default makeKyselyMigrationFromSqlFile(
  './sql/0013_silent_the_anarchist.sql',
  true,
);
