import type { TupleToUnion } from '@tunarr/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ChannelSchedule } from './ChannelSchedule.ts';
import { GeneratedScheduleItem } from './GeneratedScheduleItem.ts';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';
import { InfiniteScheduleState } from './InfiniteScheduleState.ts';

export const FlexPreferences = ['distribute', 'end'] as const;
export type FlexPreference = TupleToUnion<typeof FlexPreferences>;

export const SlotPlaybackOrder = ['ordered', 'shuffle'] as const;
export type SlotPlaybackOrder = TupleToUnion<typeof SlotPlaybackOrder>;

export const InfiniteSchedule = sqliteTable('infinite_schedule', {
  uuid: text().primaryKey(),
  name: text().notNull(),
  // Schedule-level settings
  padMs: integer().default(0).notNull(), // Default none
  flexPreference: text({ enum: FlexPreferences }).default('end').notNull(),
  timeZoneOffset: integer().default(0).notNull(), // Offset in minutes
  slotPlaybackOrder: text({ enum: SlotPlaybackOrder })
    .default('ordered')
    .notNull(),
  // Buffer management
  bufferDays: integer().default(7).notNull(), // How far ahead to pre-generate
  bufferThresholdDays: integer().default(2).notNull(), // When to trigger regeneration
  enabled: integer({ mode: 'boolean' }).default(true).notNull(),
  createdAt: integer({ mode: 'timestamp_ms' }),
  updatedAt: integer({ mode: 'timestamp_ms' }),
});

export const InfiniteScheduleRelations = relations(
  InfiniteSchedule,
  ({ one, many }) => ({
    channels: many(ChannelSchedule),
    slots: many(InfiniteScheduleSlot),
    generatedItems: many(GeneratedScheduleItem),
    state: one(InfiniteScheduleState, {
      fields: [InfiniteSchedule.uuid],
      references: [InfiniteScheduleState.scheduleUuid],
    }),
  }),
);

export type InfiniteSchedule = InferSelectModel<typeof InfiniteSchedule>;
export type NewInfiniteSchedule = InferInsertModel<typeof InfiniteSchedule>;
