import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
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
    shuffleOrder: text({ mode: 'json' }).$type<string[]>(), // Program UUIDs in shuffled order
    // Tracking
    lastScheduledAt: integer(),
    createdAt: integer(),
    updatedAt: integer(),
  },
  (table) => [
    index('infinite_schedule_slot_state_slot_uuid_index').on(table.slotUuid),
  ],
);

export type InfiniteScheduleSlotState = InferSelectModel<typeof InfiniteScheduleSlotState>;
export type NewInfiniteScheduleSlotState = InferInsertModel<typeof InfiniteScheduleSlotState>;
