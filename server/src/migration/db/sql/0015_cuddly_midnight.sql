PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_local_media_folder` (
	`uuid` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`library_id` text NOT NULL,
	`canonical_id` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP TABLE `local_media_folder`;--> statement-breakpoint
ALTER TABLE `__new_local_media_folder` RENAME TO `local_media_folder`;--> statement-breakpoint
PRAGMA foreign_keys=ON;