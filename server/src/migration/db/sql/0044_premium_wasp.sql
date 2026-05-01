DROP INDEX `tag_program_id_unique_idx`;--> statement-breakpoint
DROP INDEX `tag_grouping_id_unique_idx`;--> statement-breakpoint
ALTER TABLE `tag_relations` ADD `source` text DEFAULT 'media' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tag_program_id_unique_idx` ON `tag_relations` (`tag_id`,`program_id`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_grouping_id_unique_idx` ON `tag_relations` (`tag_id`,`grouping_id`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_program_unique_idx` ON `studio_entity` (`studio_id`,`program_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_grouping_unique_idx` ON `studio_entity` (`studio_id`,`group_id`);