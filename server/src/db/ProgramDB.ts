import type {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
  ProgramGroupingCanonicalIdLookupResult,
  ProgramGroupingChildCounts,
  ProgramGroupingExternalIdLookup,
  UpsertResult,
  WithChannelIdFilter,
} from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import type { MarkNonNullable, Maybe, PagedResult } from '@/types/util.js';
import type { ChannelProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import type {
  Dictionary,
  MarkOptional,
  MarkRequired,
  StrictExclude,
} from 'ts-essentials';
import type { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.js';
import type { PageParams } from './interfaces/IChannelDB.js';
import { BasicProgramRepository } from './program/BasicProgramRepository.ts';
import { ProgramExternalIdRepository } from './program/ProgramExternalIdRepository.ts';
import { ProgramGroupingRepository } from './program/ProgramGroupingRepository.ts';
import { ProgramGroupingUpsertRepository } from './program/ProgramGroupingUpsertRepository.ts';
import { ProgramMetadataRepository } from './program/ProgramMetadataRepository.ts';
import { ProgramSearchRepository } from './program/ProgramSearchRepository.ts';
import { ProgramStateRepository } from './program/ProgramStateRepository.ts';
import { ProgramUpsertRepository } from './program/ProgramUpsertRepository.ts';
import type { NewArtwork } from './schema/Artwork.js';
import type { NewGenre } from './schema/Genre.js';
import type { RemoteMediaSourceType } from './schema/MediaSource.js';
import type { ProgramDao, ProgramType } from './schema/Program.js';
import type {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
} from './schema/ProgramExternalId.js';
import type { ProgramGroupingType } from './schema/ProgramGrouping.js';
import type {
  MediaSourceId,
  MediaSourceType,
  ProgramExternalIdSourceType,
  ProgramState,
  RemoteSourceType,
} from './schema/base.js';
import type {
  MusicAlbumOrm,
  NewProgramGroupingWithRelations,
  NewProgramWithRelations,
  ProgramGroupingOrmWithRelations,
  ProgramGroupingWithExternalIds,
  ProgramWithExternalIds,
  ProgramWithRelations,
  ProgramWithRelationsOrm,
  TvSeasonOrm,
} from './schema/derivedTypes.js';

@injectable()
export class ProgramDB implements IProgramDB {
  constructor(
    @inject(KEYS.BasicProgramRepository)
    private readonly basicProg: BasicProgramRepository,
    @inject(KEYS.ProgramGroupingRepository)
    private readonly progGrouping: ProgramGroupingRepository,
    @inject(KEYS.ProgramExternalIdRepository)
    private readonly externalIdRepo: ProgramExternalIdRepository,
    @inject(KEYS.ProgramUpsertRepository)
    private readonly upsertRepo: ProgramUpsertRepository,
    @inject(KEYS.ProgramMetadataRepository)
    private readonly metadataRepo: ProgramMetadataRepository,
    @inject(KEYS.ProgramGroupingUpsertRepository)
    private readonly groupingUpsertRepo: ProgramGroupingUpsertRepository,
    @inject(KEYS.ProgramSearchRepository)
    private readonly searchRepo: ProgramSearchRepository,
    @inject(KEYS.ProgramStateRepository)
    private readonly stateRepo: ProgramStateRepository,
  ) {}

  getProgramById(
    id: string,
  ): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>> {
    return this.basicProg.getProgramById(id);
  }

  getProgramExternalIds(
    id: string,
    externalIdTypes?: ProgramExternalIdType[],
  ): Promise<ProgramExternalId[]> {
    return this.basicProg.getProgramExternalIds(id, externalIdTypes);
  }

  getShowIdFromTitle(title: string): Promise<Maybe<string>> {
    return this.basicProg.getShowIdFromTitle(title);
  }

  updateProgramDuration(programId: string, duration: number): Promise<void> {
    return this.basicProg.updateProgramDuration(programId, duration);
  }

  getProgramsByIds(
    ids: string[] | readonly string[],
    batchSize?: number,
  ): Promise<ProgramWithRelationsOrm[]> {
    return this.basicProg.getProgramsByIds(ids, batchSize);
  }

  getProgramGrouping(
    id: string,
  ): Promise<Maybe<ProgramGroupingOrmWithRelations>> {
    return this.progGrouping.getProgramGrouping(id);
  }

  getProgramGroupings(
    ids: string[],
  ): Promise<Record<string, ProgramGroupingOrmWithRelations>> {
    return this.progGrouping.getProgramGroupings(ids);
  }

  getProgramGroupingByExternalId(
    eid: ProgramGroupingExternalIdLookup,
  ): Promise<Maybe<ProgramGroupingOrmWithRelations>> {
    return this.progGrouping.getProgramGroupingByExternalId(eid);
  }

  getProgramGroupingsByExternalIds(
    eids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize?: number,
  ): Promise<ProgramGroupingOrmWithRelations[]> {
    return this.progGrouping.getProgramGroupingsByExternalIds(eids, chunkSize);
  }

  getProgramParent(
    programId: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>> {
    return this.progGrouping.getProgramParent(programId);
  }

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
  > {
    return this.progGrouping.getChildren(
      parentId,
      parentType as 'season' | 'album',
      params,
    );
  }

  lookupByExternalId(eid: {
    sourceType: RemoteSourceType;
    externalSourceId: string;
    externalKey: string;
  }): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>> {
    return this.externalIdRepo.lookupByExternalId(
      eid as Parameters<typeof this.externalIdRepo.lookupByExternalId>[0],
    );
  }

  lookupByExternalIds(
    ids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize?: number,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
    return this.externalIdRepo.lookupByExternalIds(ids, chunkSize);
  }

  lookupByMediaSource(
    sourceType: RemoteMediaSourceType,
    sourceId: MediaSourceId,
    mediaType?: ProgramType,
    chunkSize?: number,
  ): Promise<ProgramDao[]> {
    return this.externalIdRepo.lookupByMediaSource(
      sourceType,
      sourceId,
      mediaType,
      chunkSize,
    );
  }

  programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize?: number,
  ): Promise<
    Record<`${ProgramExternalIdSourceType}.${string}.${string}`, string>
  > {
    return this.externalIdRepo.programIdsByExternalIds(
      ids as Set<[string, MediaSourceId, string]>,
      chunkSize ?? 50,
    ) as Promise<
      Record<`${ProgramExternalIdSourceType}.${string}.${string}`, string>
    >;
  }

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
  ): Promise<ProgramExternalId> {
    return this.externalIdRepo.updateProgramPlexRatingKey(
      programId,
      plexServerName as import('./schema/base.js').MediaSourceId,
      details,
    );
  }

  replaceProgramExternalId(
    programId: string,
    newExternalId: NewProgramExternalId,
    oldExternalId?: MinimalProgramExternalId,
  ): Promise<void> {
    return this.externalIdRepo.replaceProgramExternalId(
      programId,
      newExternalId,
      oldExternalId,
    );
  }

  upsertProgramExternalIds(
    externalIds: NewSingleOrMultiExternalId[],
    chunkSize?: number,
  ): Promise<Dictionary<ProgramExternalId[]>> {
    return this.externalIdRepo.upsertProgramExternalIds(externalIds, chunkSize);
  }

  upsertContentPrograms(
    programs: ChannelProgram[],
    programUpsertBatchSize?: number,
  ): Promise<MarkNonNullable<ProgramDao, 'mediaSourceId'>[]> {
    return this.upsertRepo.upsertContentPrograms(
      programs,
      programUpsertBatchSize,
    );
  }

  upsertPrograms(
    request: NewProgramWithRelations,
  ): Promise<ProgramWithExternalIds>;
  upsertPrograms(
    programs: NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds[]>;
  upsertPrograms(
    programs: NewProgramWithRelations | NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds | ProgramWithExternalIds[]> {
    if (Array.isArray(programs)) {
      return this.upsertRepo.upsertPrograms(programs, programUpsertBatchSize);
    } else {
      return this.upsertRepo.upsertPrograms(programs);
    }
  }

  upsertArtwork(artwork: NewArtwork[]): Promise<void> {
    return this.metadataRepo.upsertArtwork(artwork).then(() => {});
  }

  upsertProgramGroupingGenres(
    groupingId: string,
    genres: NewGenre[],
  ): Promise<void> {
    return this.metadataRepo
      .upsertProgramGroupingGenres(groupingId, genres)
      .then(() => {});
  }

  getProgramsForMediaSource(
    mediaSourceId: string,
    type?: ProgramType,
  ): Promise<ProgramDao[]> {
    return this.searchRepo.getProgramsForMediaSource(
      mediaSourceId as unknown as MediaSourceId,
      type,
    );
  }

  getMediaSourceLibraryPrograms(
    libraryId: string,
  ): Promise<ProgramWithRelations[]> {
    return this.searchRepo.getMediaSourceLibraryPrograms(libraryId);
  }

  getProgramInfoForMediaSource(
    mediaSourceId: MediaSourceId,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>> {
    return this.searchRepo.getProgramInfoForMediaSource(
      mediaSourceId,
      type,
      parentFilter,
    );
  }

  getProgramInfoForMediaSourceLibrary(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>> {
    return this.searchRepo.getProgramInfoForMediaSourceLibrary(
      mediaSourceLibraryId,
      type,
      parentFilter,
    );
  }

  getProgramInfoForMediaSourceLibraryAsync(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): AsyncGenerator<ProgramCanonicalIdLookupResult> {
    return this.searchRepo.getProgramInfoForMediaSourceLibraryAsync(
      mediaSourceLibraryId,
      type,
      parentFilter,
    );
  }

  getExistingProgramGroupingDetails(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: StrictExclude<MediaSourceType, 'local'>,
    parentFilter?: string,
  ): Promise<Dictionary<ProgramGroupingCanonicalIdLookupResult>> {
    return this.searchRepo.getExistingProgramGroupingDetails(
      mediaSourceLibraryId,
      type,
      sourceType,
      parentFilter,
    );
  }

  upsertProgramGrouping(
    newGroupingAndRelations: NewProgramGroupingWithRelations,
    forceUpdate?: boolean,
  ): Promise<UpsertResult<ProgramGroupingOrmWithRelations>> {
    return this.groupingUpsertRepo.upsertProgramGrouping(
      newGroupingAndRelations,
      forceUpdate,
    );
  }

  getProgramGroupingChildCounts(
    groupIds: string[],
  ): Promise<Record<string, ProgramGroupingChildCounts>> {
    return this.progGrouping.getProgramGroupingChildCounts(groupIds);
  }

  getProgramGroupingDescendants(
    groupId: string,
    groupTypeHint?: ProgramGroupingType,
  ): Promise<ProgramWithRelationsOrm[]> {
    return this.progGrouping.getProgramGroupingDescendants(
      groupId,
      groupTypeHint,
    );
  }

  updateProgramsState(
    programIds: string[],
    newState: ProgramState,
  ): Promise<void> {
    return this.stateRepo.updateProgramsState(programIds, newState);
  }

  updateGroupingsState(
    groupingIds: string[],
    newState: ProgramState,
  ): Promise<void> {
    return this.stateRepo.updateGroupingsState(groupingIds, newState);
  }

  emptyTrashPrograms(): Promise<void> {
    return this.stateRepo.emptyTrashPrograms();
  }
}
