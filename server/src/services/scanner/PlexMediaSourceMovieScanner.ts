import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/base.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type {
  GetSubtitlesRequest,
  ScanContext,
} from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable } from 'inversify';
import { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { KEYS } from '../../types/inject.ts';
import type { PlexMovie } from '../../types/Media.ts';
import type { Result } from '../../types/result.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceMovieLibraryScanner } from './MediaSourceMovieLibraryScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { PlexScanUtil } from './PlexScanUtil.ts';

@injectable()
export class PlexMediaSourceMovieScanner extends MediaSourceMovieLibraryScanner<
  typeof MediaSourceType.Plex,
  PlexApiClient
> {
  readonly mediaSourceType = MediaSourceType.Plex;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: () => ProgramDaoMinter,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(ProgramConverter) programConverter: ProgramConverter,
    @inject(ExternalSubtitleDownloader)
    externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(
      mediaSourceDB,
      programDB,
      mediaSourceProgressService,
      searchService,
      programConverter,
      programMinterFactory(),
      externalSubtitleDownloader,
    );
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<PlexApiClient> {
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
    return apiClient.getMovie(incomingMovie.externalId);
  }

  protected async scanMovieById(
    { apiClient }: ScanContext<PlexApiClient>,
    externalId: string,
  ): Promise<Result<PlexMovie>> {
    return apiClient.getMovie(externalId);
  }

  protected getSubtitles(
    context: ScanContext<PlexApiClient>,
    { key }: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    return PlexScanUtil.getSubtitles(context, key);
  }
}
