import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSource, MediaSourceType } from '../../db/schema/MediaSource.ts';
import { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { KEYS } from '../../types/inject.ts';
import { PlexMovie } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { EntityMutex } from '../EntityMutex.ts';
import { MeilisearchService } from '../SearchService.ts';
import { MediaSourceMovieLibraryScanner } from './MediaSourceMovieLibraryScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class PlexMediaSourceMovieScanner extends MediaSourceMovieLibraryScanner<
  typeof MediaSourceType.Plex,
  PlexApiClient
> {
  readonly mediaSourceType = MediaSourceType.Plex;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(EntityMutex) entityMutex: EntityMutex,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(ProgramConverter) programConverter: ProgramConverter,
  ) {
    super(
      logger,
      mediaSourceDB,
      entityMutex,
      programDB,
      mediaSourceProgressService,
      searchService,
      programConverter,
      programMinterFactory(),
    );
  }

  protected getApiClient(mediaSource: MediaSource): Promise<PlexApiClient> {
    return this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<PlexApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getLibraryCount(libraryKey)
      .then((_) => _.getOrThrow());
  }

  protected getLibraryContents(
    libraryKey: string,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexMovie> {
    return context.apiClient.getMovieLibraryContents(libraryKey);
  }

  protected async scanMovie(
    { apiClient }: ScanContext<PlexApiClient>,
    incomingMovie: PlexMovie,
  ): Promise<Result<PlexMovie>> {
    return apiClient.getMovieMetadata(incomingMovie.externalKey);
  }

  protected getCanonicalId(entity: PlexMovie): string {
    return entity.canonicalId;
  }

  protected getExternalKey(entity: PlexMovie): string {
    return entity.externalKey;
  }
}
