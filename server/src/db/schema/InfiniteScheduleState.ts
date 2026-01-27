import {
  relations,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { InfiniteSchedule } from './InfiniteSchedule.ts';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';

/**
 * Schedule-level state for tracking generation progress across restarts.
 * One-to-one relationship with InfiniteSchedule.
 */
export const InfiniteScheduleState = sqliteTable(
  'infinite_schedule_state',
  {
    uuid: text().primaryKey(),
    scheduleUuid: text()
      .notNull()
      .references(() => InfiniteSchedule.uuid, { onDelete: 'cascade' })
      .unique(),
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
