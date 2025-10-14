import { makeKyselyMigrationFromSqlFile } from './util.ts';

export default makeKyselyMigrationFromSqlFile(
  './sql/0016_wealthy_dragon_lord.sql',
  true,
);
