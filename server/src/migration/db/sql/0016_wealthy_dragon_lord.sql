CREATE TABLE `artwork` (
	`uuid` text PRIMARY KEY NOT NULL,
	`cache_path` text NOT NULL,
	`source_path` text NOT NULL,
	`artwork_type` text NOT NULL,
	`blur_hash43` text,
	`blur_hash64` text,
	`program_id` text,
	`grouping_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grouping_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artwork_program_idx` ON `artwork` (`program_id`);--> statement-breakpoint
CREATE TABLE `program_media_file` (
	`uuid` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`program_version_id` text NOT NULL,
	`local_media_folder_id` text,
	FOREIGN KEY (`program_version_id`) REFERENCES `program_version`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`local_media_folder_id`) REFERENCES `local_media_folder`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `program_media_file_program_version_idx` ON `program_media_file` (`program_version_id`);--> statement-breakpoint
CREATE INDEX `program_media_file_folder_idx` ON `program_media_file` (`local_media_folder_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_program_media_stream` (
	`uuid` text PRIMARY KEY NOT NULL,
	`index` integer NOT NULL,
	`codec` text NOT NULL,
	`profile` text,
	`stream_kind` text NOT NULL,
	`title` text,
	`language` text,
	`channels` integer,
	`default` integer DEFAULT false NOT NULL,
	`forced` integer DEFAULT false NOT NULL,
	`pixel_format` text,
	`color_range` text,
	`color_space` text,
	`color_transfer` text,
	`color_primaries` text,
	`bits_per_sample` integer,
	`program_version_id` text NOT NULL,
	FOREIGN KEY (`program_version_id`) REFERENCES `program_version`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_program_media_stream`("uuid", "index", "codec", "profile", "stream_kind", "title", "language", "channels", "default", "forced", "pixel_format", "color_range", "color_space", "color_transfer", "color_primaries", "bits_per_sample", "program_version_id") SELECT "uuid", "index", "codec", "profile", "stream_kind", "title", "language", "channels", "default", "forced", "pixel_format", "color_range", "color_space", "color_transfer", "color_primaries", "bits_per_sample", "program_version_id" FROM `program_media_stream`;--> statement-breakpoint
DROP TABLE `program_media_stream`;--> statement-breakpoint
ALTER TABLE `__new_program_media_stream` RENAME TO `program_media_stream`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `index_program_version_id` ON `program_media_stream` (`program_version_id`);--> statement-breakpoint
CREATE TABLE `__new_program_version` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`duration` integer,
	`sample_aspect_ratio` text,
	`display_aspect_ratio` text,
	`frame_rate` text,
	`scan_kind` text,
	`width` integer,
	`height` integer,
	`program_id` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_program_version`("uuid", "created_at", "updated_at", "duration", "sample_aspect_ratio", "display_aspect_ratio", "frame_rate", "scan_kind", "width", "height", "program_id") SELECT "uuid", "created_at", "updated_at", "duration", "sample_aspect_ratio", "display_aspect_ratio", "frame_rate", "scan_kind", "width", "height", "program_id" FROM `program_version`;--> statement-breakpoint
DROP TABLE `program_version`;--> statement-breakpoint
ALTER TABLE `__new_program_version` RENAME TO `program_version`;--> statement-breakpoint
CREATE INDEX `index_program_version_program_id` ON `program_version` (`program_id`);--> statement-breakpoint
CREATE INDEX `local_media_folder_library_id_path_idx` ON `local_media_folder` (`library_id`,`path`);--> statement-breakpoint
CREATE INDEX `local_media_folder_path_idx` ON `local_media_folder` (`path`);--> statement-breakpoint
CREATE INDEX `local_media_folder_canonical_id_id` ON `local_media_folder` (`canonical_id`);