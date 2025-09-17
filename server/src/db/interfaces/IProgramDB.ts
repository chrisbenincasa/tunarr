import type { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import type {
  NewProgramDao,
  ProgramDao,
  ProgramType,
} from '@/db/schema/Program.js';
import type {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
} from '@/db/schema/ProgramExternalId.js';
import type { ProgramExternalIdSourceType } from '@/db/schema/base.js';
import type {
  MusicAlbumWithExternalIds,
  NewProgramGroupingWithExternalIds,
  NewProgramVersion,
  ProgramGroupingWithExternalIds,
  ProgramWithExternalIds,
  ProgramWithRelations,
  TvSeasonWithExternalIds,
} from '@/db/schema/derivedTypes.js';
import type { MarkNonNullable, Maybe, PagedResult } from '@/types/util.js';
import type { ChannelProgram } from '@tunarr/types';
import type { Dictionary, MarkOptional } from 'ts-essentials';
import type { MediaSourceType } from '../schema/MediaSource.ts';
import type { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { MediaSourceId } from '../schema/base.ts';
import type { PageParams } from './IChannelDB.ts';

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
    batchSize?: number,
  ): Promise<ProgramWithRelations[]>;

  getProgramGrouping(
    id: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>>;

  getProgramGroupings(
    ids: string[],
  ): Promise<Record<string, ProgramGroupingWithExternalIds>>;

  getProgramGroupingByExternalId(
    eid: ProgramGroupingExternalIdLookup,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>>;

  getProgramParent(
    programId: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>>;

  getChildren(
    parentId: string,
    parentType: 'season' | 'album',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<ProgramWithExternalIds>>;
  getChildren(
    parentId: string,
    parentType: 'artist',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<MusicAlbumWithExternalIds>>;
  getChildren(
    parentId: string,
    parentType: 'show',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<TvSeasonWithExternalIds>>;
  getChildren(
    parentId: string,
    parentType: ProgramGroupingType,
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<
    PagedResult<ProgramWithExternalIds | ProgramGroupingWithExternalIds>
  >;

  lookupByExternalId(eid: {
    sourceType: ProgramSourceType;
    externalSourceId: string;
    externalKey: string;
  }): Promise<Maybe<ProgramWithRelations>>;

  lookupByExternalIds(
    ids:
      | Set<[string, MediaSourceId, string]>
      | Set<readonly [string, MediaSourceId, string]>,
    chunkSize?: number,
  ): Promise<ProgramWithRelations[]>;

  lookupByMediaSource(
    sourceType: MediaSourceType,
    sourceId: MediaSourceId,
    mediaType?: ProgramType,
    chunkSize?: number,
  ): Promise<ProgramDao[]>;

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
  ): Promise<MarkNonNullable<ProgramDao, 'mediaSourceId'>[]>;

  upsertPrograms(
    programs: ProgramUpsertRequest[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds[]>;

  programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize?: number,
  ): Promise<Record<`${string}|${string}|${string}`, string>>;

  upsertProgramExternalIds(
    externalIds: NewSingleOrMultiExternalId[],
    chunkSize?: number,
  ): Promise<Dictionary<ProgramExternalId[]>>;

  getProgramsForMediaSource(
    mediaSourceId: string,
    type?: ProgramType,
  ): Promise<ProgramDao[]>;

  getMediaSourceLibraryPrograms(
    libraryId: string,
  ): Promise<ProgramWithRelations[]>;

  getProgramCanonicalIdsForMediaSource(
    mediaSourceLibraryId: string,
    type: ProgramType,
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>>;

  getProgramGroupingCanonicalIds(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: MediaSourceType,
  ): Promise<Dictionary<ProgramGroupingCanonicalIdLookupResult>>;

  getOrInsertProgramGrouping(
    dao: NewProgramGroupingWithExternalIds,
    externalId: ProgramGroupingExternalIdLookup,
    forceUpdate?: boolean,
  ): Promise<GetOrInsertResult<ProgramGroupingWithExternalIds>>;

  getShowSeasons(showUuid: string): Promise<ProgramGroupingWithExternalIds[]>;

  getArtistAlbums(
    artistUuid: string,
  ): Promise<ProgramGroupingWithExternalIds[]>;

  getProgramGroupingChildCounts(
    groupIds: string[],
  ): Promise<Record<string, ProgramGroupingChildCounts>>;

  getProgramGroupingDescendants(
    groupId: string,
    groupTypeHint?: ProgramGroupingType,
  ): Promise<ProgramWithExternalIds[]>;
}

export type WithChannelIdFilter<T> = T & {
  channelId?: string;
};

export type ProgramCanonicalIdLookupResult = {
  uuid: string;
  canonicalId: string;
  libraryId: string;
  externalKey: string;
};

export type ProgramGroupingCanonicalIdLookupResult = {
  uuid: string;
  canonicalId: string;
  libraryId: string;
};

export type ProgramGroupingExternalIdLookup = {
  sourceType: ProgramExternalIdSourceType;
  externalKey: string;
  externalSourceId: MediaSourceId;
};

export type GetOrInsertResult<Entity> = {
  wasInserted: boolean;
  wasUpdated: boolean;
  entity: Entity;
};

export type ProgramGroupingChildCounts = {
  type: ProgramGroupingType;
  childCount?: number;
  grandchildCount?: number;
};

export type ProgramUpsertRequest = {
  program: NewProgramDao;
  externalIds: NewSingleOrMultiExternalId[];
  versions: NewProgramVersion[];
};
