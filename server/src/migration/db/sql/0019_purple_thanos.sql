ALTER TABLE `program_grouping` ADD `external_key` text;--> statement-breakpoint
ALTER TABLE `program_grouping` ADD `media_source_id` text REFERENCES media_source(uuid);