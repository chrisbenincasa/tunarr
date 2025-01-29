import type { Insertable, Selectable } from 'kysely';
import type { MarkRequired } from 'ts-essentials';
import type {
  ProgramExternalIdSourceType,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from './base.ts';

export interface ProgramExternalIdTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  directFilePath: string | null;
  externalFilePath: string | null;
  externalKey: string;
  externalSourceId: string | null;
  programUuid: string;
  sourceType: ProgramExternalIdSourceType;
}

export type ProgramExternalId = Selectable<ProgramExternalIdTable>;
export type NewProgramExternalId = Insertable<ProgramExternalIdTable>;

export type MinimalProgramExternalId = MarkRequired<
  Partial<ProgramExternalId>,
  'sourceType' | 'externalKey' | 'externalSourceId'
>;

export type ProgramExternalIdFields<
  Alias extends string = 'programExternalId',
> = readonly `${Alias}.${keyof ProgramExternalId}`[];

export const ProgramExternalIdKeys: (keyof ProgramExternalId)[] = [
  'createdAt',
  'directFilePath',
  'externalFilePath',
  'externalKey',
  'externalSourceId',
  'programUuid',
  'sourceType',
  'updatedAt',
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
