import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { ChannelCustomShow } from './ChannelCustomShow.ts';
import { CustomShowContent } from './CustomShowContent.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';

export const CustomShow = sqliteTable('custom_show', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  name: text().notNull(),
});

export type CustomShowTable = KyselifyBetter<typeof CustomShow>;
export type CustomShow = Selectable<CustomShowTable>;
export type NewCustomShow = Insertable<CustomShowTable>;

export const CustomShowRelations = relations(CustomShow, ({ many }) => ({
  channelCustomShows: many(ChannelCustomShow),
  content: many(CustomShowContent),
}));
