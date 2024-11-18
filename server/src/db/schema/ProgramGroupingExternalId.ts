import { Insertable, Selectable } from 'kysely';
import {
  ProgramExternalIdSourceType,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from './base.ts';

export interface ProgramGroupingExternalIdTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  externalFilePath: string | null;
  externalKey: string;
  externalSourceId: string | null;
  groupUuid: string;
  sourceType: ProgramExternalIdSourceType;
}

export type ProgramGroupingExternalId =
  Selectable<ProgramGroupingExternalIdTable>;
export type NewProgramGroupingExternalId =
  Insertable<ProgramGroupingExternalIdTable>;

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
