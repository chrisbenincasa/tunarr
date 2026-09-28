import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { CustomShowContent } from './CustomShowContent.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSource } from './MediaSource.ts';
import { StreamSelectionProfile } from './StreamSelectionProfile.ts';

export const CustomShow = sqliteTable('custom_show', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  name: text().notNull(),
  syncMediaSourceId: text().references(() => MediaSource.uuid, {
    onDelete: 'set null',
  }),
  syncMediaSourceType: text().$type<'plex'>(),
  syncExternalPlaylistId: text(),
  lastSyncedAt: integer({ mode: 'timestamp_ms' }),
  streamSelectionProfileId: text().references(
    () => StreamSelectionProfile.uuid,
    { onDelete: 'set null' },
  ),
});

export type CustomShowTable = KyselifyBetter<typeof CustomShow>;
export type CustomShow = Selectable<CustomShowTable>;
export type NewCustomShow = Insertable<CustomShowTable>;

export const CustomShowRelations = relations(CustomShow, ({ many }) => ({
  content: many(CustomShowContent),
}));
