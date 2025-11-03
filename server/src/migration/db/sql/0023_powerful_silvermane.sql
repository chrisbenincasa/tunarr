PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_artwork` (
	`uuid` text PRIMARY KEY NOT NULL,
	`cache_path` text,
	`source_path` text NOT NULL,
	`artwork_type` text NOT NULL,
	`blur_hash43` text,
	`blur_hash64` text,
	`program_id` text,
	`grouping_id` text,
	`credit_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grouping_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`credit_id`) REFERENCES `credit`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_artwork`("uuid", "cache_path", "source_path", "artwork_type", "blur_hash43", "blur_hash64", "program_id", "grouping_id", "credit_id", "created_at", "updated_at") SELECT "uuid", "cache_path", "source_path", "artwork_type", "blur_hash43", "blur_hash64", "program_id", "grouping_id", "credit_id", "created_at", "updated_at" FROM `artwork`;--> statement-breakpoint
DROP TABLE `artwork`;--> statement-breakpoint
ALTER TABLE `__new_artwork` RENAME TO `artwork`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `artwork_program_idx` ON `artwork` (`program_id`);