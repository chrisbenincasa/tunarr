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
