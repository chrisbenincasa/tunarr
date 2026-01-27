CREATE TABLE `channel_fallback` (
	`channel_uuid` text NOT NULL,
	`program_uuid` text NOT NULL,
	PRIMARY KEY(`channel_uuid`, `program_uuid`),
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `channel_custom_show`;--> statement-breakpoint
DROP INDEX `tag_program_id_unique_idx`;--> statement-breakpoint
DROP INDEX `tag_grouping_id_unique_idx`;--> statement-breakpoint
ALTER TABLE `tag_relations` ADD `source` text DEFAULT 'media' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tag_program_id_unique_idx` ON `tag_relations` (`tag_id`,`program_id`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_grouping_id_unique_idx` ON `tag_relations` (`tag_id`,`grouping_id`,`source`);--> statement-breakpoint
ALTER TABLE `custom_show` ADD `sync_media_source_id` text REFERENCES media_source(uuid);--> statement-breakpoint
ALTER TABLE `custom_show` ADD `sync_media_source_type` text;--> statement-breakpoint
ALTER TABLE `custom_show` ADD `sync_external_playlist_id` text;--> statement-breakpoint
ALTER TABLE `custom_show` ADD `last_synced_at` integer;