import { type TupleToUnion } from '@tunarr/types';
import type { InferSelectModel } from 'drizzle-orm';
import { inArray, relations } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable, Updateable } from 'kysely';
import type { MarkRequiredNotNull } from '../../types/util.ts';
import { Artwork } from './Artwork.ts';
import type { MediaSourceId } from './base.ts';
import { MediaSourceTypes } from './base.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSource, MediaSourceLibrary } from './MediaSource.ts';
import { Program } from './Program.ts';
import type { ProgramGroupingTable as RawProgramGrouping } from './ProgramGrouping.ts';
import { ProgramGroupingExternalId } from './ProgramGroupingExternalId.ts';

export const ProgramGroupingType = {
  Show: 'show',
  Season: 'season',
  Artist: 'artist',
  Album: 'album',
} as const;

export const ProgramGroupingTypes = [
  'show',
  'season',
  'artist',
  'album',
] as const;

export type ProgramGroupingType = TupleToUnion<typeof ProgramGroupingTypes>;

export const ProgramGrouping = sqliteTable(
  'program_grouping',
  {
    uuid: text().primaryKey(),
    canonicalId: text(),
    createdAt: integer(),
    updatedAt: integer(),
    icon: text(),
    index: integer(),
    summary: text(),
    title: text().notNull(),
    type: text({ enum: ProgramGroupingTypes }).notNull(),
    year: integer(),
    artistUuid: text().references((): AnySQLiteColumn => ProgramGrouping.uuid),
    showUuid: text().references((): AnySQLiteColumn => ProgramGrouping.uuid),
    libraryId: text().references(() => MediaSourceLibrary.uuid),
    sourceType: text({ enum: MediaSourceTypes }),
    externalKey: text(),
    mediaSourceId: text()
      .references(() => MediaSource.uuid, {
        onDelete: 'cascade',
      })
      .$type<MediaSourceId>(),
  },
  (table) => [
    index('program_grouping_show_uuid_index').on(table.showUuid),
    index('program_grouping_artist_uuid_index').on(table.artistUuid),
    check(
      'type_check',
      inArray(table.type, table.type.enumValues).inlineParams(),
    ),
  ],
);

export const ProgramGroupingRelations = relations(
  ProgramGrouping,
  ({ many, one }) => ({
    artist: one(ProgramGrouping, {
      fields: [ProgramGrouping.artistUuid],
      references: [ProgramGrouping.uuid],
      relationName: 'artist',
    }),
    show: one(ProgramGrouping, {
      fields: [ProgramGrouping.showUuid],
      references: [ProgramGrouping.uuid],
      relationName: 'show',
    }),
    children: many(Program),
    externalIds: many(ProgramGroupingExternalId),
    artwork: many(Artwork),
    library: one(MediaSourceLibrary, {
      fields: [ProgramGrouping.libraryId],
      references: [MediaSourceLibrary.uuid],
    }),
    mediaSource: one(MediaSource, {
      fields: [ProgramGrouping.mediaSourceId],
      references: [MediaSource.uuid],
    }),
    // localMediaSourcePath: one(LocalMediaSourcePath, {
    //   fields: [ProgramGrouping.mediaSourcePathId],
    //   references: [LocalMediaSourcePath.uuid],
    // }),
  }),
);

export type ProgramGroupingTable = KyselifyBetter<typeof ProgramGrouping>;
export type ProgramGrouping = Selectable<ProgramGroupingTable>;
export type NewProgramGrouping = MarkRequiredNotNull<
  Insertable<ProgramGroupingTable>,
  'canonicalId' | 'libraryId' | 'mediaSourceId' | 'sourceType' | 'externalKey'
>;
export type ProgramGroupingUpdate = Updateable<ProgramGroupingTable>;
export type ProgramGroupingOrm = InferSelectModel<typeof ProgramGrouping>;

const ProgramGroupingKeys: (keyof RawProgramGrouping)[] = [
  'artistUuid',
  'createdAt',
  'icon',
  'index',
  'showUuid',
  'summary',
  'title',
  'type',
  'updatedAt',
  'uuid',
  'year',
];

// TODO move this definition to the ProgramGrouping DAO file

export const AllProgramGroupingFieldsAliased = <Alias extends string>(
  alias: Alias,
): ProgramGroupingFields<Alias> =>
  ProgramGroupingKeys.map((key) => `${alias}.${key}` as const);

export const MinimalProgramGroupingFields: ProgramGroupingFields = [
  'programGrouping.uuid',
  'programGrouping.title',
  'programGrouping.year',
  // 'programGrouping.index',
];
export type ProgramGroupingFields<Alias extends string = 'programGrouping'> =
  readonly `${Alias}.${keyof RawProgramGrouping}`[];
