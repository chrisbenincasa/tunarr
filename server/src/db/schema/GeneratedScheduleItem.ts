import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Channel } from './Channel.ts';
import { FillerShow } from './FillerShow.ts';
import { InfiniteSchedule } from './InfiniteSchedule.ts';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';
import { Program } from './Program.ts';
import type { SlotFillerTypes } from '@tunarr/types/api';

export const GeneratedItemTypes = [
  'content',
  'offline',
  'redirect',
  'filler',
  'flex',
] as const;
export type GeneratedItemType = (typeof GeneratedItemTypes)[number];

export const GeneratedScheduleItem = sqliteTable(
  'generated_schedule_item',
  {
    uuid: text().primaryKey(),
    scheduleUuid: text()
      .notNull()
      .references(() => InfiniteSchedule.uuid, { onDelete: 'cascade' }),
    programUuid: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    slotUuid: text().references(() => InfiniteScheduleSlot.uuid, { onDelete: 'cascade' }),
    itemType: text({ enum: GeneratedItemTypes }).notNull(),
    startTimeMs: integer().notNull(), // Absolute timestamp in ms
    durationMs: integer().notNull(),
    // For redirect items
    redirectChannelUuid: text().references(() => Channel.uuid, { onDelete: 'cascade' }),
    // For filler items
    fillerListId: text().references(() => FillerShow.uuid, { onDelete: 'cascade' }),
    fillerType: text().$type<SlotFillerTypes>(),
    // Sequence tracking
    sequenceIndex: integer().notNull(), // For ordering within the schedule
    createdAt: integer(),
  },
  (table) => [
    index('generated_schedule_item_schedule_uuid_index').on(table.scheduleUuid),
    index('generated_schedule_item_start_time_index').on(
      table.scheduleUuid,
      table.startTimeMs,
    ),
    index('generated_schedule_item_sequence_index').on(
      table.scheduleUuid,
      table.sequenceIndex,
    ),
  ],
);

export const GeneratedScheduleItemRelations = relations(
  GeneratedScheduleItem,
  ({ one }) => ({
    schedule: one(InfiniteSchedule, {
      fields: [GeneratedScheduleItem.scheduleUuid],
      references: [InfiniteSchedule.uuid],
    }),
    program: one(Program, {
      fields: [GeneratedScheduleItem.programUuid],
      references: [Program.uuid],
    }),
    slot: one(InfiniteScheduleSlot, {
      fields: [GeneratedScheduleItem.slotUuid],
      references: [InfiniteScheduleSlot.uuid],
    }),
    redirectChannel: one(Channel, {
      fields: [GeneratedScheduleItem.redirectChannelUuid],
      references: [Channel.uuid],
    }),
    fillerList: one(FillerShow, {
      fields: [GeneratedScheduleItem.fillerListId],
      references: [FillerShow.uuid],
    }),
  }),
);

export type GeneratedScheduleItem = InferSelectModel<typeof GeneratedScheduleItem>;
export type NewGeneratedScheduleItem = InferInsertModel<typeof GeneratedScheduleItem>;
