CREATE TABLE IF NOT EXISTS `channel_fallback` (
	`channel_uuid` text NOT NULL,
	`program_uuid` text NOT NULL,
	PRIMARY KEY(`channel_uuid`, `program_uuid`),
	FOREIGN KEY (`channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE IF EXISTS `channel_custom_show`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_custom_show_content` (
	`content_uuid` text NOT NULL,
	`custom_show_uuid` text NOT NULL,
	`index` integer NOT NULL,
	PRIMARY KEY(`content_uuid`, `custom_show_uuid`, `index`),
	FOREIGN KEY (`content_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_show_uuid`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_show_uuid`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_custom_show_content`("content_uuid", "custom_show_uuid", "index") SELECT "content_uuid", "custom_show_uuid", "index" FROM `custom_show_content`;--> statement-breakpoint
DROP TABLE `custom_show_content`;--> statement-breakpoint
ALTER TABLE `__new_custom_show_content` RENAME TO `custom_show_content`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `custom_show` ADD `sync_media_source_id` text REFERENCES media_source(uuid);--> statement-breakpoint
ALTER TABLE `custom_show` ADD `sync_media_source_type` text;--> statement-breakpoint
ALTER TABLE `custom_show` ADD `sync_external_playlist_id` text;--> statement-breakpoint
ALTER TABLE `custom_show` ADD `last_synced_at` integer;