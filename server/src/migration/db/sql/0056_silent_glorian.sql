-- Merge studios that share a name into the oldest row, then drop link rows that became identical.
UPDATE `studio_entity` SET `studio_id` = (
  SELECT `keep`.`uuid` FROM `studio` AS `dup`
  JOIN `studio` AS `keep` ON `keep`.`name` = `dup`.`name`
  WHERE `dup`.`uuid` = `studio_entity`.`studio_id`
  ORDER BY `keep`.`rowid` LIMIT 1
)
WHERE `studio_id` IN (
  SELECT `s`.`uuid` FROM `studio` AS `s`
  WHERE `s`.`rowid` > (SELECT MIN(`x`.`rowid`) FROM `studio` AS `x` WHERE `x`.`name` = `s`.`name`)
);--> statement-breakpoint
DELETE FROM `studio` WHERE `rowid` NOT IN (SELECT MIN(`rowid`) FROM `studio` GROUP BY `name`);--> statement-breakpoint
DELETE FROM `studio_entity` WHERE `rowid` NOT IN (
  SELECT MIN(`rowid`) FROM `studio_entity` GROUP BY `studio_id`, `program_id`, `group_id`
);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_name_unique_idx` ON `studio` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_program_unique_idx` ON `studio_entity` (`studio_id`,`program_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_grouping_unique_idx` ON `studio_entity` (`studio_id`,`group_id`);