import { Insertable, Selectable } from 'kysely';
import { MarkRequired } from 'ts-essentials';
import {
  ProgramExternalIdSourceType,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from './base';

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
