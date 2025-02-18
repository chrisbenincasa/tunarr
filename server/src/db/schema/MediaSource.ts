import type { TupleToUnion } from '@tunarr/types';
import { inArray } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { type Insertable, type Selectable } from 'kysely';
import { type KyselifyBetter } from './KyselifyBetter.ts';

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
    uuid: text().primaryKey(),
    createdAt: integer(),
    updatedAt: integer(),
    accessToken: text().notNull(),
    clientIdentifier: text(),
    index: integer().notNull(),
    name: text().notNull(),
    sendChannelUpdates: integer({ mode: 'boolean' }).default(false),
    sendGuideUpdates: integer({ mode: 'boolean' }).default(false),
    type: text({ enum: MediaSourceTypes }).notNull(),
    uri: text().notNull(),
  },
  (table) => [
    check(
      'media_source_type_check',
      inArray(table.type, table.type.enumValues).inlineParams(),
    ),
  ],
);

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
  'uuid',
] as const;

export type MediaSourceTable = KyselifyBetter<typeof MediaSource>;
export type MediaSource = Selectable<MediaSourceTable>;
export type NewMediaSource = Insertable<MediaSourceTable>;
