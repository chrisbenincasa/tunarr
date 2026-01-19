import type { Kysely } from 'kysely';
import { applyDrizzleMigrationExpression } from './util.ts';
import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';

const expr = String.raw`
CREATE INDEX IF NOT EXISTS "program_external_id_external_key_idx"
ON "program_external_id" ("external_key");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "program_grouping_external_id_external_key_idx"
ON "program_grouping_external_id" ("external_key");--> statement-breakpoint
`;

export default {
  async up(db: Kysely<unknown>) {
    await applyDrizzleMigrationExpression(db, expr);
  },
  fullCopy: true,
} satisfies TunarrDatabaseMigration;

