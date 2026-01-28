PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_infinite_schedule` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pad_ms` integer DEFAULT 0 NOT NULL,
	`flex_preference` text DEFAULT 'end' NOT NULL,
	`time_zone_offset` integer DEFAULT 0 NOT NULL,
	`buffer_days` integer DEFAULT 7 NOT NULL,
	`buffer_threshold_days` integer DEFAULT 2 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_infinite_schedule`("uuid", "pad_ms", "flex_preference", "time_zone_offset", "buffer_days", "buffer_threshold_days", "enabled", "created_at", "updated_at") SELECT "uuid", "pad_ms", "flex_preference", "time_zone_offset", "buffer_days", "buffer_threshold_days", "enabled", "created_at", "updated_at" FROM `infinite_schedule`;--> statement-breakpoint
DROP TABLE `infinite_schedule`;--> statement-breakpoint
ALTER TABLE `__new_infinite_schedule` RENAME TO `infinite_schedule`;--> statement-breakpoint
PRAGMA foreign_keys=ON;