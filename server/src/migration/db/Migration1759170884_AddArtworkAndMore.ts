import { makeMigrationFromSqlFile } from './util.ts';

export default makeMigrationFromSqlFile(
  './sql/0016_wealthy_dragon_lord.sql',
  true,
);
