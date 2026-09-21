PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_program_play_history` (
	`uuid` text PRIMARY KEY NOT NULL,
	`program_uuid` text NOT NULL,
	`channel_uuid` text NOT NULL,
	`played_at` integer NOT NULL,
	`played_duration` integer,
	`created_at` integer NOT NULL,
	`filler_list_id` text,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filler_list_id`) REFERENCES `filler_show`(`uuid`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_program_play_history`("uuid", "program_uuid", "channel_uuid", "played_at", "played_duration", "created_at", "filler_list_id") SELECT "uuid", "program_uuid", "channel_uuid", "played_at", "played_duration", "created_at", "filler_list_id" FROM `program_play_history`;--> statement-breakpoint
DROP TABLE `program_play_history`;--> statement-breakpoint
ALTER TABLE `__new_program_play_history` RENAME TO `program_play_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `program_play_history_program_uuid_index` ON `program_play_history` (`program_uuid`);--> statement-breakpoint
CREATE INDEX `program_play_history_channel_uuid_index` ON `program_play_history` (`channel_uuid`,`program_uuid`,`filler_list_id`);--> statement-breakpoint
CREATE INDEX `program_play_history_played_at_index` ON `program_play_history` (`played_at`);--> statement-breakpoint
CREATE INDEX `program_play_history_channel_played_at_index` ON `program_play_history` (`channel_uuid`,`played_at`);