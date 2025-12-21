import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/base.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { isNil } from 'lodash-es';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';

import { ProgramGrouping } from '@tunarr/types';
import { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import {
  EmbyEpisode,
  EmbySeason,
  EmbyShow,
  SeasonWithShow,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { MediaSourceTvShowLibraryScanner } from './MediaSourceTvShowLibraryScanner.ts';

@injectable()
export class EmbyMediaSourceTvShowScanner extends MediaSourceTvShowLibraryScanner<
  typeof MediaSourceType.Emby,
  EmbyApiClient,
  EmbyShow,
  EmbySeason,
  EmbyEpisode
> {
  readonly mediaSourceType = MediaSourceType.Emby;

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
    @inject(ProgramGroupingMinter)
    programGroupingMinter: ProgramGroupingMinter,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(GetProgramGroupingById)
    getProgramGroupingsById: GetProgramGroupingById,
  ) {
    super(
      logger,
      mediaSourceDB,
      programDB,
      programGroupingMinter,
      programMinterFactory(),
      searchService,
      mediaSourceProgressService,
      getProgramGroupingsById,
    );
  }

  protected getTvShowLibraryContents(
    libraryId: string,
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbyShow> {
    return context.apiClient.getTvShowLibraryContents(libraryId);
  }

  protected getTvShowSeasons(
    show: EmbyShow,
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbySeason> {
    return context.apiClient.getShowSeasons(show.externalId);
  }

  protected getSeasonEpisodes(
    season: SeasonWithShow<EmbySeason, EmbyShow>,
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbyEpisode> {
    return context.apiClient.getSeasonEpisodes(
      season.show.externalId,
      season.externalId,
    );
  }

  protected getFullEpisodeMetadata(
    episodeT: EmbyEpisode,
    context: ScanContext<EmbyApiClient>,
  ): Promise<Result<EmbyEpisode, WrappedError>> {
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
  ): Promise<EmbyApiClient> {
    return this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getCanonicalId(
    entity: EmbyShow | EmbySeason | EmbyEpisode,
  ): string {
    return entity.canonicalId;
  }

  protected getEntityExternalKey(
    show: EmbyShow | EmbySeason | EmbyEpisode,
  ): string {
    return show.externalId;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<EmbyApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Series')
      .then((_) => _.getOrThrow());
  }

  protected getFullTvSeasonMetadata(
    externalId: string,
    context: ScanContext<EmbyApiClient>,
  ): Promise<Result<EmbySeason, WrappedError>> {
    return context.apiClient.getSeason(externalId);
  }

  protected getFullTvShowMetadata(
    externalId: string,
    context: ScanContext<EmbyApiClient>,
  ): Promise<Result<EmbyShow, WrappedError>> {
    return context.apiClient.getShow(externalId);
  }

  protected isShowT(grouping: ProgramGrouping): grouping is EmbyShow {
    return grouping.sourceType === 'emby' && grouping.type === 'show';
  }

  protected isSeasonT(grouping: ProgramGrouping): grouping is EmbySeason {
    return grouping.sourceType === 'emby' && grouping.type === 'season';
  }
}
