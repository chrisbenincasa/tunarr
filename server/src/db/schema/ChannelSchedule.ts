import { relations } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Channel } from './Channel.ts';
import { InfiniteSchedule } from './InfiniteSchedule.ts';

export const ChannelSchedule = sqliteTable(
  'channel_schedule',
  {
    channelId: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' })
      .unique(),
    infiniteScheduleId: text().references(() => InfiniteSchedule.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('channel_schedules_by_infinite_schedule_id_idx').on(
      table.infiniteScheduleId,
    ),
  ],
);

export const ChannelScheduleRelations = relations(
  ChannelSchedule,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [ChannelSchedule.channelId],
      references: [Channel.uuid],
    }),
    infiniteSchedule: one(InfiniteSchedule, {
      fields: [ChannelSchedule.infiniteScheduleId],
      references: [InfiniteSchedule.uuid],
    }),
  }),
);
