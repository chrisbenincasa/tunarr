PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_external_collection_programs` (
	`collection_id` text NOT NULL,
	`program_id` text,
	`grouping_id` text,
	PRIMARY KEY(`collection_id`, `program_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `external_collections`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grouping_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_external_collection_programs`("collection_id", "program_id") SELECT "collection_id", "program_id" FROM `external_collection_programs`;--> statement-breakpoint
DROP TABLE `external_collection_programs`;--> statement-breakpoint
ALTER TABLE `__new_external_collection_programs` RENAME TO `external_collection_programs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `external_collection_program_idx` ON `external_collection_programs` (`program_id`);