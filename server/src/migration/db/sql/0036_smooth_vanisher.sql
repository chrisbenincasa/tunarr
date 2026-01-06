CREATE TABLE `tags` (
	`uuid` text PRIMARY KEY NOT NULL,
	`tag` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_unique_tag_idx` ON `tags` (`tag`);--> statement-breakpoint
CREATE TABLE `tag_relations` (
	`tag_id` text NOT NULL,
	`program_id` text,
	`grouping_id` text,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grouping_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tag_relations_program_id_idx` ON `tag_relations` (`program_id`);--> statement-breakpoint
CREATE INDEX `tag_relations_grouping_id_idx` ON `tag_relations` (`grouping_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_program_id_unique_idx` ON `tag_relations` (`tag_id`,`program_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_grouping_id_unique_idx` ON `tag_relations` (`tag_id`,`grouping_id`);