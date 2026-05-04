CREATE TABLE `stream_selection_profiles` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rules` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
DROP INDEX `tag_program_id_unique_idx`;--> statement-breakpoint
DROP INDEX `tag_grouping_id_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `tag_program_id_unique_idx` ON `tag_relations` (`tag_id`,`program_id`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_grouping_id_unique_idx` ON `tag_relations` (`tag_id`,`grouping_id`,`source`);--> statement-breakpoint
ALTER TABLE `channel` ADD `stream_selection_profile_id` text REFERENCES stream_selection_profiles(uuid);--> statement-breakpoint
ALTER TABLE `filler_show` ADD `stream_selection_profile_id` text REFERENCES stream_selection_profiles(uuid);--> statement-breakpoint
ALTER TABLE `program` ADD `stream_selection_profile_id` text REFERENCES stream_selection_profiles(uuid);