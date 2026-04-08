import { makeMigrationFromSqlString } from './util.ts';

const expr = String.raw`
ALTER TABLE "channel" ADD "subtitles_enabled" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "subtitle_filter";--> statement-breakpoint
ALTER TABLE "channel_subtitle_preferences" ADD "filter_type" text DEFAULT 'any';--> statement-breakpoint
ALTER TABLE "custom_show_subtitle_preferences" ADD "filter_type" text NOT NULL DEFAULT 'any';
`;

export default makeMigrationFromSqlString(expr, true);
