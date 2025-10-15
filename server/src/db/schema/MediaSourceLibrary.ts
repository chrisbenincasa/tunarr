import { inArray, relations, type InferSelectModel } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable, Updateable } from 'kysely';
import { MediaLibraryTypes, type MediaSourceId } from './base.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSource } from './MediaSource.ts';
import { Program } from './Program.ts';

export const MediaSourceLibrary = sqliteTable(
  'media_source_library',
  {
    uuid: text().primaryKey().notNull(),
    name: text().notNull(),
    mediaType: text({ enum: MediaLibraryTypes }).notNull(),
    mediaSourceId: text()
      .references(() => MediaSource.uuid, { onDelete: 'cascade' })
      .notNull()
      .$type<MediaSourceId>(),
    lastScannedAt: integer({ mode: 'timestamp_ms' }),
    externalKey: text().notNull(),
    enabled: integer({ mode: 'boolean' }).default(false).notNull(),
  },
  (table) => [
    check(
      'media_type_check',
      inArray(table.mediaType, table.mediaType.enumValues).inlineParams(),
    ),
  ],
);

export const MediaSourceLibraryRelations = relations(
  MediaSourceLibrary,
  ({ one, many }) => ({
    programs: many(Program),
    mediaSource: one(MediaSource, {
      fields: [MediaSourceLibrary.mediaSourceId],
      references: [MediaSource.uuid],
    }),
  }),
);

export const MediaSourceLibraryColumns: (keyof MediaSourceLibraryTable)[] = [
  'enabled',
  'externalKey',
  'lastScannedAt',
  'mediaSourceId',
  'mediaType',
  'uuid',
  'name',
];

export type MediaSourceLibraryTable = KyselifyBetter<typeof MediaSourceLibrary>;
export type MediaSourceLibrary = Selectable<MediaSourceLibraryTable>;
export type MediaSourceLibraryOrm = InferSelectModel<typeof MediaSourceLibrary>;
export type NewMediaSourceLibrary = Insertable<MediaSourceLibraryTable>;
export type MediaSourceLibraryUpdate = Updateable<MediaSourceLibraryTable>;
