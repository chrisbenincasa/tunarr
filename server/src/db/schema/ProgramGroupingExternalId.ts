import { inArray } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { ProgramExternalIdSourceTypes } from './base.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const ProgramGroupingExternalId = sqliteTable(
  'program_grouping_external_id',
  {
    uuid: text().primaryKey(),
    createdAt: integer(),
    updatedAt: integer(),
    externalFilePath: text(),
    externalKey: text().notNull(),
    externalSourceId: text(),
    groupUuid: text()
      .notNull()
      .references(() => ProgramGrouping.uuid, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    sourceType: text({ enum: ProgramExternalIdSourceTypes }).notNull(),
  },
  (table) => [
    index('program_grouping_group_uuid_index').on(table.groupUuid),
    check(
      'source_type_check',
      inArray(table.sourceType, table.sourceType.enumValues).inlineParams(),
    ),
  ],
);

export type ProgramGroupingExternalIdTable = KyselifyBetter<
  typeof ProgramGroupingExternalId
>;

export type ProgramGroupingExternalId =
  Selectable<ProgramGroupingExternalIdTable>;
export type NewProgramGroupingExternalId =
  Insertable<ProgramGroupingExternalIdTable>;

export type ProgramGroupingExternalIdFields<
  Alias extends string = 'ProgramGroupingExternalId',
> = readonly `${Alias}.${keyof ProgramGroupingExternalId}`[];

export const ProgramGroupingExternalIdKeys: (keyof ProgramGroupingExternalId)[] =
  [
    // 'createdAt',
    'externalFilePath',
    'externalKey',
    'externalSourceId',
    'sourceType',
    'groupUuid',
    // 'updatedAt',
    'uuid',
  ];

export const ProgramGroupingExternalIdTableName = 'programGroupingExternalId';

export const ProgramGroupingExternalIdFieldsWithAlias = <Alias extends string>(
  keys: (keyof ProgramGroupingExternalId)[],
  alias: Alias,
): ProgramGroupingExternalIdFields<Alias> =>
  keys.map((key) => `${alias}.${key}` as const);

export const AllProgramGroupingExternalIdFields: ProgramGroupingExternalIdFields =
  ProgramGroupingExternalIdKeys.map(
    (key) => `ProgramGroupingExternalId.${key}` as const,
  );

export const MinimalProgramGroupingExternalIdFields: ProgramGroupingExternalIdFields =
  [
    'ProgramGroupingExternalId.sourceType',
    'ProgramGroupingExternalId.externalKey',
    'ProgramGroupingExternalId.externalSourceId',
  ];

export const AllProgramGroupingExternalIdFieldsAliased = <Alias extends string>(
  alias: Alias,
): ProgramGroupingExternalIdFields<Alias> =>
  ProgramGroupingExternalIdKeys.map((key) => `${alias}.${key}` as const);
