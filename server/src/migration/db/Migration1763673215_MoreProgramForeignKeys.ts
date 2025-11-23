import { makeKyselyMigrationFromSqlFile } from './util.ts';

export default makeKyselyMigrationFromSqlFile(
  './sql/0025_wakeful_gressill.sql',
  true,
);
