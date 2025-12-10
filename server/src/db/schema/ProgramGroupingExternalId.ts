import type { InferSelectModel } from 'drizzle-orm';
import { inArray, relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { omit } from 'lodash-es';
import type { StrictOmit } from 'ts-essentials';
import type { MarkNotNilable } from '../../types/util.ts';
import type { MediaSourceId, MediaSourceName } from './base.ts';
import { ProgramExternalIdSourceTypes } from './base.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSource } from './MediaSource.ts';
import { MediaSourceLibrary } from './MediaSourceLibrary.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const ProgramGroupingExternalId = sqliteTable(
  'program_grouping_external_id',
  {
    uuid: text().primaryKey(),
    createdAt: integer(),
    updatedAt: integer(),
    externalFilePath: text(),
    externalKey: text().notNull(),
    externalSourceId: text().$type<MediaSourceName>(),
    mediaSourceId: text()
      .references(() => MediaSource.uuid, {
        onDelete: 'cascade',
      })
      .$type<MediaSourceId>(),
    groupUuid: text()
      .notNull()
      .references(() => ProgramGrouping.uuid, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    sourceType: text({ enum: ProgramExternalIdSourceTypes }).notNull(),
    libraryId: text().references(() => MediaSourceLibrary.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('program_grouping_group_uuid_index').on(table.groupUuid),
    check(
      'source_type_check',
      inArray(table.sourceType, table.sourceType.enumValues).inlineParams(),
    ),
    uniqueIndex('unique_program_grouping_multiple_external_id_media_source')
      .on(table.groupUuid, table.sourceType, table.mediaSourceId)
      .where(sql`\`media_source_id is not null\``),
    uniqueIndex('unique_program_grouping_single_external_id_media_source')
      .on(table.groupUuid, table.sourceType, table.mediaSourceId)
      .where(sql`\`media_source_id is null\``),
  ],
);

export const ProgramGroupingExternalIdRelations = relations(
  ProgramGroupingExternalId,
  ({ one }) => ({
    grouping: one(ProgramGrouping, {
      fields: [ProgramGroupingExternalId.groupUuid],
      references: [ProgramGrouping.uuid],
    }),
    library: one(MediaSourceLibrary, {
      fields: [ProgramGroupingExternalId.libraryId],
      references: [MediaSourceLibrary.uuid],
    }),
  }),
);

export type ProgramGroupingExternalIdTable = KyselifyBetter<
  typeof ProgramGroupingExternalId
>;

export type ProgramGroupingExternalId =
  Selectable<ProgramGroupingExternalIdTable>;
export type NewProgramGroupingExternalId =
  Insertable<ProgramGroupingExternalIdTable>;
export type NewSingleProgramGroupingExternalId = StrictOmit<
  Insertable<ProgramGroupingExternalIdTable>,
  'externalSourceId' | 'mediaSourceId'
> & { type: 'single' };
export type NewMultiProgramGroupingId = MarkNotNilable<
  Insertable<ProgramGroupingExternalIdTable>,
  'externalSourceId' | 'mediaSourceId'
> & { type: 'multi' };
export type NewSingleOrMultiProgramGroupingExternalId =
  | NewSingleProgramGroupingExternalId
  | NewMultiProgramGroupingId;

export type ProgramGroupingExternalIdOrm = InferSelectModel<
  typeof ProgramGroupingExternalId
>;

export function toInsertableProgramGroupingExternalId(
  eid: NewProgramGroupingExternalId | NewSingleOrMultiProgramGroupingExternalId,
): NewProgramGroupingExternalId {
  return omit(eid, 'type') satisfies NewProgramGroupingExternalId;
}

export type ProgramGroupingExternalIdFields<
  Alias extends string = 'ProgramGroupingExternalId',
> = readonly `${Alias}.${keyof ProgramGroupingExternalId}`[];

export const ProgramGroupingExternalIdKeys: (keyof ProgramGroupingExternalId)[] =
  [
    'createdAt',
    'externalFilePath',
    'externalKey',
    'externalSourceId',
    'sourceType',
    'groupUuid',
    'updatedAt',
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
