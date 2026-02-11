import { makeKyselyMigrationFromSqlFile } from '@/migration/db/util.js';

export default makeKyselyMigrationFromSqlFile(
  './sql/0041_enable_tonemapping.sql',
);
