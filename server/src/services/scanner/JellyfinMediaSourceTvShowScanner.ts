import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/base.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type {
  GetSubtitlesRequest,
  ScanContext,
} from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable } from 'inversify';
import { isNil } from 'lodash-es';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import type { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';

import type { ProgramGrouping } from '@tunarr/types';
import { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import type {
  JellyfinEpisode,
  JellyfinSeason,
  JellyfinShow,
  SeasonWithShow,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { JellyfinScanUtil } from './JellyfinScanUtil.ts';
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
    @inject(ProgramGroupingMinter)
    programGroupingMinter: ProgramGroupingMinter,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(GetProgramGroupingById)
    getProgramGroupingsById: GetProgramGroupingById,
    @inject(ExternalSubtitleDownloader)
    externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(
      mediaSourceDB,
      programDB,
      programGroupingMinter,
      programMinterFactory(),
      searchService,
      mediaSourceProgressService,
      getProgramGroupingsById,
      externalSubtitleDownloader,
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
    return context.apiClient.getShowSeasons(show.externalId);
  }

  protected getSeasonEpisodes(
    season: SeasonWithShow<JellyfinSeason, JellyfinShow>,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinEpisode> {
    return context.apiClient.getSeasonEpisodes(
      season.show.externalId,
      season.externalId,
    );
  }

  protected getFullEpisodeMetadata(
    episodeT: JellyfinEpisode,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<Result<JellyfinEpisode, WrappedError>> {
    return context.apiClient
      .getEpisode(episodeT.externalId)
      .then((_) =>
        _.flatMap((ep) =>
          isNil(ep)
            ? Result.forError(
                new Error(`Episode ID ${episodeT.externalId} not found`),
              )
            : Result.success(ep),
        ),
      );
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
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
    return show.externalId;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Series')
      .then((_) => _.getOrThrow());
  }

  protected getFullTvSeasonMetadata(
    externalId: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<Result<JellyfinSeason, WrappedError>> {
    return context.apiClient.getSeason(externalId);
  }

  protected getFullTvShowMetadata(
    externalId: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<Result<JellyfinShow, WrappedError>> {
    return context.apiClient.getShow(externalId);
  }

  protected isShowT(grouping: ProgramGrouping): grouping is JellyfinShow {
    return grouping.sourceType === 'jellyfin' && grouping.type === 'show';
  }

  protected isSeasonT(grouping: ProgramGrouping): grouping is JellyfinSeason {
    return grouping.sourceType === 'jellyfin' && grouping.type === 'season';
  }

  protected getSubtitles(
    context: ScanContext<JellyfinApiClient>,
    request: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    return JellyfinScanUtil.getSubtitles(context, request);
  }
}
