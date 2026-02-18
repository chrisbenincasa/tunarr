-- Fix credit markers incorrectly stored as 'intro' due to a bug in
-- PlexApiClient where Plex credit markers (marker.type === 'credits')
-- were mapped to chapterType 'intro' instead of 'outro'.
--
-- Since real intros and mislabeled credits are indistinguishable in the
-- DB, delete all 'intro' chapters for Plex-sourced programs and clear
-- their canonicalId so the next library scan re-imports with correct types.

-- Clear canonicalId for Plex programs that have 'intro' chapters
UPDATE `program` SET `canonical_id` = NULL
WHERE `source_type` = 'plex'
AND `uuid` IN (
  SELECT DISTINCT `pv`.`program_id`
  FROM `program_chapter` `pc`
  INNER JOIN `program_version` `pv` ON `pv`.`uuid` = `pc`.`program_version_id`
  INNER JOIN `program` `p` ON `p`.`uuid` = `pv`.`program_id`
  WHERE `pc`.`chapter_type` = 'intro'
  AND `p`.`source_type` = 'plex'
);
--> statement-breakpoint
-- Delete ambiguous 'intro' chapters for Plex programs
DELETE FROM `program_chapter`
WHERE `chapter_type` = 'intro'
AND `program_version_id` IN (
  SELECT `pv`.`uuid`
  FROM `program_version` `pv`
  INNER JOIN `program` `p` ON `p`.`uuid` = `pv`.`program_id`
  WHERE `p`.`source_type` = 'plex'
);