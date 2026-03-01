DROP INDEX `generated_schedule_item_start_time_index`;--> statement-breakpoint
DROP INDEX `generated_schedule_item_sequence_index`;--> statement-breakpoint
ALTER TABLE `generated_schedule_item` ADD `channel_uuid` text NOT NULL REFERENCES channel(uuid);--> statement-breakpoint
CREATE INDEX `generated_schedule_item_channel_uuid_index` ON `generated_schedule_item` (`channel_uuid`);--> statement-breakpoint
CREATE INDEX `generated_schedule_item_channel_start_time_index` ON `generated_schedule_item` (`channel_uuid`,`start_time_ms`);--> statement-breakpoint
CREATE INDEX `generated_schedule_item_channel_sequence_index` ON `generated_schedule_item` (`channel_uuid`,`sequence_index`);--> statement-breakpoint
DROP INDEX `infinite_schedule_slot_state_slotUuid_unique`;--> statement-breakpoint
ALTER TABLE `infinite_schedule_slot_state` ADD `channel_uuid` text NOT NULL REFERENCES channel(uuid);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_state_channel_uuid_index` ON `infinite_schedule_slot_state` (`channel_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `infinite_schedule_slot_state_channel_slot_unique` ON `infinite_schedule_slot_state` (`channel_uuid`,`slot_uuid`);--> statement-breakpoint
DROP INDEX `infinite_schedule_state_scheduleUuid_unique`;--> statement-breakpoint
ALTER TABLE `infinite_schedule_state` ADD `channel_uuid` text NOT NULL REFERENCES channel(uuid);--> statement-breakpoint
CREATE UNIQUE INDEX `infinite_schedule_state_channelUuid_unique` ON `infinite_schedule_state` (`channel_uuid`);