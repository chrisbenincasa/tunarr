import { makeMigrationFromSqlFile } from './util.ts';

export default makeMigrationFromSqlFile([
  './sql/0033_free_nekra.sql',
  './sql/0034_cooing_bloodscream.sql',
  './sql/0035_military_ben_grimm.sql',
]);
