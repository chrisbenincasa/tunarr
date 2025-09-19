import type { TupleToUnion } from '@tunarr/types';
import type { InferSelectModel } from 'drizzle-orm';
import { inArray, relations } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Updateable } from 'kysely';
import { type Insertable, type Selectable } from 'kysely';
import type { MediaSourceName } from './base.ts';
import { type MediaSourceId } from './base.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const MediaSourceTypes = ['plex', 'jellyfin', 'emby'] as const;

export type MediaSourceType = TupleToUnion<typeof MediaSourceTypes>;

type MediaSourceMap = {
  [k in Capitalize<(typeof MediaSourceTypes)[number]>]: Uncapitalize<k>;
};

export const MediaSourceType: MediaSourceMap = {
  Plex: 'plex',
  Jellyfin: 'jellyfin',
  Emby: 'emby',
} as const;

export const MediaSource = sqliteTable(
  'media_source',
  {
    uuid: text().primaryKey().$type<MediaSourceId>(),
    createdAt: integer(),
    updatedAt: integer(),
    accessToken: text().notNull(),
    clientIdentifier: text(),
    index: integer().notNull(),
    name: text().notNull().$type<MediaSourceName>(),
    sendChannelUpdates: integer({ mode: 'boolean' }).default(false),
    sendGuideUpdates: integer({ mode: 'boolean' }).default(false),
    type: text({ enum: MediaSourceTypes }).notNull(),
    uri: text().notNull(),
    username: text(),
    userId: text(),
  },
  (table) => [
    check(
      'media_source_type_check',
      inArray(table.type, table.type.enumValues).inlineParams(),
    ),
  ],
);

export const MediaSourceRelations = relations(MediaSource, ({ many }) => ({
  libraries: many(MediaSourceLibrary),
  programs: many(Program),
}));

export const MediaSourceFields: (keyof MediaSourceTable)[] = [
  'accessToken',
  'clientIdentifier',
  'createdAt',
  'index',
  'name',
  'sendChannelUpdates',
  'sendGuideUpdates',
  'type',
  'updatedAt',
  'uri',
  'userId',
  'username',
  'uuid',
] as const;

export type MediaSourceTable = KyselifyBetter<typeof MediaSource>;
export type MediaSource = Selectable<MediaSourceTable>;
export type NewMediaSource = Insertable<MediaSourceTable>;
export type MediaSourceUpdate = Updateable<MediaSourceTable>;

export const MediaLibraryTypes = [
  'movies',
  'shows',
  'music_videos',
  'other_videos',
  'tracks',
] as const;

export type MediaLibraryType = TupleToUnion<typeof MediaLibraryTypes>;

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
    one: one(MediaSource, {
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
