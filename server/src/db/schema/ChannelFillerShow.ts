import { relations } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { Channel } from './Channel.ts';
import { FillerShow } from './FillerShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';

export const ChannelFillerShow = sqliteTable(
  'channel_filler_show',
  {
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    fillerShowUuid: text()
      .notNull()
      .references(() => FillerShow.uuid, { onDelete: 'cascade' }),
    cooldown: integer().notNull(),
    weight: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.channelUuid, table.fillerShowUuid] }),
  ],
);

export type ChannelFillerShowTable = KyselifyBetter<typeof ChannelFillerShow>;
export type ChannelFillerShow = Selectable<ChannelFillerShowTable>;
export type NewChannelFillerShow = Insertable<ChannelFillerShowTable>;

export const ChannelFillerShowRelations = relations(
  ChannelFillerShow,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [ChannelFillerShow.channelUuid],
      references: [Channel.uuid],
    }),
    filler: one(FillerShow, {
      fields: [ChannelFillerShow.fillerShowUuid],
      references: [FillerShow.uuid],
    }),
  }),
);
