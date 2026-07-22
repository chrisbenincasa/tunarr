import type {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
  ProgramGroupingCanonicalIdLookupResult,
  ProgramGroupingChildCounts,
  ProgramGroupingExternalIdLookup,
  UpsertResult,
  WithChannelIdFilter,
} from '@/db/interfaces/IProgramDB.js';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe, PagedResult } from '@/types/util.js';
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
  ProgramOrmWithExternalIds,
  ProgramWithExternalIds,
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
    @inject(KEYS.ChannelDB) private readonly channelDB: IChannelDB,
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

  clearExtractedSubtitle(uuid: string): Promise<void> {
    return this.metadataRepo.clearExtractedSubtitle(uuid);
  }

  getProgramsByIds(
    ids: string[] | readonly string[],
    batchSize?: number,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
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

  lookupProgramByPlexGuid(
    plexGuid: string,
  ): Promise<Maybe<ProgramCanonicalIdLookupResult>> {
    return this.externalIdRepo.lookupProgramSummaryByPlexGuid(plexGuid);
  }

  async reconcilePlexRatingKeyChange(args: {
    programUuid: string;
    mediaSourceId: MediaSourceId;
    newRatingKey: string;
    directFilePath?: string | null;
    externalFilePath?: string | null;
  }): Promise<void> {
    const duplicateProgramUuid =
      await this.basicProg.findProgramUuidByMediaSourceExternalKey(
        args.mediaSourceId,
        'plex',
        args.newRatingKey,
        args.programUuid,
      );

    await this.basicProg.updateProgramExternalKey(
      args.programUuid,
      args.newRatingKey,
    );

    await this.externalIdRepo.updateProgramPlexRatingKey(
      args.programUuid,
      args.mediaSourceId,
      {
        externalKey: args.newRatingKey,
        directFilePath: args.directFilePath ?? undefined,
        externalFilePath: args.externalFilePath ?? undefined,
      },
    );

    if (duplicateProgramUuid) {
      await this.channelDB.replaceProgramUuidInAllLineups(
        duplicateProgramUuid,
        args.programUuid,
      );
      await this.stateRepo.updateProgramsState([duplicateProgramUuid], 'missing');
    }
  }

  lookupByExternalIds(
    ids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize?: number,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
    return this.externalIdRepo.lookupByExternalIds(ids, chunkSize);
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
      plexServerName as MediaSourceId,
      details,
    );
  }

  replaceProgramExternalId(
    programId: string,
    newExternalId: NewProgramExternalId,
    oldExternalId?: MinimalProgramExternalId,
  ): Promise<void> {
    this.externalIdRepo.replaceProgramExternalId(
      programId,
      newExternalId,
      oldExternalId,
    );
    return Promise.resolve();
  }

  upsertProgramExternalIds(
    externalIds: NewSingleOrMultiExternalId[],
    chunkSize?: number,
  ): Promise<Dictionary<ProgramExternalId[]>> {
    return Promise.resolve(
      this.externalIdRepo.upsertProgramExternalIds(externalIds, chunkSize),
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

  upsertArtwork(artwork: NewArtwork[]): void {
    this.metadataRepo.upsertArtwork(artwork);
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
  ): Promise<ProgramOrmWithExternalIds[]> {
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
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
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
