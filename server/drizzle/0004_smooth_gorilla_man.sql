CREATE TABLE `channel` (
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
	`subtitle_filter` text DEFAULT 'any' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_number_unique` ON `channel` (`number`);--> statement-breakpoint
CREATE TABLE `channel_subtitle_preferences` (
	`uuid` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`priority` numeric NOT NULL,
	`allow_image_based` integer DEFAULT true NOT NULL,
	`allow_external` integer DEFAULT true NOT NULL,
	`channel_id` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_priority_index` ON `channel_subtitle_preferences` (`channel_id`,`priority`);--> statement-breakpoint
CREATE TABLE `custom_show_subtitle_preferences` (
	`uuid` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`priority` numeric NOT NULL,
	`allow_image_based` integer DEFAULT true NOT NULL,
	`allow_external` integer DEFAULT true NOT NULL,
	`custom_show_id` text NOT NULL,
	FOREIGN KEY (`custom_show_id`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `custom_show_priority_index` ON `custom_show_subtitle_preferences` (`custom_show_id`,`priority`);