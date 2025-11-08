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
import type { MarkRequired, StrictOmit } from 'ts-essentials';
import type { MarkNotNilable } from '../../types/util.ts';
import type { MediaSourceId, MediaSourceName } from './base.ts';
import { ProgramExternalIdSourceTypes } from './base.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSource } from './MediaSource.ts';
import { Program } from './Program.ts';

export const ProgramExternalId = sqliteTable(
  'program_external_id',
  {
    uuid: text().primaryKey(),
    createdAt: integer(),
    updatedAt: integer(),
    directFilePath: text(),
    externalFilePath: text(),
    externalKey: text().notNull(),
    externalSourceId: text().$type<MediaSourceName>(),
    mediaSourceId: text()
      .references(() => MediaSource.uuid, {
        onDelete: 'cascade',
      })
      .$type<MediaSourceId>(),
    programUuid: text()
      .notNull()
      .references(() => Program.uuid, { onDelete: 'cascade' }),
    sourceType: text({ enum: ProgramExternalIdSourceTypes }).notNull(),
  },
  (table) => [
    index('program_external_id_program_uuid_index').on(table.programUuid),
    uniqueIndex('unique_program_multiple_external_id')
      .on(table.programUuid, table.sourceType, table.externalSourceId)
      .where(sql`\`external_source_id\` is not null`),
    uniqueIndex('unique_program_single_external_id')
      .on(table.programUuid, table.sourceType)
      .where(sql`\`external_source_id\` is null`),
    uniqueIndex('unique_program_multiple_external_id_media_source')
      .on(table.programUuid, table.sourceType, table.mediaSourceId)
      .where(sql`\`media_source_id\` is not null`),
    uniqueIndex('unique_program_single_external_id_media_source')
      .on(table.programUuid, table.sourceType)
      .where(sql`\`media_source_id\` is null`),
    check(
      'source_type',
      inArray(table.sourceType, table.sourceType.enumValues).inlineParams(),
    ),
  ],
);

export const ProgramExternalIdRelations = relations(
  ProgramExternalId,
  ({ one }) => ({
    program: one(Program, {
      fields: [ProgramExternalId.programUuid],
      references: [Program.uuid],
    }),
    mediaSource: one(MediaSource, {
      fields: [ProgramExternalId.mediaSourceId],
      references: [MediaSource.uuid],
    }),
  }),
);

export type ProgramExternalIdTable = KyselifyBetter<typeof ProgramExternalId>;
export type ProgramExternalId = Selectable<ProgramExternalIdTable>;
export type NewProgramExternalId = Insertable<ProgramExternalIdTable>;
export type NewSingleOrMultiExternalId =
  | (StrictOmit<
      Insertable<ProgramExternalIdTable>,
      'mediaSourceId' | 'externalSourceId'
    > & { type: 'single' })
  | (MarkNotNilable<
      Insertable<ProgramExternalIdTable>,
      'mediaSourceId' | 'externalSourceId'
    > & { type: 'multi' });

export function toInsertableProgramExternalId(
  extraInfo: NewSingleOrMultiExternalId,
): NewProgramExternalId {
  return omit(extraInfo, 'type') satisfies Omit<
    NewSingleOrMultiExternalId,
    'type'
  >;
}

export type ProgramExternalIdOrm = InferSelectModel<typeof ProgramExternalId>;

export type MinimalProgramExternalId = MarkRequired<
  Partial<ProgramExternalId>,
  'sourceType' | 'externalKey' | 'externalSourceId'
>;

export type ProgramExternalIdFields<
  Alias extends string = 'programExternalId',
> = readonly `${Alias}.${keyof ProgramExternalId}`[];

export const ProgramExternalIdKeys: (keyof ProgramExternalId)[] = [
  // 'createdAt',
  'directFilePath',
  'externalFilePath',
  'externalKey',
  'externalSourceId',
  'programUuid',
  'sourceType',
  'mediaSourceId',
  // 'updatedAt',
  'uuid',
];

export const ProgramExternalIdTableName = 'programExternalId';

export const ProgramExternalIdFieldsWithAlias = <Alias extends string>(
  keys: (keyof ProgramExternalId)[],
  alias: Alias,
): ProgramExternalIdFields<Alias> =>
  keys.map((key) => `${alias}.${key}` as const);

export const AllProgramExternalIdFields: ProgramExternalIdFields =
  ProgramExternalIdKeys.map((key) => `programExternalId.${key}` as const);

export const MinimalProgramExternalIdFields: ProgramExternalIdFields = [
  'programExternalId.sourceType',
  'programExternalId.externalKey',
  'programExternalId.externalSourceId',
];

export const AllProgramExternalIdFieldsAliased = <Alias extends string>(
  alias: Alias,
): ProgramExternalIdFields<Alias> =>
  ProgramExternalIdKeys.map((key) => `${alias}.${key}` as const);
