import { makeMigrationFromSqlFile } from './util.ts';

export default makeMigrationFromSqlFile(
  './sql/0028_omniscient_blockbuster.sql',
);
