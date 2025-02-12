CREATE TABLE `cached_image` (
	`hash` text PRIMARY KEY NOT NULL,
	`mime_type` text,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channel_custom_show` (
	`channel_uuid` text NOT NULL,
	`program_uuid` text NOT NULL,
	PRIMARY KEY(`channel_uuid`, `program_uuid`),
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `channel_filler_show` (
	`channel_uuid` text NOT NULL,
	`filler_show_uuid` text NOT NULL,
	`cooldown` integer NOT NULL,
	`weight` integer NOT NULL,
	PRIMARY KEY(`channel_uuid`, `filler_show_uuid`),
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filler_show_uuid`) REFERENCES `filler_show`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `channel_programs` (
	`channel_uuid` text NOT NULL,
	`program_uuid` text NOT NULL,
	PRIMARY KEY(`channel_uuid`, `program_uuid`),
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `custom_show` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_show_content` (
	`content_uuid` text NOT NULL,
	`custom_show_uuid` text NOT NULL,
	`index` integer NOT NULL,
	PRIMARY KEY(`content_uuid`, `custom_show_uuid`),
	FOREIGN KEY (`custom_show_uuid`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `filler_show` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `filler_show_content` (
	`filler_show_uuid` text NOT NULL,
	`index` integer NOT NULL,
	`program_uuid` text NOT NULL,
	PRIMARY KEY(`filler_show_uuid`, `program_uuid`),
	FOREIGN KEY (`filler_show_uuid`) REFERENCES `filler_show`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_source` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`access_token` text NOT NULL,
	`client_identifier` text,
	`index` integer NOT NULL,
	`name` text NOT NULL,
	`send_channel_updates` integer DEFAULT false,
	`send_guide_updates` integer DEFAULT false,
	`type` text NOT NULL,
	`uri` text NOT NULL,
	CONSTRAINT "media_source_type_check" CHECK("media_source"."type" in ('plex', 'jellyfin'))
);
--> statement-breakpoint
CREATE TABLE `program` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`album_name` text,
	`album_uuid` text,
	`artist_name` text,
	`artist_uuid` text,
	`duration` integer NOT NULL,
	`episode` integer,
	`episode_icon` text,
	`external_key` text NOT NULL,
	`external_source_id` text NOT NULL,
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
	FOREIGN KEY (`season_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tv_show_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "program_type_check" CHECK("program"."type" in ('movie', 'episode', 'track')),
	CONSTRAINT "program_source_type_check" CHECK("program"."source_type" in ('plex', 'jellyfin'))
);
--> statement-breakpoint
CREATE INDEX `program_season_uuid_index` ON `program` (`season_uuid`);--> statement-breakpoint
CREATE INDEX `program_tv_show_uuid_index` ON `program` (`tv_show_uuid`);--> statement-breakpoint
CREATE INDEX `program_album_uuid_index` ON `program` (`album_uuid`);--> statement-breakpoint
CREATE INDEX `program_artist_uuid_index` ON `program` (`artist_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `program_source_type_external_source_id_external_key_unique` ON `program` (`source_type`,`external_source_id`,`external_key`);--> statement-breakpoint
CREATE TABLE `program_external_id` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`direct_file_path` text,
	`external_file_path` text,
	`external_key` text NOT NULL,
	`external_source_id` text,
	`program_uuid` text NOT NULL,
	`source_type` text NOT NULL,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "source_type" CHECK("program_external_id"."source_type" in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin'))
);
--> statement-breakpoint
CREATE INDEX `program_external_id_program_uuid_index` ON `program_external_id` (`program_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_multiple_external_id` ON `program_external_id` (`program_uuid`,`source_type`,`external_source_id`) WHERE `external_source_id` is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_single_external_id` ON `program_external_id` (`program_uuid`,`source_type`,`external_source_id`) WHERE `external_source_id` is null;--> statement-breakpoint
CREATE TABLE `program_grouping` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`artist_uuid` text,
	`icon` text,
	`index` integer,
	`show_uuid` text,
	`summary` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`year` integer,
	FOREIGN KEY (`artist_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`show_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "type_check" CHECK("program_grouping"."type" in ('show', 'season', 'artist', 'album'))
);
--> statement-breakpoint
CREATE INDEX `program_grouping_show_uuid_index` ON `program_grouping` (`show_uuid`);--> statement-breakpoint
CREATE INDEX `program_grouping_artist_uuid_index` ON `program_grouping` (`artist_uuid`);--> statement-breakpoint
CREATE TABLE `program_grouping_external_id` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`external_file_path` text,
	`external_key` text NOT NULL,
	`external_source_id` text,
	`group_uuid` text NOT NULL,
	`source_type` text NOT NULL,
	FOREIGN KEY (`group_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "source_type_check" CHECK("program_grouping_external_id"."source_type" in ('plex', 'plex-guid', 'tmdb', 'imdb', 'tvdb', 'jellyfin'))
);
--> statement-breakpoint
CREATE INDEX `program_grouping_group_uuid_index` ON `program_grouping_external_id` (`group_uuid`);--> statement-breakpoint
CREATE TABLE `transcode_config` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`thread_count` integer NOT NULL,
	`hardware_acceleration_mode` text NOT NULL,
	`vaapi_driver` text DEFAULT 'system' NOT NULL,
	`vaapi_device` text,
	`resolution` text NOT NULL,
	`video_format` text NOT NULL,
	`video_profile` text,
	`video_preset` text,
	`video_bit_depth` integer DEFAULT 8,
	`video_bit_rate` integer NOT NULL,
	`video_buffer_size` integer NOT NULL,
	`audio_channels` integer NOT NULL,
	`audio_format` text NOT NULL,
	`audio_bit_rate` integer NOT NULL,
	`audio_buffer_size` integer NOT NULL,
	`audio_sample_rate` integer NOT NULL,
	`audio_volume_percent` integer DEFAULT 100 NOT NULL,
	`normalize_frame_rate` integer DEFAULT false,
	`deinterlace_video` integer DEFAULT true,
	`disable_channel_overlay` integer DEFAULT false,
	`error_screen` text DEFAULT 'pic' NOT NULL,
	`error_screen_audio` text DEFAULT 'silent' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	CONSTRAINT "transcode_config_hardware_accel_check" CHECK("transcode_config"."hardware_acceleration_mode" in ('none', 'cuda', 'vaapi', 'qsv', 'videotoolbox')),
	CONSTRAINT "transcode_config_vaapi_driver_check" CHECK("transcode_config"."vaapi_driver" in ('system', 'ihd', 'i965', 'radeonsi', 'nouveau')),
	CONSTRAINT "transcode_config_video_format_check" CHECK("transcode_config"."video_format" in ('h264', 'hevc', 'mpeg2video')),
	CONSTRAINT "transcode_config_audio_format_check" CHECK("transcode_config"."audio_format" in ('aac', 'ac3', 'copy', 'mp3')),
	CONSTRAINT "transcode_config_error_screen_check" CHECK("transcode_config"."error_screen" in ('static', 'pic', 'blank', 'testsrc', 'text', 'kill')),
	CONSTRAINT "transcode_config_error_screen_audio_check" CHECK("transcode_config"."error_screen_audio" in ('silent', 'sine', 'whitenoise'))
);
