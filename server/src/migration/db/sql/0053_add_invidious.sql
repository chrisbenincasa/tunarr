PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media_source` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`access_token` text NOT NULL,
	`client_identifier` text,
	`index` integer NOT NULL,
	`name` text NOT NULL,
	`send_channel_updates` integer DEFAULT false,
	`send_guide_updates` integer DEFAULT false,
	`send_play_status_updates` integer DEFAULT false,
	`type` text NOT NULL,
	`uri` text NOT NULL,
	`username` text,
	`user_id` text,
	`media_type` text,
	`consecutive_auth_failures` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "media_source_type_check" CHECK("__new_media_source"."type" in ('plex', 'jellyfin', 'emby', 'local', 'invidious'))
);
--> statement-breakpoint
INSERT INTO `__new_media_source`("uuid", "created_at", "updated_at", "access_token", "client_identifier", "index", "name", "send_channel_updates", "send_guide_updates", "send_play_status_updates", "type", "uri", "username", "user_id", "media_type", "consecutive_auth_failures") SELECT "uuid", "created_at", "updated_at", "access_token", "client_identifier", "index", "name", "send_channel_updates", "send_guide_updates", "send_play_status_updates", "type", "uri", "username", "user_id", "media_type", "consecutive_auth_failures" FROM `media_source`;--> statement-breakpoint
DROP TABLE `media_source`;--> statement-breakpoint
ALTER TABLE `__new_media_source` RENAME TO `media_source`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
	`plot` text,
	`tagline` text,
	`title` text NOT NULL,
	`tv_show_uuid` text,
	`type` text NOT NULL,
	`year` integer,
	`state` text DEFAULT 'ok' NOT NULL,
	`stream_selection_profile_id` text,
	FOREIGN KEY (`album_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artist_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`local_media_folder_id`) REFERENCES `local_media_folder`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`local_media_source_path_id`) REFERENCES `local_media_source_path`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tv_show_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stream_selection_profile_id`) REFERENCES `stream_selection_profiles`(`uuid`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "program_type_check" CHECK("__new_program"."type" in ('movie', 'episode', 'track', 'music_video', 'other_video')),
	CONSTRAINT "program_source_type_check" CHECK("__new_program"."source_type" in ('plex', 'jellyfin', 'emby', 'local', 'invidious'))
);
--> statement-breakpoint
INSERT INTO `__new_program`("uuid", "created_at", "updated_at", "album_name", "album_uuid", "artist_name", "artist_uuid", "canonical_id", "duration", "episode", "episode_icon", "external_key", "external_source_id", "media_source_id", "library_id", "local_media_folder_id", "local_media_source_path_id", "file_path", "grandparent_external_key", "icon", "original_air_date", "parent_external_key", "plex_file_path", "plex_rating_key", "rating", "season_icon", "season_number", "season_uuid", "show_icon", "show_title", "source_type", "summary", "plot", "tagline", "title", "tv_show_uuid", "type", "year", "state", "stream_selection_profile_id") SELECT "uuid", "created_at", "updated_at", "album_name", "album_uuid", "artist_name", "artist_uuid", "canonical_id", "duration", "episode", "episode_icon", "external_key", "external_source_id", "media_source_id", "library_id", "local_media_folder_id", "local_media_source_path_id", "file_path", "grandparent_external_key", "icon", "original_air_date", "parent_external_key", "plex_file_path", "plex_rating_key", "rating", "season_icon", "season_number", "season_uuid", "show_icon", "show_title", "source_type", "summary", "plot", "tagline", "title", "tv_show_uuid", "type", "year", "state", "stream_selection_profile_id" FROM `program`;--> statement-breakpoint
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
CREATE INDEX `program_state_index` ON `program` (`state`);--> statement-breakpoint
CREATE TABLE `__new_program_external_id` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`direct_file_path` text,
	`external_file_path` text,
	`external_key` text NOT NULL,
	`external_source_id` text,
	`media_source_id` text,
	`program_uuid` text NOT NULL,
	`source_type` text NOT NULL,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "source_type" CHECK("__new_program_external_id"."source_type" in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby', 'invidious'))
);
--> statement-breakpoint
INSERT INTO `__new_program_external_id`("uuid", "created_at", "updated_at", "direct_file_path", "external_file_path", "external_key", "external_source_id", "media_source_id", "program_uuid", "source_type") SELECT "uuid", "created_at", "updated_at", "direct_file_path", "external_file_path", "external_key", "external_source_id", "media_source_id", "program_uuid", "source_type" FROM `program_external_id`;--> statement-breakpoint
DROP TABLE `program_external_id`;--> statement-breakpoint
ALTER TABLE `__new_program_external_id` RENAME TO `program_external_id`;--> statement-breakpoint
CREATE INDEX `program_external_id_program_uuid_index` ON `program_external_id` (`program_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_multiple_external_id` ON `program_external_id` (`program_uuid`,`source_type`,`external_source_id`) WHERE `external_source_id` is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_single_external_id` ON `program_external_id` (`program_uuid`,`source_type`) WHERE `external_source_id` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_multiple_external_id_media_source` ON `program_external_id` (`program_uuid`,`source_type`,`media_source_id`) WHERE `media_source_id` is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_single_external_id_media_source` ON `program_external_id` (`program_uuid`,`source_type`) WHERE `media_source_id` is null;--> statement-breakpoint
CREATE TABLE `__new_program_grouping_external_id` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`external_file_path` text,
	`external_key` text NOT NULL,
	`external_source_id` text,
	`media_source_id` text,
	`group_uuid` text NOT NULL,
	`source_type` text NOT NULL,
	`library_id` text,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "source_type_check" CHECK("__new_program_grouping_external_id"."source_type" in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin', 'emby', 'invidious'))
);
--> statement-breakpoint
INSERT INTO `__new_program_grouping_external_id`("uuid", "created_at", "updated_at", "external_file_path", "external_key", "external_source_id", "media_source_id", "group_uuid", "source_type", "library_id") SELECT "uuid", "created_at", "updated_at", "external_file_path", "external_key", "external_source_id", "media_source_id", "group_uuid", "source_type", "library_id" FROM `program_grouping_external_id`;--> statement-breakpoint
DROP TABLE `program_grouping_external_id`;--> statement-breakpoint
ALTER TABLE `__new_program_grouping_external_id` RENAME TO `program_grouping_external_id`;--> statement-breakpoint
CREATE INDEX `program_grouping_group_uuid_index` ON `program_grouping_external_id` (`group_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_grouping_multiple_external_id_media_source` ON `program_grouping_external_id` (`group_uuid`,`source_type`,`media_source_id`) WHERE `media_source_id` is not null;--> statement-breakpoint
-- Hand-edited: drizzle-kit renders this index's WHERE clause as a single
-- quoted identifier, which SQLite rejects. These two mirror the definitions
-- Migration1740691984_ProgramMediaSourceId actually created.
CREATE UNIQUE INDEX `unique_program_grouping_single_external_id_media_source` ON `program_grouping_external_id` (`group_uuid`,`source_type`) WHERE `media_source_id` is null;