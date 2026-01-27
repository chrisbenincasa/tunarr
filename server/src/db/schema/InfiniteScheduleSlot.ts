import type { TupleToUnion } from '@tunarr/types';
import type { SlotFiller } from '@tunarr/types/api';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import z from 'zod';
import { Channel } from './Channel.ts';
import { CustomShow } from './CustomShow.ts';
import { FillerShow } from './FillerShow.ts';
import { InfiniteSchedule } from './InfiniteSchedule.ts';
import { InfiniteScheduleSlotState } from './InfiniteScheduleSlotState.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';
import { SmartCollection } from './SmartCollection.ts';

export const InfiniteSlotTypes = [
  'movie',
  'show',
  'custom-show',
  'filler',
  'redirect',
  'flex',
  'smart-collection',
] as const;
export type InfiniteSlotType = TupleToUnion<typeof InfiniteSlotTypes>;

export const AnchorModes = ['hard', 'soft', 'padded'] as const;
export type AnchorMode = TupleToUnion<typeof AnchorModes>;

export const IterationOrders = [
  'next',
  'shuffle',
  'ordered_shuffle',
  'alphanumeric',
  'chronological',
] as const;
export type IterationOrder = TupleToUnion<typeof IterationOrders>;

export const IterationDirections = ['asc', 'desc'] as const;
export type IterationDirection = TupleToUnion<typeof IterationDirections>;

export const FillModes = ['fill', 'count', 'duration'] as const;
export type FillMode = TupleToUnion<typeof FillModes>;

/**
 * Configuration for a slot that is stored as JSON.
 * Contains iteration settings, filters, etc.
 */
const InfiniteSlotConfig = z.object({
  order: z.enum(IterationOrders).nullish(),
  direction: z.enum(IterationDirections).nullish(),
  // For 'show' slots - season filter
  seasonFilter: z.number().array().nullish(),
});

export type InfiniteSlotConfig = z.infer<typeof InfiniteSlotConfig>;

/**
 * Filler configuration for a slot.
 */
export type InfiniteSlotFillerConfig = {
  fillers?: SlotFiller[];
};

export const InfiniteScheduleSlot = sqliteTable(
  'infinite_schedule_slot',
  {
    uuid: text().primaryKey(),
    scheduleUuid: text()
      .notNull()
      .references(() => InfiniteSchedule.uuid, { onDelete: 'cascade' }),
    slotIndex: integer().notNull(),
    slotType: text({ enum: InfiniteSlotTypes }).notNull(),

    // Entity references (only one populated per slot type) - enables FK constraints
    showId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
    customShowId: text().references(() => CustomShow.uuid, {
      onDelete: 'cascade',
    }),
    fillerListId: text().references(() => FillerShow.uuid, {
      onDelete: 'cascade',
    }),
    redirectChannelId: text().references(() => Channel.uuid, {
      onDelete: 'cascade',
    }),
    smartCollectionId: text().references(() => SmartCollection.uuid, {
      onDelete: 'cascade',
    }),

    // Non-entity config (iteration order, filters, etc.) - stays flexible in JSON
    slotConfig: text({ mode: 'json' }).$type<InfiniteSlotConfig>(),

    // Time-anchoring (null = floating slot)
    anchorTime: integer(), // Offset from midnight in ms
    anchorMode: text({ enum: AnchorModes }),
    anchorDays: text({ mode: 'json' }).$type<number[]>(), // Days of week [0-6]

    // For floating slots
    weight: integer().default(1).notNull(),
    cooldownMs: integer().default(0).notNull(),

    // Fill mode - controls how content is pulled before moving to next slot
    fillMode: text({ enum: FillModes }).default('fill').notNull(),
    fillValue: integer(), // For 'count': number of items; for 'duration': ms

    // Padding rules
    padMs: integer(), // Override schedule-level
    padToMultiple: integer(), // Start on multiples (e.g., 300000 = 5min)

    // Filler presets
    fillerConfig: text({ mode: 'json' }).$type<InfiniteSlotFillerConfig>(),

    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    index('infinite_schedule_slot_schedule_uuid_index').on(table.scheduleUuid),
    index('infinite_schedule_slot_show_id_index').on(table.showId),
    index('infinite_schedule_slot_custom_show_id_index').on(table.customShowId),
    index('infinite_schedule_slot_filler_list_id_index').on(table.fillerListId),
    index('infinite_schedule_slot_redirect_channel_id_index').on(
      table.redirectChannelId,
    ),
    index('infinite_schedule_slot_smart_collection_id_index').on(
      table.smartCollectionId,
    ),
  ],
);

export const InfiniteScheduleSlotRelations = relations(
  InfiniteScheduleSlot,
  ({ one }) => ({
    schedule: one(InfiniteSchedule, {
      fields: [InfiniteScheduleSlot.scheduleUuid],
      references: [InfiniteSchedule.uuid],
    }),
    show: one(ProgramGrouping, {
      fields: [InfiniteScheduleSlot.showId],
      references: [ProgramGrouping.uuid],
    }),
    customShow: one(CustomShow, {
      fields: [InfiniteScheduleSlot.customShowId],
      references: [CustomShow.uuid],
    }),
    fillerList: one(FillerShow, {
      fields: [InfiniteScheduleSlot.fillerListId],
      references: [FillerShow.uuid],
    }),
    redirectChannel: one(Channel, {
      fields: [InfiniteScheduleSlot.redirectChannelId],
      references: [Channel.uuid],
    }),
    smartCollection: one(SmartCollection, {
      fields: [InfiniteScheduleSlot.smartCollectionId],
      references: [SmartCollection.uuid],
    }),
    state: one(InfiniteScheduleSlotState, {
      fields: [InfiniteScheduleSlot.uuid],
      references: [InfiniteScheduleSlotState.slotUuid],
    }),
  }),
);

export type InfiniteScheduleSlot = InferSelectModel<
  typeof InfiniteScheduleSlot
>;
export type NewInfiniteScheduleSlot = InferInsertModel<
  typeof InfiniteScheduleSlot
>;
