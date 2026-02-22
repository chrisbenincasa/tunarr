CREATE TABLE `program_play_history` (
	`uuid` text PRIMARY KEY NOT NULL,
	`program_uuid` text NOT NULL,
	`channel_uuid` text NOT NULL,
	`played_at` integer NOT NULL,
	`played_duration` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `program_play_history_program_uuid_index` ON `program_play_history` (`program_uuid`);--> statement-breakpoint
CREATE INDEX `program_play_history_channel_uuid_index` ON `program_play_history` (`channel_uuid`);--> statement-breakpoint
CREATE INDEX `program_play_history_played_at_index` ON `program_play_history` (`played_at`);--> statement-breakpoint
CREATE INDEX `program_play_history_channel_played_at_index` ON `program_play_history` (`channel_uuid`,`played_at`);