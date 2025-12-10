import type { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
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
import type {
  ProgramExternalIdSourceType,
  ProgramState,
  RemoteSourceType,
} from '@/db/schema/base.js';
import type {
  MusicAlbumOrm,
  NewProgramGroupingWithRelations,
  NewProgramVersion,
  NewProgramWithRelations,
  ProgramGroupingOrmWithRelations,
  ProgramGroupingWithExternalIds,
  ProgramWithExternalIds,
  ProgramWithRelations,
  ProgramWithRelationsOrm,
  TvSeasonOrm,
} from '@/db/schema/derivedTypes.js';
import type {
  MarkNonNullable,
  Maybe,
  Nullable,
  PagedResult,
} from '@/types/util.js';
import type { ChannelProgram } from '@tunarr/types';
import type {
  Dictionary,
  MarkOptional,
  MarkRequired,
  StrictExclude,
} from 'ts-essentials';
import type { NewArtwork } from '../schema/Artwork.ts';
import type { RemoteMediaSourceType } from '../schema/MediaSource.ts';
import type { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { MediaSourceId, MediaSourceType } from '../schema/base.js';
import type { PageParams } from './IChannelDB.ts';

export interface IProgramDB {
  // TODO: Allow null narrowing on mediaSourceId
  getProgramById(
    id: string,
  ): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>>;

  getProgramExternalIds(
    id: string,
    externalIdTypes?: ProgramExternalIdType[],
  ): Promise<ProgramExternalId[]>;

  getShowIdFromTitle(title: string): Promise<Maybe<string>>;

  updateProgramDuration(programId: string, duration: number): Promise<void>;

  getProgramsByIds(
    ids: string[] | readonly string[],
    batchSize?: number,
  ): Promise<ProgramWithRelationsOrm[]>;

  getProgramGrouping(
    id: string,
  ): Promise<Maybe<ProgramGroupingOrmWithRelations>>;

  getProgramGroupings(
    ids: string[],
  ): Promise<Record<string, ProgramGroupingOrmWithRelations>>;

  getProgramGroupingByExternalId(
    eid: ProgramGroupingExternalIdLookup,
  ): Promise<Maybe<ProgramGroupingOrmWithRelations>>;

  getProgramParent(
    programId: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>>;

  getChildren(
    parentId: string,
    parentType: 'season' | 'album',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<ProgramWithRelationsOrm>>;
  getChildren(
    parentId: string,
    parentType: 'artist',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<MusicAlbumOrm>>;
  getChildren(
    parentId: string,
    parentType: 'show',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<TvSeasonOrm>>;
  getChildren(
    parentId: string,
    parentType: 'artist' | 'show',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<ProgramGroupingOrmWithRelations>>;
  getChildren(
    parentId: string,
    parentType: ProgramGroupingType,
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<
    | PagedResult<ProgramWithRelationsOrm>
    | PagedResult<ProgramGroupingOrmWithRelations>
  >;

  lookupByExternalId(eid: {
    sourceType: RemoteSourceType;
    externalSourceId: string;
    externalKey: string;
  }): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>>;

  lookupByExternalIds(
    ids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize?: number,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]>;

  lookupByMediaSource(
    sourceType: RemoteMediaSourceType,
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
    program: NewProgramWithRelations,
  ): Promise<ProgramWithExternalIds>;
  upsertPrograms(
    programs: NewProgramWithRelations | NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds[]>;
  upsertPrograms(
    programs: NewProgramWithRelations | NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<NewProgramWithRelations | ProgramWithExternalIds[]>;

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

  getProgramInfoForMediaSource(
    mediaSourceId: MediaSourceId,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>>;

  getProgramInfoForMediaSourceLibrary(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>>;

  getProgramInfoForMediaSourceLibraryAsync(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): AsyncGenerator<ProgramCanonicalIdLookupResult>;

  /**
   * Returns a mapping of external ID (relative to the given media source)
   * to existing details about the item in our DB, namely the canonical ID.
   * @param mediaSourceLibraryId
   * @param type
   * @param sourceType
   */
  getExistingProgramGroupingDetails(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: StrictExclude<MediaSourceType, 'local'>,
    parentFilter?: string,
  ): Promise<Dictionary<ProgramGroupingCanonicalIdLookupResult>>;

  upsertProgramGrouping(
    newGroupingAndRelations: NewProgramGroupingWithRelations,
    forceUpdate?: boolean,
  ): Promise<UpsertResult<ProgramGroupingOrmWithRelations>>;

  getProgramGroupingChildCounts(
    groupIds: string[],
  ): Promise<Record<string, ProgramGroupingChildCounts>>;

  getProgramGroupingDescendants(
    groupId: string,
    groupTypeHint?: ProgramGroupingType,
  ): Promise<ProgramWithRelationsOrm[]>;

  updateProgramsState(
    programIds: string[],
    newState: ProgramState,
  ): Promise<void>;

  updateGroupingsState(
    groupingIds: string[],
    newState: ProgramState,
  ): Promise<void>;

  emptyTrashPrograms(): Promise<void>;
}

export type WithChannelIdFilter<T> = T & {
  channelId?: string;
};

export type ProgramCanonicalIdLookupResult = {
  uuid: string;
  // Pre-alpha programs will not have this on first run
  canonicalId: Nullable<string>;
  // Pre-alpha programs will not have this on first run
  libraryId: Nullable<string>;
  externalKey: string;
};

export type ProgramGroupingCanonicalIdLookupResult = {
  uuid: string;
  canonicalId: Nullable<string>;
  libraryId: string;
  externalKey: string;
};

export type ProgramGroupingExternalIdLookup = {
  sourceType: ProgramExternalIdSourceType;
  externalKey: string;
  externalSourceId: MediaSourceId;
};

export type UpsertResult<Entity> = {
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
  artwork?: NewArtwork[];
};
