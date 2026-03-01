import {
  relations,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Channel } from './Channel.ts';
import { InfiniteSchedule } from './InfiniteSchedule.ts';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';

/**
 * Schedule-level state for tracking generation progress across restarts.
 * One state row per (channel, schedule) pair — a schedule used by multiple
 * channels gets independent state for each channel.
 */
export const InfiniteScheduleState = sqliteTable(
  'infinite_schedule_state',
  {
    uuid: text().primaryKey(),
    // The channel this state belongs to (unique: one state row per channel)
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' })
      .unique(),
    // The schedule this state is for (non-unique: same schedule can have state for multiple channels)
    scheduleUuid: text()
      .notNull()
      .references(() => InfiniteSchedule.uuid, { onDelete: 'cascade' }),
    // Last slot used for generation
    lastSlotUuid: text().references(() => InfiniteScheduleSlot.uuid, {
      onDelete: 'set null',
    }),
    // Floating slot rotation position
    floatingSlotIndex: integer().default(0).notNull(),
    // Generation tracking
    lastGeneratedAt: integer({ mode: 'timestamp_ms' }),
    generationCursor: integer({ mode: 'timestamp_ms' }), // Where next generation should resume
    // RNG state for weighted slot selection
    slotSelectionSeed: text({ mode: 'json' }).$type<number[]>(),
    slotSelectionUseCount: integer().default(0).notNull(),
    // Timestamps
    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    index('infinite_schedule_state_schedule_uuid_index').on(table.scheduleUuid),
  ],
);

export const InfiniteScheduleStateRelations = relations(
  InfiniteScheduleState,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [InfiniteScheduleState.channelUuid],
      references: [Channel.uuid],
    }),
    schedule: one(InfiniteSchedule, {
      fields: [InfiniteScheduleState.scheduleUuid],
      references: [InfiniteSchedule.uuid],
    }),
    lastSlot: one(InfiniteScheduleSlot, {
      fields: [InfiniteScheduleState.lastSlotUuid],
      references: [InfiniteScheduleSlot.uuid],
    }),
  }),
);

export type InfiniteScheduleState = InferSelectModel<
  typeof InfiniteScheduleState
>;
export type NewInfiniteScheduleState = InferInsertModel<
  typeof InfiniteScheduleState
>;
