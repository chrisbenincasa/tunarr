import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSource } from '../../db/schema/MediaSource.ts';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { KEYS } from '../../types/inject.ts';
import { JellyfinMovie } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { EntityMutex } from '../EntityMutex.ts';
import { MeilisearchService } from '../SearchService.ts';
import { MediaSourceMovieLibraryScanner } from './MediaSourceMovieLibraryScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class JellyfinMediaSourceMovieScanner extends MediaSourceMovieLibraryScanner<
  'jellyfin',
  JellyfinApiClient,
  JellyfinMovie
> {
  readonly mediaSourceType = 'jellyfin';

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

  protected getApiClient(mediaSource: MediaSource): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getLibraryContents(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinMovie> {
    return context.apiClient.getMovieLibraryContents(libraryKey);
  }

  protected async scanMovie(
    { apiClient, mediaSource, library }: ScanContext<JellyfinApiClient>,
    apiMovie: JellyfinMovie,
  ): Promise<Result<JellyfinMovie>> {
    const fullMetadataResult = await apiClient.getMovie(apiMovie.externalKey);

    if (fullMetadataResult.isFailure()) {
      throw fullMetadataResult.error;
    }

    return fullMetadataResult.map((fullMovie) => {
      if (!fullMovie) {
        throw new Error(`Movie (ID = ${apiMovie.externalKey}) not found`);
      }

      return fullMovie;
    });
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey)
      .then((_) => _.getOrThrow());
  }

  protected getCanonicalId(entity: JellyfinMovie): string {
    return entity.canonicalId;
  }

  protected getExternalKey(entity: JellyfinMovie): string {
    return entity.externalKey;
  }
}
