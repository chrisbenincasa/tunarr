PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_channel` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`disable_filler_overlay` integer DEFAULT false,
	`duration` integer NOT NULL,
	`filler_repeat_cooldown` integer,
	`group_title` text,
	`guide_flex_title` text,
	`guide_minimum_duration` integer NOT NULL,
	`icon` text NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	`offline` text NOT NULL,
	`start_time` integer NOT NULL,
	`stealth` integer DEFAULT false,
	`stream_mode` text DEFAULT 'hls' NOT NULL,
	`transcoding` text,
	`transcode_config_id` text NOT NULL,
	`watermark` text,
	`subtitles_enabled` integer DEFAULT false,
	CONSTRAINT "channel_stream_mode_check" CHECK("__new_channel"."stream_mode" in ('hls', 'hls_slower', 'mpegts', 'hls_direct', 'hls_direct_v2'))
);
--> statement-breakpoint
INSERT INTO `__new_channel`("uuid", "created_at", "updated_at", "disable_filler_overlay", "duration", "filler_repeat_cooldown", "group_title", "guide_flex_title", "guide_minimum_duration", "icon", "name", "number", "offline", "start_time", "stealth", "stream_mode", "transcoding", "transcode_config_id", "watermark", "subtitles_enabled") SELECT "uuid", "created_at", "updated_at", "disable_filler_overlay", "duration", "filler_repeat_cooldown", "group_title", "guide_flex_title", "guide_minimum_duration", "icon", "name", "number", "offline", "start_time", "stealth", "stream_mode", "transcoding", "transcode_config_id", "watermark", "subtitles_enabled" FROM `channel`;--> statement-breakpoint
DROP TABLE `channel`;--> statement-breakpoint
ALTER TABLE `__new_channel` RENAME TO `channel`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `channel_number_unique` ON `channel` (`number`);