import type { InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { MediaSource } from './MediaSource.ts';

export const MediaSourceLibraryReplacePath = sqliteTable(
  'media_source_library_replace_path',
  {
    uuid: text().primaryKey().notNull(),
    serverPath: text().notNull(),
    localPath: text().notNull(),
    mediaSourceId: text()
      .notNull()
      .references(() => MediaSource.uuid, { onDelete: 'cascade' }),
  },
);

export const MediaSourceLibraryReplacePathRelations = relations(
  MediaSourceLibraryReplacePath,
  ({ one }) => ({
    mediaSource: one(MediaSource, {
      fields: [MediaSourceLibraryReplacePath.mediaSourceId],
      references: [MediaSource.uuid],
    }),
  }),
);

export type MediaSourceLibraryReplacePath = InferSelectModel<
  typeof MediaSourceLibraryReplacePath
>;
