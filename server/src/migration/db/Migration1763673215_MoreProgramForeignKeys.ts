import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';
import { makeMigrationFromSqlFile } from './util.ts';

export default {
  ...makeMigrationFromSqlFile('./sql/0025_wakeful_gressill.sql', true),
  noTransaction: true,
} satisfies TunarrDatabaseMigration;
