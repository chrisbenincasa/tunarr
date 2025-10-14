import { relations } from 'drizzle-orm';
import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Selectable } from 'kysely';
import { Channel } from './Channel.ts';
import { CustomShow } from './CustomShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';

export const ChannelCustomShow = sqliteTable(
  'channel_custom_show',
  {
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    customShowUuid: text()
      .notNull()
      .references(() => CustomShow.uuid, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.channelUuid, table.customShowUuid] }),
  ],
);

export type ChannelCustomShowsTable = KyselifyBetter<typeof ChannelCustomShow>;
export type ChannelCustomShows = Selectable<ChannelCustomShowsTable>;

export const ChannelCustomShowRelations = relations(
  ChannelCustomShow,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [ChannelCustomShow.channelUuid],
      references: [Channel.uuid],
    }),
    customShow: one(CustomShow, {
      fields: [ChannelCustomShow.customShowUuid],
      references: [CustomShow.uuid],
    }),
  }),
);
