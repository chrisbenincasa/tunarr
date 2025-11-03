CREATE TABLE `credit` (
	`uuid` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`index` integer,
	`created_at` integer,
	`updated_at` integer,
	`program_id` text,
	`grouping_id` text,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grouping_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credit_program_id_idx` ON `credit` (`program_id`);--> statement-breakpoint
ALTER TABLE `artwork` ADD `credit_id` text REFERENCES credit(uuid);