import type { Kysely } from 'kysely';
import { CompiledQuery } from 'kysely';
import { isNonEmptyString } from '../../util/index.ts';
import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';

export const expr = String.raw`
ALTER TABLE "channel" ADD COLUMN "subtitle_filter" text DEFAULT 'any' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_number_unique" ON "channel" ("number");--> statement-breakpoint
CREATE TABLE "channel_subtitle_preferences" (
	"uuid" text PRIMARY KEY NOT NULL,
	"language_code" text NOT NULL,
	"priority" numeric NOT NULL,
	"allow_image_based" integer DEFAULT true NOT NULL,
	"allow_external" integer DEFAULT true NOT NULL,
	"channel_id" text NOT NULL,
	FOREIGN KEY ("channel_id") REFERENCES "channel"("uuid") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX "channel_priority_index" ON "channel_subtitle_preferences" ("channel_id","priority");--> statement-breakpoint
CREATE TABLE "custom_show_subtitle_preferences" (
	"uuid" text PRIMARY KEY NOT NULL,
	"language_code" text NOT NULL,
	"priority" numeric NOT NULL,
	"allow_image_based" integer DEFAULT true NOT NULL,
	"allow_external" integer DEFAULT true NOT NULL,
	"custom_show_id" text NOT NULL,
	FOREIGN KEY ("custom_show_id") REFERENCES "custom_show"("uuid") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX "custom_show_priority_index" ON "custom_show_subtitle_preferences" ("custom_show_id","priority");
`;

export default {
  fullCopy: true,
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
} satisfies TunarrDatabaseMigration;
