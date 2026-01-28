CREATE TABLE `channel_schedule` (
	`channel_id` text NOT NULL,
	`infinite_schedule_id` text,
	FOREIGN KEY (`channel_id`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`infinite_schedule_id`) REFERENCES `infinite_schedule`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_schedule_channelId_unique` ON `channel_schedule` (`channel_id`);--> statement-breakpoint
CREATE INDEX `channel_schedules_by_infinite_schedule_id_idx` ON `channel_schedule` (`infinite_schedule_id`);--> statement-breakpoint
CREATE TABLE `generated_schedule_item` (
	`uuid` text PRIMARY KEY NOT NULL,
	`schedule_uuid` text NOT NULL,
	`program_uuid` text,
	`slot_uuid` text,
	`item_type` text NOT NULL,
	`start_time_ms` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`redirect_channel_uuid` text,
	`filler_list_id` text,
	`filler_type` text,
	`sequence_index` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`schedule_uuid`) REFERENCES `infinite_schedule`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_uuid`) REFERENCES `program`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`slot_uuid`) REFERENCES `infinite_schedule_slot`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`redirect_channel_uuid`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filler_list_id`) REFERENCES `filler_show`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generated_schedule_item_schedule_uuid_index` ON `generated_schedule_item` (`schedule_uuid`);--> statement-breakpoint
CREATE INDEX `generated_schedule_item_start_time_index` ON `generated_schedule_item` (`schedule_uuid`,`start_time_ms`);--> statement-breakpoint
CREATE INDEX `generated_schedule_item_sequence_index` ON `generated_schedule_item` (`schedule_uuid`,`sequence_index`);--> statement-breakpoint
CREATE TABLE `infinite_schedule` (
	`uuid` text PRIMARY KEY NOT NULL,
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
CREATE TABLE `infinite_schedule_slot` (
	`uuid` text PRIMARY KEY NOT NULL,
	`schedule_uuid` text NOT NULL,
	`slot_index` integer NOT NULL,
	`slot_type` text NOT NULL,
	`show_id` text,
	`custom_show_id` text,
	`filler_list_id` text,
	`redirect_channel_id` text,
	`smart_collection_id` text,
	`slot_config` text,
	`anchor_time` integer,
	`anchor_mode` text,
	`anchor_days` text,
	`weight` integer DEFAULT 1 NOT NULL,
	`cooldown_ms` integer DEFAULT 0 NOT NULL,
	`fill_mode` text DEFAULT 'fill' NOT NULL,
	`fill_value` integer,
	`pad_ms` integer,
	`pad_to_multiple` integer,
	`filler_config` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`schedule_uuid`) REFERENCES `infinite_schedule`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`show_id`) REFERENCES `program_grouping`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_show_id`) REFERENCES `custom_show`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filler_list_id`) REFERENCES `filler_show`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`redirect_channel_id`) REFERENCES `channel`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`smart_collection_id`) REFERENCES `smart_collection`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_schedule_uuid_index` ON `infinite_schedule_slot` (`schedule_uuid`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_show_id_index` ON `infinite_schedule_slot` (`show_id`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_custom_show_id_index` ON `infinite_schedule_slot` (`custom_show_id`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_filler_list_id_index` ON `infinite_schedule_slot` (`filler_list_id`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_redirect_channel_id_index` ON `infinite_schedule_slot` (`redirect_channel_id`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_smart_collection_id_index` ON `infinite_schedule_slot` (`smart_collection_id`);--> statement-breakpoint
CREATE TABLE `infinite_schedule_slot_state` (
	`uuid` text PRIMARY KEY NOT NULL,
	`slot_uuid` text NOT NULL,
	`rng_seed` text,
	`rng_use_count` integer DEFAULT 0 NOT NULL,
	`iterator_position` integer DEFAULT 0 NOT NULL,
	`shuffle_order` text,
	`fill_mode_count` integer DEFAULT 0 NOT NULL,
	`fill_mode_duration_ms` integer DEFAULT 0 NOT NULL,
	`last_scheduled_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`slot_uuid`) REFERENCES `infinite_schedule_slot`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `infinite_schedule_slot_state_slotUuid_unique` ON `infinite_schedule_slot_state` (`slot_uuid`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_slot_state_slot_uuid_index` ON `infinite_schedule_slot_state` (`slot_uuid`);--> statement-breakpoint
CREATE TABLE `infinite_schedule_state` (
	`uuid` text PRIMARY KEY NOT NULL,
	`schedule_uuid` text NOT NULL,
	`last_slot_uuid` text,
	`floating_slot_index` integer DEFAULT 0 NOT NULL,
	`last_generated_at` integer,
	`generation_cursor` integer,
	`slot_selection_seed` text,
	`slot_selection_use_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`schedule_uuid`) REFERENCES `infinite_schedule`(`uuid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_slot_uuid`) REFERENCES `infinite_schedule_slot`(`uuid`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `infinite_schedule_state_scheduleUuid_unique` ON `infinite_schedule_state` (`schedule_uuid`);--> statement-breakpoint
CREATE INDEX `infinite_schedule_state_schedule_uuid_index` ON `infinite_schedule_state` (`schedule_uuid`);--> statement-breakpoint
ALTER TABLE `channel` ADD `infinite_schedule_uuid` text;--> statement-breakpoint
CREATE INDEX `channel_infinite_schedule_uuid_index` ON `channel` (`infinite_schedule_uuid`);