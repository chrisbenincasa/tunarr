PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_program_grouping` (
	`uuid` text PRIMARY KEY NOT NULL,
	`canonical_id` text,
	`created_at` integer,
	`updated_at` integer,
	`icon` text,
	`index` integer,
	`summary` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`year` integer,
	`artist_uuid` text,
	`show_uuid` text,
	`library_id` text,
	`source_type` text,
	`external_key` text,
	`media_source_id` text,
	FOREIGN KEY (`artist_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`show_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "type_check" CHECK("__new_program_grouping"."type" in ('show', 'season', 'artist', 'album'))
);
--> statement-breakpoint
INSERT INTO `__new_program_grouping`("uuid", "canonical_id", "created_at", "updated_at", "icon", "index", "summary", "title", "type", "year", "artist_uuid", "show_uuid", "library_id", "source_type", "external_key", "media_source_id") SELECT "uuid", "canonical_id", "created_at", "updated_at", "icon", "index", "summary", "title", "type", "year", "artist_uuid", "show_uuid", "library_id", "source_type", "external_key", "media_source_id" FROM `program_grouping`;--> statement-breakpoint
DROP TABLE `program_grouping`;--> statement-breakpoint
ALTER TABLE `__new_program_grouping` RENAME TO `program_grouping`;--> statement-breakpoint
CREATE INDEX `program_grouping_show_uuid_index` ON `program_grouping` (`show_uuid`);--> statement-breakpoint
CREATE INDEX `program_grouping_artist_uuid_index` ON `program_grouping` (`artist_uuid`);--> statement-breakpoint
CREATE TABLE `__new_program` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`album_name` text,
	`album_uuid` text,
	`artist_name` text,
	`artist_uuid` text,
	`canonical_id` text,
	`duration` integer NOT NULL,
	`episode` integer,
	`episode_icon` text,
	`external_key` text NOT NULL,
	`external_source_id` text NOT NULL,
	`media_source_id` text,
	`library_id` text,
	`local_media_folder_id` text,
	`local_media_source_path_id` text,
	`file_path` text,
	`grandparent_external_key` text,
	`icon` text,
	`original_air_date` text,
	`parent_external_key` text,
	`plex_file_path` text,
	`plex_rating_key` text,
	`rating` text,
	`season_icon` text,
	`season_number` integer,
	`season_uuid` text,
	`show_icon` text,
	`show_title` text,
	`source_type` text NOT NULL,
	`summary` text,
	`title` text NOT NULL,
	`tv_show_uuid` text,
	`type` text NOT NULL,
	`year` integer,
	FOREIGN KEY (`album_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artist_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`local_media_folder_id`) REFERENCES `local_media_folder`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`local_media_source_path_id`) REFERENCES `local_media_source_path`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tv_show_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "program_type_check" CHECK("__new_program"."type" in ('movie', 'episode', 'track', 'music_video', 'other_video')),
	CONSTRAINT "program_source_type_check" CHECK("__new_program"."source_type" in ('plex', 'jellyfin', 'emby', 'local'))
);
--> statement-breakpoint
INSERT INTO `__new_program`("uuid", "created_at", "updated_at", "album_name", "album_uuid", "artist_name", "artist_uuid", "canonical_id", "duration", "episode", "episode_icon", "external_key", "external_source_id", "media_source_id", "library_id", "local_media_folder_id", "local_media_source_path_id", "file_path", "grandparent_external_key", "icon", "original_air_date", "parent_external_key", "plex_file_path", "plex_rating_key", "rating", "season_icon", "season_number", "season_uuid", "show_icon", "show_title", "source_type", "summary", "title", "tv_show_uuid", "type", "year") SELECT "uuid", "created_at", "updated_at", "album_name", "album_uuid", "artist_name", "artist_uuid", "canonical_id", "duration", "episode", "episode_icon", "external_key", "external_source_id", "media_source_id", "library_id", "local_media_folder_id", "local_media_source_path_id", "file_path", "grandparent_external_key", "icon", "original_air_date", "parent_external_key", "plex_file_path", "plex_rating_key", "rating", "season_icon", "season_number", "season_uuid", "show_icon", "show_title", "source_type", "summary", "title", "tv_show_uuid", "type", "year" FROM `program`;--> statement-breakpoint
DROP TABLE `program`;--> statement-breakpoint
ALTER TABLE `__new_program` RENAME TO `program`;--> statement-breakpoint
CREATE INDEX `program_season_uuid_index` ON `program` (`season_uuid`);--> statement-breakpoint
CREATE INDEX `program_tv_show_uuid_index` ON `program` (`tv_show_uuid`);--> statement-breakpoint
CREATE INDEX `program_album_uuid_index` ON `program` (`album_uuid`);--> statement-breakpoint
CREATE INDEX `program_artist_uuid_index` ON `program` (`artist_uuid`);--> statement-breakpoint
CREATE INDEX `program_media_source_id_index` ON `program` (`media_source_id`);--> statement-breakpoint
CREATE INDEX `program_media_library_id_index` ON `program` (`library_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `program_source_type_external_source_id_external_key_unique` ON `program` (`source_type`,`external_source_id`,`external_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `program_source_type_media_source_external_key_unique` ON `program` (`source_type`,`media_source_id`,`external_key`);--> statement-breakpoint
CREATE INDEX `program_canonical_id_index` ON `program` (`canonical_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint