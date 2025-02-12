import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { isNil } from 'lodash-es';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSource, MediaSourceType } from '../../db/schema/MediaSource.ts';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';

import {
  JellyfinEpisode,
  JellyfinSeason,
  JellyfinShow,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { EntityMutex } from '../EntityMutex.ts';
import { MeilisearchService } from '../SearchService.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { MediaSourceTvShowLibraryScanner } from './MediaSourceTvShowLibraryScanner.ts';

@injectable()
export class JellyfinMediaSourceTvShowScanner extends MediaSourceTvShowLibraryScanner<
  typeof MediaSourceType.Jellyfin,
  JellyfinApiClient,
  JellyfinShow,
  JellyfinSeason,
  JellyfinEpisode
> {
  readonly mediaSourceType = MediaSourceType.Jellyfin;

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
    @inject(ProgramGroupingMinter)
    programGroupingMinter: ProgramGroupingMinter,
    @inject(MeilisearchService) searchService: MeilisearchService,
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
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinShow> {
    return context.apiClient.getTvShowLibraryContents(libraryId);
  }

  protected getTvShowSeasons(
    show: JellyfinShow,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinSeason> {
    return context.apiClient.getTvShowSeasons(show.externalKey);
  }

  protected getSeasonEpisodes(
    season: JellyfinSeason,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinEpisode> {
    return context.apiClient.getEpisodes(season.externalKey);
  }

  protected getFullEpisodeMetadata(
    episodeT: JellyfinEpisode,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<Result<JellyfinEpisode, WrappedError>> {
    return context.apiClient
      .getEpisode(episodeT.externalKey)
      .then((_) =>
        _.flatMap((ep) =>
          isNil(ep)
            ? Result.forError(
                new Error(`Episode ID ${episodeT.externalKey} not found`),
              )
            : Result.success(ep),
        ),
      );
  }

  protected getApiClient(mediaSource: MediaSource): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getCanonicalId(
    entity: JellyfinShow | JellyfinSeason | JellyfinEpisode,
  ): string {
    return entity.canonicalId;
  }

  protected getEntityExternalKey(
    show: JellyfinShow | JellyfinSeason | JellyfinEpisode,
  ): string {
    return show.externalKey;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey)
      .then((_) => _.getOrThrow());
  }
}
