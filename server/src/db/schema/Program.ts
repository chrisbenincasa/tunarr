import type { TupleToUnion } from '@tunarr/types';
import type { InferSelectModel } from 'drizzle-orm';
import { inArray, relations } from 'drizzle-orm';
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
import { Artwork } from './Artwork.ts';
import type { MediaSourceName } from './base.ts';
import { MediaSourceTypes, ProgramStates, type MediaSourceId } from './base.ts';
import { Credit } from './Credit.ts';
import { EntityGenre } from './Genre.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { LocalMediaFolder } from './LocalMediaFolder.ts';
import { LocalMediaSourcePath } from './LocalMediaSourcePath.ts';
import { MediaSource } from './MediaSource.ts';
import { MediaSourceLibrary } from './MediaSourceLibrary.ts';
import { ProgramExternalId } from './ProgramExternalId.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';
import { ProgramSubtitles } from './ProgramSubtitles.ts';
import { ProgramVersion } from './ProgramVersion.ts';
import { StudioEntity } from './Studio.ts';

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
    canonicalId: text(),
    duration: integer().notNull(),
    episode: integer(),
    episodeIcon: text(),
    externalKey: text().notNull(),
    externalSourceId: text().notNull().$type<MediaSourceName>(),
    mediaSourceId: text()
      .references(() => MediaSource.uuid, {
        onDelete: 'cascade',
      })
      .$type<MediaSourceId>(),
    libraryId: text().references(() => MediaSourceLibrary.uuid, {
      onDelete: 'cascade',
    }),
    localMediaFolderId: text().references(() => LocalMediaFolder.uuid),
    localMediaSourcePathId: text().references(() => LocalMediaSourcePath.uuid),
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
    plot: text(),
    tagline: text(),
    title: text().notNull(),
    tvShowUuid: text().references(() => ProgramGrouping.uuid),
    type: text({ enum: ProgramTypes }).notNull(),
    year: integer(),
    state: text({ enum: ProgramStates }).notNull().default('ok'),
  },
  (table) => [
    index('program_season_uuid_index').on(table.seasonUuid),
    index('program_tv_show_uuid_index').on(table.tvShowUuid),
    index('program_album_uuid_index').on(table.albumUuid),
    index('program_artist_uuid_index').on(table.artistUuid),
    index('program_media_source_id_index').on(table.mediaSourceId),
    index('program_media_library_id_index').on(table.libraryId),
    uniqueIndex(
      'program_source_type_external_source_id_external_key_unique',
    ).on(table.sourceType, table.externalSourceId, table.externalKey),
    uniqueIndex('program_source_type_media_source_external_key_unique').on(
      table.sourceType,
      table.mediaSourceId,
      table.externalKey,
    ),
    check(
      'program_type_check',
      inArray(table.type, table.type.enumValues).inlineParams(),
    ),
    check(
      'program_source_type_check',
      inArray(table.sourceType, table.sourceType.enumValues).inlineParams(),
    ),
    index('program_canonical_id_index').on(table.canonicalId),
    index('program_state_index').on(table.state),
  ],
);

export const ProgramRelations = relations(Program, ({ many, one }) => ({
  versions: many(ProgramVersion, { relationName: 'versions' }),
  artist: one(ProgramGrouping, {
    fields: [Program.artistUuid],
    references: [ProgramGrouping.uuid],
    relationName: 'children',
  }),
  album: one(ProgramGrouping, {
    fields: [Program.albumUuid],
    references: [ProgramGrouping.uuid],
    relationName: 'children',
  }),
  season: one(ProgramGrouping, {
    fields: [Program.seasonUuid],
    references: [ProgramGrouping.uuid],
    relationName: 'children',
  }),
  show: one(ProgramGrouping, {
    fields: [Program.tvShowUuid],
    references: [ProgramGrouping.uuid],
    relationName: 'children',
  }),
  mediaSource: one(MediaSource, {
    fields: [Program.mediaSourceId],
    references: [MediaSource.uuid],
  }),
  mediaLibrary: one(MediaSourceLibrary, {
    fields: [Program.libraryId],
    references: [MediaSourceLibrary.uuid],
  }),
  externalIds: many(ProgramExternalId),
  localMediaFolder: one(LocalMediaFolder, {
    fields: [Program.localMediaFolderId],
    references: [LocalMediaFolder.uuid],
  }),
  localMediaSourcePath: one(LocalMediaSourcePath, {
    fields: [Program.localMediaSourcePathId],
    references: [LocalMediaSourcePath.uuid],
  }),
  artwork: many(Artwork),
  subtitles: many(ProgramSubtitles),
  credits: many(Credit),
  genres: many(EntityGenre),
  studios: many(StudioEntity),
}));

export type ProgramTable = KyselifyBetter<typeof Program>;
export type ProgramDao = Selectable<ProgramTable>;
export type ProgramOrm = InferSelectModel<typeof Program>;
// Make canonicalId required on insert.
export type NewProgramDao = MarkNotNilable<
  Insertable<ProgramTable>,
  'canonicalId' | 'mediaSourceId' | 'state'
>;
export type ProgramDaoUpdate = Updateable<ProgramTable>;
