import { CompiledQuery, type Kysely } from 'kysely';
import { isNonEmptyString } from '../../util/index.ts';
import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';

// low-fi ... copied from the generated one by drizzle

export const expr = String.raw`
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE "__new_program_external_id" (
	"uuid" text PRIMARY KEY NOT NULL,
	"created_at" integer,
	"updated_at" integer,
	"direct_file_path" text,
	"external_file_path" text,
	"external_key" text NOT NULL,
	"external_source_id" text,
	"media_source_id" text,
	"program_uuid" text NOT NULL,
	"source_type" text NOT NULL,
	FOREIGN KEY ("media_source_id") REFERENCES "media_source"("uuid") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("program_uuid") REFERENCES "program"("uuid") ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "source_type" CHECK("__new_program_external_id"."source_type" in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby'))
);
--> statement-breakpoint
INSERT INTO "__new_program_external_id"("uuid", "created_at", "updated_at", "direct_file_path", "external_file_path", "external_key", "external_source_id", "media_source_id", "program_uuid", "source_type") SELECT "uuid", "created_at", "updated_at", "direct_file_path", "external_file_path", "external_key", "external_source_id", "media_source_id", "program_uuid", "source_type" FROM "program_external_id";--> statement-breakpoint
DROP TABLE "program_external_id";--> statement-breakpoint
ALTER TABLE "__new_program_external_id" RENAME TO "program_external_id";--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX "program_external_id_program_uuid_index" ON "program_external_id" ("program_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_program_multiple_external_id" ON "program_external_id" ("program_uuid","source_type","external_source_id") WHERE "external_source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_program_single_external_id" ON "program_external_id" ("program_uuid","source_type","external_source_id") WHERE "external_source_id" is null;--> statement-breakpoint
ALTER TABLE "media_source" ADD "username" text;--> statement-breakpoint
ALTER TABLE "media_source" ADD "user_id" text;--> statement-breakpoint
`;

// ALTER TABLE "program" ADD "media_source_id" text REFERENCES media_source(uuid);--> statement-breakpoint
// ALTER TABLE "program_grouping_external_id" ADD "media_source_id" text REFERENCES media_source(uuid);
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
