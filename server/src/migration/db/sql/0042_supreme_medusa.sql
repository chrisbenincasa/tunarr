DROP INDEX `tag_program_id_unique_idx`;--> statement-breakpoint
DROP INDEX `tag_grouping_id_unique_idx`;--> statement-breakpoint
ALTER TABLE `tag_relations` ADD `source` text DEFAULT 'media' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tag_program_id_unique_idx` ON `tag_relations` (`tag_id`,`program_id`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_grouping_id_unique_idx` ON `tag_relations` (`tag_id`,`grouping_id`,`source`);--> statement-breakpoint
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
PRAGMA foreign_keys=ON;