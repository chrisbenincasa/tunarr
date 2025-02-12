import { type TupleToUnion } from '@tunarr/types';
import { inArray } from 'drizzle-orm';
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
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSourceLibrary } from './MediaSource.ts';
import type { ProgramGroupingTable as RawProgramGrouping } from './ProgramGrouping.ts';

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

export type ProgramGroupingTable = KyselifyBetter<typeof ProgramGrouping>;
export type ProgramGrouping = Selectable<ProgramGroupingTable>;
export type NewProgramGrouping = MarkRequiredNotNull<
  Insertable<ProgramGroupingTable>,
  'canonicalId' | 'libraryId'
>;
export type ProgramGroupingUpdate = Updateable<ProgramGroupingTable>;

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

export const AllProgramGroupingFields: ProgramGroupingFields =
  ProgramGroupingKeys.map((key) => `programGrouping.${key}` as const);

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
