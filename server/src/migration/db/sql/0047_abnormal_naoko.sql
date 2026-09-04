CREATE TABLE `program_extra` (
	`uuid` text PRIMARY KEY NOT NULL,
	`parent_program_uuid` text,
	`parent_grouping_uuid` text,
	`extra_type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`duration` integer NOT NULL,
	`external_key` text NOT NULL,
	`source_type` text NOT NULL,
	`media_source_id` text NOT NULL,
	`library_id` text,
	`file_path` text,
	`canonical_id` text,
	`state` text DEFAULT 'ok' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`parent_program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_grouping_uuid`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "one_parent_required" CHECK(("program_extra"."parent_program_uuid" IS NOT NULL AND "program_extra"."parent_grouping_uuid" IS NULL)
          OR ("program_extra"."parent_program_uuid" IS NULL AND "program_extra"."parent_grouping_uuid" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_program_extra` ON `program_extra` (`source_type`,`media_source_id`,`external_key`);--> statement-breakpoint
CREATE INDEX `program_extra_program_idx` ON `program_extra` (`parent_program_uuid`,`extra_type`);--> statement-breakpoint
CREATE INDEX `program_extra_grouping_idx` ON `program_extra` (`parent_grouping_uuid`,`extra_type`);--> statement-breakpoint
ALTER TABLE `artwork` ADD `program_extra_id` text REFERENCES program_extra(uuid);--> statement-breakpoint
CREATE INDEX `artwork_program_extra_idx` ON `artwork` (`program_extra_id`);