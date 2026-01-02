CREATE TABLE `external_collections` (
	`uuid` text PRIMARY KEY NOT NULL,
	`media_source_id` text NOT NULL,
	`library_id` text NOT NULL,
	`external_key` text NOT NULL,
	`source_type` text NOT NULL,
	FOREIGN KEY (`media_source_id`) REFERENCES `media_source`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `media_source_library`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_collection_media_source_id_external_key_idx` ON `external_collections` (`media_source_id`,`external_key`);--> statement-breakpoint
CREATE INDEX `external_collection_library_id_external_key_idx` ON `external_collections` (`library_id`,`external_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_collections_mediaSourceId_externalKey_unique` ON `external_collections` (`media_source_id`,`external_key`);--> statement-breakpoint
CREATE TABLE `external_collection_programs` (
	`collection_id` text NOT NULL,
	`program_id` text NOT NULL,
	PRIMARY KEY(`collection_id`, `program_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `external_collections`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_collection_program_idx` ON `external_collection_programs` (`program_id`);