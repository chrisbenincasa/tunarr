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
import { type KyselifyBetter } from './KyselifyBetter.ts';

export const ProgramGroupingType: Readonly<
  Record<Capitalize<ProgramGroupingType>, ProgramGroupingType>
> = {
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
    createdAt: integer(),
    updatedAt: integer(),
    artistUuid: text().references((): AnySQLiteColumn => ProgramGrouping.uuid),
    icon: text(),
    index: integer(),
    showUuid: text().references((): AnySQLiteColumn => ProgramGrouping.uuid),
    summary: text(),
    title: text().notNull(),
    type: text({ enum: ProgramGroupingTypes }).notNull(),
    year: integer(),
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
export type NewProgramGrouping = Insertable<ProgramGroupingTable>;
export type ProgramGroupingUpdate = Updateable<ProgramGroupingTable>;
