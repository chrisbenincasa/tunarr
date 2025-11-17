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
import type { MarkNonNullable, Maybe, PagedResult } from '@/types/util.js';
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

  getProgramsByIdsOld(
    ids: string[],
    batchSize?: number,
  ): Promise<ProgramWithRelations[]>;

  getProgramGrouping(
    id: string,
  ): Promise<Maybe<ProgramGroupingOrmWithRelations>>;

  getProgramGroupings(
    ids: string[],
  ): Promise<Record<string, ProgramGroupingOrmWithRelations>>;

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
    sourceType: ProgramSourceType;
    externalSourceId: string;
    externalKey: string;
  }): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>>;

  lookupByExternalIds(
    ids:
      | Set<[string, MediaSourceId, string]>
      | Set<readonly [string, MediaSourceId, string]>,
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

  getProgramCanonicalIdsForMediaSource(
    mediaSourceLibraryId: string,
    type: ProgramType,
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>>;

  /**
   * Returns a mapping of external ID (relative to the given media source)
   * to existing details about the item in our DB, namely the canonical ID.
   * @param mediaSourceLibraryId
   * @param type
   * @param sourceType
   */
  getProgramGroupingCanonicalIds(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: StrictExclude<MediaSourceType, 'local'>,
  ): Promise<Dictionary<ProgramGroupingCanonicalIdLookupResult>>;

  upsertProgramGrouping(
    newGroupingAndRelations: NewProgramGroupingWithRelations,
    externalId: ProgramGroupingExternalIdLookup,
    forceUpdate?: boolean,
  ): Promise<UpsertResult<ProgramGroupingWithExternalIds>>;

  upsertLocalProgramGrouping(
    newGroupingAndRelations: NewProgramGroupingWithRelations,
    libraryId: string,
  ): Promise<UpsertResult<ProgramGroupingWithExternalIds>>;

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
  ): Promise<ProgramWithRelationsOrm[]>;
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
