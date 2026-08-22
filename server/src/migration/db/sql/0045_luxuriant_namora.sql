ALTER TABLE `program_subtitles` ADD `source_path` text;--> statement-breakpoint
ALTER TABLE `program_subtitles` ADD `source_key` text;--> statement-breakpoint
-- Plex sidecar rows previously stored their stream key in `path`, which now
-- only ever holds a path Tunarr can open. Rows whose download succeeded hold a
-- cache path and are left alone.
UPDATE `program_subtitles` SET `source_key` = `path`, `path` = NULL WHERE `subtitle_type` = 'sidecar' AND `path` LIKE '/library/%';
