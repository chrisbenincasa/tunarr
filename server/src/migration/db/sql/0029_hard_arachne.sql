ALTER TABLE `program_grouping` ADD `plot` text;--> statement-breakpoint
ALTER TABLE `program_grouping` ADD `tagline` text;--> statement-breakpoint
ALTER TABLE `program_grouping` ADD `release_date` integer;--> statement-breakpoint
ALTER TABLE `program_grouping` ADD `rating` text;--> statement-breakpoint
CREATE INDEX `program_state_index` ON `program` (`state`);