import {
  relations,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';

/**
 * RNG seed stored as an array of numbers for Mersenne Twister initialization.
 */
export type RngSeed = number[];

export const InfiniteScheduleSlotState = sqliteTable(
  'infinite_schedule_slot_state',
  {
    uuid: text().primaryKey(),
    slotUuid: text()
      .notNull()
      .references(() => InfiniteScheduleSlot.uuid, { onDelete: 'cascade' })
      .unique(),
    // RNG state
    rngSeed: text({ mode: 'json' }).$type<RngSeed>(),
    rngUseCount: integer().default(0).notNull(),
    // Iteration position
    iteratorPosition: integer().default(0).notNull(),
    // Shuffle state
    shuffleOrder: text({ mode: 'json' }).$type<string[]>(), // Program UUIDs in shuffled order
    // Fill mode progress (reset when slot rotation advances)
    fillModeCount: integer().default(0).notNull(), // Items pulled in current "run" (for count mode)
    fillModeDurationMs: integer().default(0).notNull(), // Duration accumulated (for duration mode)
    // Tracking
    lastScheduledAt: integer({ mode: 'timestamp_ms' }),
    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    index('infinite_schedule_slot_state_slot_uuid_index').on(table.slotUuid),
  ],
);

export const InfiniteScheduleSlotRelations = relations(
  InfiniteScheduleSlotState,
  ({ one }) => ({
    slot: one(InfiniteScheduleSlot, {
      fields: [InfiniteScheduleSlotState.slotUuid],
      references: [InfiniteScheduleSlot.uuid],
    }),
  }),
);

export type InfiniteScheduleSlotState = InferSelectModel<
  typeof InfiniteScheduleSlotState
>;
export type NewInfiniteScheduleSlotState = InferInsertModel<
  typeof InfiniteScheduleSlotState
>;
