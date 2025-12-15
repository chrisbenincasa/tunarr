import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';
import { makeKyselyMigrationFromSqlFile } from './util.ts';

export default {
  ...makeKyselyMigrationFromSqlFile('./sql/0025_wakeful_gressill.sql', true),
  noTransaction: true,
} satisfies TunarrDatabaseMigration;
