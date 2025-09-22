CREATE TABLE `program_subtitles` (
	`uuid` text PRIMARY KEY NOT NULL,
	`subtitle_type` text NOT NULL,
	`stream_index` integer,
	`codec` text NOT NULL,
	`default` integer DEFAULT false NOT NULL,
	`forced` integer DEFAULT false NOT NULL,
	`sdh` integer DEFAULT false NOT NULL,
	`language` text NOT NULL,
	`path` text,
	`program_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_extracted` integer DEFAULT false,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
