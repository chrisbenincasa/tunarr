import {
  relations,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { Channel } from './Channel.ts';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';

/**
 * RNG seed stored as an array of numbers for Mersenne Twister initialization.
 */
export type RngSeed = number[];

/**
 * Per-filler-list state for weighted iterator persistence.
 */
export type FillerListState = {
  /** programUuid → current weight multiplier */
  weightsById: Record<string, number>;
  /** programUuid → ms timestamp of last selection */
  lastSeenAtById: Record<string, number>;
};

/**
 * Filler iterator state persisted across generation runs for one slot.
 */
export type SlotFillerPersistenceState = {
  /** Seed for the filler RNG (Mersenne Twister) */
  rngSeed: number[] | null;
  /** Number of times the filler RNG has been advanced */
  rngUseCount: number;
  /** Per-filler-list weighted iterator state */
  byListId: Record<string, FillerListState>;
};

/**
 * Per-slot iteration state, scoped to a channel.
 * When a schedule is used by multiple channels, each channel gets independent
 * slot state (separate iterator position, RNG, fill-mode progress).
 */
export const InfiniteScheduleSlotState = sqliteTable(
  'infinite_schedule_slot_state',
  {
    uuid: text().primaryKey(),
    // The channel this state belongs to
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    slotUuid: text()
      .notNull()
      .references(() => InfiniteScheduleSlot.uuid, { onDelete: 'cascade' }),
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
    // Filler iterator persistence state (weights, lastSeen timestamps, rng position)
    fillerState: text({ mode: 'json' }).$type<SlotFillerPersistenceState | null>(),
    // Tracking
    lastScheduledAt: integer({ mode: 'timestamp_ms' }),
    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    // Each channel has exactly one state row per slot
    unique('infinite_schedule_slot_state_channel_slot_unique').on(
      table.channelUuid,
      table.slotUuid,
    ),
    index('infinite_schedule_slot_state_channel_uuid_index').on(
      table.channelUuid,
    ),
    index('infinite_schedule_slot_state_slot_uuid_index').on(table.slotUuid),
  ],
);

export const InfiniteScheduleSlotRelations = relations(
  InfiniteScheduleSlotState,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [InfiniteScheduleSlotState.channelUuid],
      references: [Channel.uuid],
    }),
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
