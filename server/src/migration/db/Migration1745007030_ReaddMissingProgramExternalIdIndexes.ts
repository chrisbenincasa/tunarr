import { type Kysely, CompiledQuery } from 'kysely';
import { isNonEmptyString } from '../../util/index.ts';
import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';

const expr = String.raw`
DROP INDEX "unique_program_single_external_id";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_program_multiple_external_id_media_source" ON "program_external_id" ("program_uuid","source_type","media_source_id") WHERE "media_source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_program_single_external_id_media_source" ON "program_external_id" ("program_uuid","source_type") WHERE "media_source_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_program_single_external_id" ON "program_external_id" ("program_uuid","source_type") WHERE "external_source_id" is null;--> statement-breakpoint
`;

export default {
  up: async (db: Kysely<unknown>) => {
    const queries = expr
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(isNonEmptyString)
      .map((s) => CompiledQuery.raw(s));

    for (const query of queries) {
      await db.executeQuery(query);
    }
  },
  fullCopy: true,
} satisfies TunarrDatabaseMigration;
