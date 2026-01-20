PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_smart_collection` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`query` text,
	`keywords` text
);
--> statement-breakpoint
INSERT INTO `__new_smart_collection`("uuid", "name", "query") SELECT "uuid", "name", "query" FROM `smart_collection`;--> statement-breakpoint
DROP TABLE `smart_collection`;--> statement-breakpoint
ALTER TABLE `__new_smart_collection` RENAME TO `smart_collection`;--> statement-breakpoint
PRAGMA foreign_keys=ON;