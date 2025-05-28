import { createExternalId } from '@tunarr/shared';
import type { TupleToUnion } from '@tunarr/types';
import { inArray } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable, Updateable } from 'kysely';
import type { MarkNotNilable } from '../../types/util.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSource, MediaSourceTypes } from './MediaSource.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const ProgramTypes = [
  'movie',
  'episode',
  'track',
  'music_video',
  'other_video',
] as const;
export const ProgramType = {
  Movie: 'movie',
  Episode: 'episode',
  Track: 'track',
  MusicVideo: 'music_video',
  OtherVideo: 'other_video',
} as const;
export type ProgramType = TupleToUnion<typeof ProgramTypes>;

export const Program = sqliteTable(
  'program',
  {
    uuid: text().primaryKey(),
    createdAt: integer(),
    updatedAt: integer(),
    albumName: text(),
    albumUuid: text().references(() => ProgramGrouping.uuid),
    artistName: text(),
    artistUuid: text().references(() => ProgramGrouping.uuid),
    duration: integer().notNull(),
    episode: integer(),
    episodeIcon: text(),
    externalKey: text().notNull(),
    externalSourceId: text().notNull(),
    mediaSourceId: text().references(() => MediaSource.uuid, {
      onDelete: 'cascade',
    }),
    filePath: text(),
    grandparentExternalKey: text(),
    icon: text(),
    originalAirDate: text(),
    parentExternalKey: text(),
    plexFilePath: text(),
    plexRatingKey: text(),
    rating: text(),
    seasonIcon: text(),
    seasonNumber: integer(),
    seasonUuid: text().references(() => ProgramGrouping.uuid),
    showIcon: text(),
    showTitle: text(),
    sourceType: text({ enum: MediaSourceTypes }).notNull(),
    summary: text(),
    title: text().notNull(),
    tvShowUuid: text().references(() => ProgramGrouping.uuid),
    type: text({ enum: ProgramTypes }).notNull(),
    year: integer(),
  },
  (table) => [
    index('program_season_uuid_index').on(table.seasonUuid),
    index('program_tv_show_uuid_index').on(table.tvShowUuid),
    index('program_album_uuid_index').on(table.albumUuid),
    index('program_artist_uuid_index').on(table.artistUuid),
    uniqueIndex(
      'program_source_type_external_source_id_external_key_unique',
    ).on(table.sourceType, table.externalSourceId, table.externalKey),
    check(
      'program_type_check',
      inArray(table.type, table.type.enumValues).inlineParams(),
    ),
    check(
      'program_source_type_check',
      inArray(table.sourceType, table.sourceType.enumValues).inlineParams(),
    ),
  ],
);

export type ProgramTable = KyselifyBetter<typeof Program>;
export type ProgramDao = Selectable<ProgramTable>;
export type NewProgramDao = MarkNotNilable<
  Insertable<ProgramTable>,
  'mediaSourceId'
>;
export type ProgramDaoUpdate = Updateable<ProgramTable>;

export function programExternalIdString(p: ProgramDao | NewProgramDao) {
  return createExternalId(p.sourceType, p.externalSourceId, p.externalKey);
}
