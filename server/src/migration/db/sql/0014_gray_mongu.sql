ALTER TABLE `local_media_folder` ADD `canonical_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `media_source` ADD `media_type` text;--> statement-breakpoint
ALTER TABLE `local_media_source_path` DROP COLUMN `canonical_id`;