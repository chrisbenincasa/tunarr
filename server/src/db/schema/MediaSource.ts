import type { TupleToUnion } from '@tunarr/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { inArray, relations } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Updateable } from 'kysely';
import { type Insertable, type Selectable } from 'kysely';
import type { StrictExclude } from 'ts-essentials';
import type { MediaSourceName, MediaSourceType } from './base.ts';
import {
  MediaLibraryTypes,
  MediaSourceTypes,
  type MediaSourceId,
} from './base.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { LocalMediaSourcePath } from './LocalMediaSourcePath.ts';
import { MediaSourceLibrary } from './MediaSourceLibrary.ts';
import { MediaSourceLibraryReplacePath } from './MediaSourceLibraryReplacePath.ts';
import { Program } from './Program.ts';

export type RemoteMediaSourceType = StrictExclude<MediaSourceType, 'local'>;

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
    // sendPlayStatusUpdates: integer({ mode: 'boolean' }).default(false),
    type: text({ enum: MediaSourceTypes }).notNull(),
    uri: text().notNull(),
    username: text(),
    userId: text(),
    mediaType: text({ enum: MediaLibraryTypes }), // Only present for local media sources
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
  paths: many(LocalMediaSourcePath),
  replacePaths: many(MediaSourceLibraryReplacePath),
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
export type MediaSourceOrm = InferSelectModel<typeof MediaSource>;
export type NewMediaSourceOrm = InferInsertModel<typeof MediaSource>;
export type NewMediaSource = Insertable<MediaSourceTable>;
export type MediaSourceUpdate = Updateable<MediaSourceTable>;

export type MediaLibraryType = TupleToUnion<typeof MediaLibraryTypes>;
