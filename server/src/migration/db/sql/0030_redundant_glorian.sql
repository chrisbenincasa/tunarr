CREATE TABLE `genre_entity` (
	`genre_id` text NOT NULL,
	`program_id` text,
	`group_id` text,
	FOREIGN KEY (`genre_id`) REFERENCES `genre`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `genre_entity_id_index` ON `genre_entity` (`genre_id`);--> statement-breakpoint
CREATE INDEX `genre_entity_program_id_index` ON `genre_entity` (`program_id`);--> statement-breakpoint
CREATE INDEX `genre_entity_group_id_index` ON `genre_entity` (`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `genre_program_unique_idx` ON `genre_entity` (`genre_id`,`program_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `genre_grouping_unique_idx` ON `genre_entity` (`genre_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `genre` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `genre_name_idx` ON `genre` (`name`);--> statement-breakpoint
CREATE TABLE `studio` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_entity` (
	`studio_id` text NOT NULL,
	`program_id` text,
	`group_id` text,
	FOREIGN KEY (`studio_id`) REFERENCES `studio`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `studio_entity_id_index` ON `studio_entity` (`studio_id`);--> statement-breakpoint
CREATE INDEX `studio_entity_program_id_index` ON `studio_entity` (`program_id`);--> statement-breakpoint
CREATE INDEX `studio_entity_group_id_index` ON `studio_entity` (`group_id`);