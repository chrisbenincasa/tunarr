import type { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import type { ProgramDao } from '@/db/schema/Program.js';
import type {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
} from '@/db/schema/ProgramExternalId.js';
import type { ProgramExternalIdSourceType } from '@/db/schema/base.js';
import type {
  ProgramGroupingWithExternalIds,
  ProgramWithExternalIds,
  ProgramWithRelations,
} from '@/db/schema/derivedTypes.js';
import type { Maybe } from '@/types/util.js';
import type { ChannelProgram, ContentProgram } from '@tunarr/types';
import type { MarkOptional } from 'ts-essentials';

export interface IProgramDB {
  getProgramById(id: string): Promise<Maybe<ProgramWithExternalIds>>;

  getProgramExternalIds(
    id: string,
    externalIdTypes?: ProgramExternalIdType[],
  ): Promise<ProgramExternalId[]>;

  getShowIdFromTitle(title: string): Promise<Maybe<string>>;

  updateProgramDuration(programId: string, duration: number): Promise<void>;

  getProgramsByIds(
    ids: string[],
    batchSize: number,
  ): Promise<ProgramWithRelations[]>;

  getProgramGrouping(
    id: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>>;

  getProgramParent(
    programId: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>>;

  lookupByExternalId(eid: {
    sourceType: ProgramSourceType;
    externalSourceId: string;
    externalKey: string;
  }): Promise<Maybe<ContentProgram>>;

  lookupByExternalIds(
    ids: Set<[string, string, string]>,
  ): Promise<Record<string, ContentProgram>>;

  programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number,
  ): Promise<
    Record<`${ProgramExternalIdSourceType}.${string}.${string}`, string>
  >;

  updateProgramPlexRatingKey(
    programId: string,
    plexServerName: string,
    details: MarkOptional<
      Pick<
        ProgramExternalId,
        'externalKey' | 'directFilePath' | 'externalFilePath'
      >,
      'directFilePath' | 'externalFilePath'
    >,
  ): Promise<ProgramExternalId>;

  replaceProgramExternalId(
    programId: string,
    newExternalId: NewProgramExternalId,
    oldExternalId?: MinimalProgramExternalId,
  ): Promise<void>;

  upsertContentPrograms(
    programs: ChannelProgram[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramDao[]>;

  programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize?: number,
  ): Promise<Record<`${string}|${string}|${string}`, string>>;

  upsertProgramExternalIds(
    externalIds: NewSingleOrMultiExternalId[],
    chunkSize?: number,
  ): Promise<void>;
}
