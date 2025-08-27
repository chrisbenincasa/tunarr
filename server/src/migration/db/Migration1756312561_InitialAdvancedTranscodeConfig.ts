import { isNonEmptyString } from '@tunarr/shared/util';
import { CompiledQuery } from 'kysely';
import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';

const expr = String.raw`
ALTER TABLE "transcode_config" ADD "disable_hardware_decoder" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE "transcode_config" ADD "disable_hardware_encoding" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE "transcode_config" ADD "disable_hardware_filters" integer DEFAULT false;
`;

export default {
  async up(db) {
    const queries = expr
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(isNonEmptyString)
      .map((s) => CompiledQuery.raw(s));

    for (const query of queries) {
      await db.executeQuery(query);
    }
  },
} satisfies TunarrDatabaseMigration;
