PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_channel_subtitle_preferences` (
	`uuid` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`priority` numeric NOT NULL,
	`allow_image_based` integer DEFAULT true NOT NULL,
	`allow_external` integer DEFAULT true NOT NULL,
	`filter_type` text DEFAULT 'any' NOT NULL,
	`channel_id` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_channel_subtitle_preferences`("uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "channel_id") SELECT "uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "channel_id" FROM `channel_subtitle_preferences`;--> statement-breakpoint
DROP TABLE `channel_subtitle_preferences`;--> statement-breakpoint
ALTER TABLE `__new_channel_subtitle_preferences` RENAME TO `channel_subtitle_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `channel_priority_index` ON `channel_subtitle_preferences` (`channel_id`,`priority`);--> statement-breakpoint
CREATE TABLE `__new_custom_show_subtitle_preferences` (
	`uuid` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`priority` numeric NOT NULL,
	`allow_image_based` integer DEFAULT true NOT NULL,
	`allow_external` integer DEFAULT true NOT NULL,
	`filter_type` text DEFAULT 'any' NOT NULL,
	`custom_show_id` text NOT NULL,
	FOREIGN KEY (`custom_show_id`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_custom_show_subtitle_preferences`("uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "custom_show_id") SELECT "uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "custom_show_id" FROM `custom_show_subtitle_preferences`;--> statement-breakpoint
DROP TABLE `custom_show_subtitle_preferences`;--> statement-breakpoint
ALTER TABLE `__new_custom_show_subtitle_preferences` RENAME TO `custom_show_subtitle_preferences`;--> statement-breakpoint
CREATE INDEX `custom_show_priority_index` ON `custom_show_subtitle_preferences` (`custom_show_id`,`priority`);