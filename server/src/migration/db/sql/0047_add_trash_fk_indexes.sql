CREATE INDEX `channel_fallback_program_uuid_idx` ON `channel_fallback` (`program_uuid`);
--> statement-breakpoint
CREATE INDEX `channel_programs_program_uuid_idx` ON `channel_programs` (`program_uuid`);
--> statement-breakpoint
CREATE INDEX `filler_show_content_program_uuid_idx` ON `filler_show_content` (`program_uuid`);
--> statement-breakpoint
CREATE INDEX `program_chapter_program_version_idx` ON `program_chapter` (`program_version_id`);
--> statement-breakpoint
CREATE INDEX `program_grouping_state_index` ON `program_grouping` (`state`);
--> statement-breakpoint
CREATE INDEX `program_subtitles_program_id_idx` ON `program_subtitles` (`program_id`);
