import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSource } from '../../db/schema/MediaSource.ts';
import { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { PlexEpisode, PlexSeason, PlexShow } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { EntityMutex } from '../EntityMutex.ts';
import { MeilisearchService } from '../SearchService.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { MediaSourceTvShowLibraryScanner } from './MediaSourceTvShowLibraryScanner.ts';

@injectable()
export class PlexMediaSourceTvShowScanner extends MediaSourceTvShowLibraryScanner<
  'plex',
  PlexApiClient,
  PlexShow,
  PlexSeason,
  PlexEpisode
> {
  readonly mediaSourceType = 'plex';

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(EntityMutex) entityMutex: EntityMutex,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
    @inject(ProgramGroupingMinter)
    programGroupingMinter: ProgramGroupingMinter,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
  ) {
    super(
      logger,
      mediaSourceDB,
      entityMutex,
      programDB,
      programGroupingMinter,
      programMinterFactory(),
      searchService,
      mediaSourceProgressService,
    );
  }

  protected getTvShowLibraryContents(
    libraryId: string,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexShow> {
    return context.apiClient.getTvShowLibraryContents(libraryId);
  }

  protected getTvShowSeasons(
    show: PlexShow,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexSeason> {
    return context.apiClient.getTvShowSeasons(show.externalKey);
  }

  protected getSeasonEpisodes(
    season: PlexSeason,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexEpisode> {
    return context.apiClient.getEpisodes(season.externalKey);
  }

  protected getFullEpisodeMetadata(
    episodeT: PlexEpisode,
    context: ScanContext<PlexApiClient>,
  ): Promise<Result<PlexEpisode, WrappedError>> {
    return context.apiClient.getEpisodeMetadata(episodeT.externalKey);
  }

  protected getApiClient(mediaSource: MediaSource): Promise<PlexApiClient> {
    return this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getEntityExternalKey(
    item: PlexShow | PlexSeason | PlexEpisode,
  ): string {
    return item.externalKey;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<PlexApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getLibraryCount(libraryKey)
      .then((_) => _.getOrThrow());
  }
}
