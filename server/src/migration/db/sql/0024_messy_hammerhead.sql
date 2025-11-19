PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_custom_show_content` (
	`content_uuid` text NOT NULL,
	`custom_show_uuid` text NOT NULL,
	`index` integer NOT NULL,
	PRIMARY KEY(`content_uuid`, `custom_show_uuid`),
	FOREIGN KEY (`content_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_show_uuid`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_custom_show_content`("content_uuid", "custom_show_uuid", "index") SELECT "content_uuid", "custom_show_uuid", "index" FROM `custom_show_content`;--> statement-breakpoint
DROP TABLE `custom_show_content`;--> statement-breakpoint
ALTER TABLE `__new_custom_show_content` RENAME TO `custom_show_content`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_filler_show_content` (
	`filler_show_uuid` text NOT NULL,
	`index` integer NOT NULL,
	`program_uuid` text NOT NULL,
	PRIMARY KEY(`filler_show_uuid`, `program_uuid`),
	FOREIGN KEY (`filler_show_uuid`) REFERENCES `filler_show`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_filler_show_content`("filler_show_uuid", "index", "program_uuid") SELECT "filler_show_uuid", "index", "program_uuid" FROM `filler_show_content`;--> statement-breakpoint
DROP TABLE `filler_show_content`;--> statement-breakpoint
ALTER TABLE `__new_filler_show_content` RENAME TO `filler_show_content`;