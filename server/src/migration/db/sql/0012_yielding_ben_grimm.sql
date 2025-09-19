CREATE TABLE `program_chapter` (
	`uuid` text PRIMARY KEY NOT NULL,
	`index` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`title` text,
	`chapter_type` text DEFAULT 'chapter' NOT NULL,
	`program_version_id` text NOT NULL,
	FOREIGN KEY (`program_version_id`) REFERENCES `program_version`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_media_stream` (
	`uuid` text PRIMARY KEY NOT NULL,
	`index` integer NOT NULL,
	`codec` text NOT NULL,
	`profile` text NOT NULL,
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
CREATE INDEX `index_program_version_id` ON `program_media_stream` (`program_version_id`);--> statement-breakpoint
CREATE TABLE `program_version` (
	`uuid` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`duration` integer NOT NULL,
	`sample_aspect_ratio` text NOT NULL,
	`display_aspect_ratio` text NOT NULL,
	`frame_rate` text,
	`scan_kind` text,
	`width` integer,
	`height` integer,
	`program_id` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `index_program_version_program_id` ON `program_version` (`program_id`);