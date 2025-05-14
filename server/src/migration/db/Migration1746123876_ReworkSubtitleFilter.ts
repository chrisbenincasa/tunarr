import type { TunarrDatabaseMigration } from '../DirectMigrationProvider.ts';
import { applyDrizzleMigrationExpression } from './util.ts';

const expr = String.raw`
ALTER TABLE "channel" ADD "subtitles_enabled" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "subtitle_filter";--> statement-breakpoint
ALTER TABLE "channel_subtitle_preferences" ADD "filter_type" text DEFAULT 'any';--> statement-breakpoint
ALTER TABLE "custom_show_subtitle_preferences" ADD "filter_type" text NOT NULL DEFAULT 'any';
`;

export default {
  fullCopy: true,
  async up(db) {
    await applyDrizzleMigrationExpression(db, expr);
  },
} satisfies TunarrDatabaseMigration;
