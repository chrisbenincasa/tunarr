PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_local_media_folder` (
	`uuid` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`library_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_local_media_folder`("uuid", "path", "library_id", "canonical_id", "parent_id") SELECT "uuid", "path", "library_id", "canonical_id", "parent_id" FROM `local_media_folder`;--> statement-breakpoint
DROP TABLE `local_media_folder`;--> statement-breakpoint
ALTER TABLE `__new_local_media_folder` RENAME TO `local_media_folder`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `local_media_folder_library_id_path_idx` ON `local_media_folder` (`library_id`,`path`);--> statement-breakpoint
CREATE INDEX `local_media_folder_path_idx` ON `local_media_folder` (`path`);--> statement-breakpoint
CREATE INDEX `local_media_folder_canonical_id_id` ON `local_media_folder` (`canonical_id`);--> statement-breakpoint
CREATE TABLE `__new_program_media_file` (
	`uuid` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`program_version_id` text NOT NULL,
	`local_media_folder_id` text,
	FOREIGN KEY (`program_version_id`) REFERENCES `program_version`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`local_media_folder_id`) REFERENCES `local_media_folder`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_program_media_file`("uuid", "path", "program_version_id", "local_media_folder_id") SELECT "uuid", "path", "program_version_id", "local_media_folder_id" FROM `program_media_file`;--> statement-breakpoint
DROP TABLE `program_media_file`;--> statement-breakpoint
ALTER TABLE `__new_program_media_file` RENAME TO `program_media_file`;--> statement-breakpoint
CREATE INDEX `program_media_file_program_version_idx` ON `program_media_file` (`program_version_id`);--> statement-breakpoint
CREATE INDEX `program_media_file_folder_idx` ON `program_media_file` (`local_media_folder_id`);--> statement-breakpoint
CREATE TABLE `__new_channel_subtitle_preferences` (
	`uuid` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`priority` integer NOT NULL,
	`allow_image_based` integer DEFAULT true NOT NULL,
	`allow_external` integer DEFAULT true NOT NULL,
	`filter_type` text DEFAULT 'any' NOT NULL,
	`channel_id` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_channel_subtitle_preferences`("uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "channel_id") SELECT "uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "channel_id" FROM `channel_subtitle_preferences`;--> statement-breakpoint
DROP TABLE `channel_subtitle_preferences`;--> statement-breakpoint
ALTER TABLE `__new_channel_subtitle_preferences` RENAME TO `channel_subtitle_preferences`;--> statement-breakpoint
CREATE INDEX `channel_priority_index` ON `channel_subtitle_preferences` (`channel_id`,`priority`);--> statement-breakpoint
CREATE TABLE `__new_custom_show_subtitle_preferences` (
	`uuid` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`priority` integer NOT NULL,
	`allow_image_based` integer DEFAULT true NOT NULL,
	`allow_external` integer DEFAULT true NOT NULL,
	`filter_type` text DEFAULT 'any' NOT NULL,
	`custom_show_id` text NOT NULL,
	FOREIGN KEY (`custom_show_id`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_custom_show_subtitle_preferences`("uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "custom_show_id") SELECT "uuid", "language_code", "priority", "allow_image_based", "allow_external", "filter_type", "custom_show_id" FROM `custom_show_subtitle_preferences`;--> statement-breakpoint
DROP TABLE `custom_show_subtitle_preferences`;--> statement-breakpoint
ALTER TABLE `__new_custom_show_subtitle_preferences` RENAME TO `custom_show_subtitle_preferences`;--> statement-breakpoint
CREATE INDEX `custom_show_priority_index` ON `custom_show_subtitle_preferences` (`custom_show_id`,`priority`);--> statement-breakpoint
CREATE TABLE `__new_program_version` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`duration` integer NOT NULL,
	`sample_aspect_ratio` text,
	`display_aspect_ratio` text,
	`frame_rate` text,
	`scan_kind` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`program_id` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_program_version`("uuid", "created_at", "updated_at", "duration", "sample_aspect_ratio", "display_aspect_ratio", "frame_rate", "scan_kind", "width", "height", "program_id") SELECT "uuid", "created_at", "updated_at", "duration", "sample_aspect_ratio", "display_aspect_ratio", "frame_rate", "scan_kind", "width", "height", "program_id" FROM `program_version`;--> statement-breakpoint
DROP TABLE `program_version`;--> statement-breakpoint
ALTER TABLE `__new_program_version` RENAME TO `program_version`;--> statement-breakpoint
CREATE INDEX `index_program_version_program_id` ON `program_version` (`program_id`);