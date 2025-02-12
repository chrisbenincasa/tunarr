CREATE TABLE `media_source_library` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`media_type` text NOT NULL,
	`media_source_id` text NOT NULL,
	`last_scanned_at` integer,
	`external_key` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "media_type_check" CHECK("media_source_library"."media_type" in ('movies', 'shows', 'music_videos', 'other_videos', 'tracks'))
);
--> statement-breakpoint
CREATE TABLE `media_source_library_replace_path` (
	`uuid` text PRIMARY KEY NOT NULL,
	`server_path` text NOT NULL,
	`local_path` text NOT NULL,
	`media_source_id` text NOT NULL,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `program` ADD `canonical_id` text;--> statement-breakpoint
ALTER TABLE `program` ADD `library_id` text REFERENCES media_source_library(uuid);--> statement-breakpoint
CREATE INDEX `program_canonical_id_index` ON `program` (`canonical_id`);--> statement-breakpoint
ALTER TABLE `program_grouping` ADD `canonical_id` text;--> statement-breakpoint
ALTER TABLE `program_grouping` ADD `library_id` text REFERENCES media_source_library(uuid);--> statement-breakpoint
ALTER TABLE `program_grouping_external_id` ADD `library_id` text REFERENCES media_source_library(uuid);