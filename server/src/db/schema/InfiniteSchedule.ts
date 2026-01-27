import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Channel } from './Channel.ts';
import { InfiniteScheduleSlot } from './InfiniteScheduleSlot.ts';
import { GeneratedScheduleItem } from './GeneratedScheduleItem.ts';

export const FlexPreferences = ['distribute', 'end'] as const;
export type FlexPreference = (typeof FlexPreferences)[number];

export const InfiniteSchedule = sqliteTable(
  'infinite_schedule',
  {
    uuid: text().primaryKey(),
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' })
      .unique(),
    // Schedule-level settings
    padMs: integer().default(300000).notNull(), // Default 5 min
    flexPreference: text({ enum: FlexPreferences }).default('end').notNull(),
    timeZoneOffset: integer().default(0).notNull(), // Offset in minutes
    // Buffer management
    bufferDays: integer().default(7).notNull(), // How far ahead to pre-generate
    bufferThresholdDays: integer().default(2).notNull(), // When to trigger regeneration
    enabled: integer({ mode: 'boolean' }).default(true).notNull(),
    createdAt: integer(),
    updatedAt: integer(),
  },
  (table) => [index('infinite_schedule_channel_uuid_index').on(table.channelUuid)],
);

export const InfiniteScheduleRelations = relations(
  InfiniteSchedule,
  ({ one, many }) => ({
    channel: one(Channel, {
      fields: [InfiniteSchedule.channelUuid],
      references: [Channel.uuid],
    }),
    slots: many(InfiniteScheduleSlot),
    generatedItems: many(GeneratedScheduleItem),
  }),
);

export type InfiniteSchedule = InferSelectModel<typeof InfiniteSchedule>;
export type NewInfiniteSchedule = InferInsertModel<typeof InfiniteSchedule>;
