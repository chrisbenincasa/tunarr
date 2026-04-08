import { makeMigrationFromSqlFile } from './util.ts';

export default makeMigrationFromSqlFile(
  './sql/0013_silent_the_anarchist.sql',
  true,
);
