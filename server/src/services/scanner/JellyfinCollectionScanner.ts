import type { Collection, ProgramOrFolder } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { ExternalCollectionRepo } from '../../db/ExternalCollectionRepo.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteSourceType } from '../../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { TagRepo } from '../../db/TagRepo.ts';
import type { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { KEYS } from '../../types/inject.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { ExternalCollectionScanner } from './ExternalCollectionScanner.ts';

@injectable()
export class JellyfinCollectionScanner extends ExternalCollectionScanner<JellyfinApiClient> {
  get sourceType(): RemoteSourceType {
    return 'jellyfin';
  }

  @InjectLogger() declare readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(MediaSourceApiFactory)
    mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(ExternalCollectionRepo)
    externalCollectionsRepo: ExternalCollectionRepo,
    @inject(MeilisearchService)
    searchService: MeilisearchService,
    @inject(KEYS.ProgramDB)
    programDB: IProgramDB,
    @inject(TagRepo)
    tagRepo: TagRepo,
  ) {
    super(
      mediaSourceDB,
      mediaSourceApiFactory,
      externalCollectionsRepo,
      searchService,
      programDB,
      tagRepo,
    );
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }

  getAllLibraryCollections(
    apiClient: JellyfinApiClient,
    libraryExternalKey: string,
  ): AsyncIterable<Collection> {
    return apiClient.getAllLibraryCollections(libraryExternalKey);
  }

  getCollectionItems(
    apiClient: JellyfinApiClient,
    _libraryId: string,
    collectionId: string,
  ): AsyncIterable<ProgramOrFolder> {
    return apiClient.getCollectionItems(collectionId);
  }
}
