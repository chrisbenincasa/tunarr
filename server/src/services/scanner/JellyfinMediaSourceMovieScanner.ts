import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { KEYS } from '../../types/inject.ts';
import { JellyfinT } from '../../types/internal.ts';
import { JellyfinMovie } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceMovieLibraryScanner } from './MediaSourceMovieLibraryScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class JellyfinMediaSourceMovieScanner extends MediaSourceMovieLibraryScanner<
  JellyfinT,
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
      programDB,
      mediaSourceProgressService,
      searchService,
      programConverter,
      programMinterFactory(),
    );
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
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
    { apiClient }: ScanContext<JellyfinApiClient>,
    apiMovie: JellyfinMovie,
  ): Promise<Result<JellyfinMovie>> {
    const fullMetadataResult = await apiClient.getMovie(apiMovie.externalId);

    if (fullMetadataResult.isFailure()) {
      throw fullMetadataResult.error;
    }

    return fullMetadataResult.map((fullMovie) => {
      if (!fullMovie) {
        throw new Error(`Movie (ID = ${apiMovie.externalId}) not found`);
      }

      return fullMovie;
    });
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Movie')
      .then((_) => _.getOrThrow());
  }
}
