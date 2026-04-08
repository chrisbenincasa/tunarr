import { makeMigrationFromSqlFile } from './util.ts';

export default makeMigrationFromSqlFile('./sql/0020_whole_the_hand.sql', true);
