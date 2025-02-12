import { round } from 'lodash-es';
import type { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type {
  HasMediaSourceAndLibraryId,
  MediaSourceEpisode,
  MediaSourceSeason,
  MediaSourceShow,
  SeasonWithShow,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { wait } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceScanner } from './MediaSourceScanner.ts';

export type GenericMediaSourceTvShowLibraryScanner<
  ShowT extends MediaSourceShow = MediaSourceShow,
  SeasonT extends MediaSourceSeason<ShowT> = MediaSourceSeason<ShowT>,
  EpisodeT extends MediaSourceEpisode<ShowT, SeasonT> = MediaSourceEpisode<
    ShowT,
    SeasonT
  >,
> = MediaSourceTvShowLibraryScanner<
  MediaSourceType,
  MediaSourceApiClient,
  ShowT,
  SeasonT,
  EpisodeT
>;

export abstract class MediaSourceTvShowLibraryScanner<
  MediaSourceTypeT extends MediaSourceType,
  ApiClientTypeT extends MediaSourceApiClient,
  ShowT extends MediaSourceShow,
  SeasonT extends MediaSourceSeason<ShowT>,
  EpisodeT extends MediaSourceEpisode<ShowT, SeasonT>,
> extends MediaSourceScanner<'shows', MediaSourceTypeT, ApiClientTypeT> {
  readonly type = 'shows' as const;

  constructor(
    logger: Logger,
    mediaSourceDB: MediaSourceDB,
    protected programDB: IProgramDB,
    protected programGroupingMinter: ProgramGroupingMinter,
    protected programMinter: ProgramDaoMinter,
    protected searchService: MeilisearchService,
    private mediaSourceProgressService: MediaSourceProgressService,
  ) {
    super(logger, mediaSourceDB);
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library, mediaSource } = context;
    // const existingShows = this.programDB.getProgramGroupingCanonicalIds(
    //   library.uuid,
    //   ProgramGroupingType.Show,
    //   this.mediaSourceType,
    // );
    const seenShows = new Set<string>();

    const totalSize = await this.getLibrarySize(library.externalKey, context);

    for await (const show of this.getTvShowLibraryContents(
      library.externalKey,
      context,
    )) {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      seenShows.add(show.externalKey);
      const processedAmount = round(seenShows.size / totalSize, 2) * 100.0;
      // const canonicalId = this.getCanonicalId(show);

      this.mediaSourceProgressService.scanProgress(
        library.uuid,
        processedAmount,
      );

      // Get full metadata?
      const dao = this.programGroupingMinter.mintForMediaSourceShow(
        mediaSource,
        library,
        show,
      );

      const upsertResult = await Result.attemptAsync(() =>
        this.programDB.getOrInsertProgramGrouping(dao, {
          externalKey: this.getEntityExternalKey(show),
          externalSourceId: mediaSource.uuid,
          sourceType: this.mediaSourceType,
        }),
      );

      if (upsertResult.isFailure()) {
        this.logger.warn(upsertResult.error);
        continue;
      }

      const upsertedShow = upsertResult.get().entity;
      const persistedShow: ShowT & HasMediaSourceAndLibraryId = {
        ...show,
        uuid: upsertedShow.uuid,
        mediaSourceId: mediaSource.uuid,
        libraryId: library.uuid,
      };

      const indexResult = await Result.attemptAsync(() =>
        this.searchService.indexShow(persistedShow),
      );

      if (indexResult.isFailure()) {
        this.logger.warn(indexResult.error);
        // Should we skip indexing the rest in this case??
        continue;
      }

      const scanSeasonsResult = await this.scanSeasons(persistedShow, context);

      if (scanSeasonsResult.isFailure()) {
        this.logger.warn(scanSeasonsResult.error);
      }

      await wait();
    }

    this.mediaSourceProgressService.scanEnded(library.uuid);
  }

  protected async scanSeasons(
    show: ShowT,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    return Result.attemptAsync(async () => {
      const { mediaSource, library } = scanContext;
      // const existingSeasons = await this.programDB.getShowSeasons(show.uuid);

      // TODO: Add seen ids
      for await (const season of this.getTvShowSeasons(show, scanContext)) {
        if (this.state(library.uuid) === 'canceled') {
          return;
        }

        const dao = this.programGroupingMinter.mintSeason(
          mediaSource,
          library,
          season,
        );
        dao.libraryId = scanContext.library.uuid;
        dao.showUuid = show.uuid;

        const upsertResult = await Result.attemptAsync(() =>
          this.programDB.getOrInsertProgramGrouping(dao, {
            externalKey: this.getEntityExternalKey(season),
            externalSourceId: mediaSource.uuid,
            sourceType: this.mediaSourceType,
          }),
        );

        if (upsertResult.isFailure()) {
          this.logger.warn(upsertResult.error);
          continue;
        }

        season.uuid = upsertResult.get().entity.uuid;

        const persistedSeason: SeasonWithShow<SeasonT, ShowT> &
          HasMediaSourceAndLibraryId = {
          ...season,
          uuid: upsertResult.get().entity.uuid,
          show,
          mediaSourceId: mediaSource.uuid,
          libraryId: library.uuid,
        };

        await this.searchService.indexSeason(persistedSeason);

        const scanEpisodesResult = await this.scanEpisodes(
          show,
          persistedSeason,
          scanContext,
        );

        if (scanEpisodesResult.isFailure()) {
          this.logger.warn(scanEpisodesResult.error);
        }

        await wait();
      }
    });
  }

  protected async scanEpisodes(
    show: ShowT,
    season: SeasonWithShow<SeasonT, ShowT>,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    // TODO track incoming
    return Result.attemptAsync(async () => {
      const { mediaSource, library, force } = scanContext;
      const existing =
        await this.programDB.getProgramCanonicalIdsForMediaSource(
          library.uuid,
          ProgramType.Episode,
        );
      for await (const episode of this.getSeasonEpisodes(season, scanContext)) {
        const externalKey = this.getEntityExternalKey(episode);
        if (
          !force &&
          existing[externalKey]?.canonicalId === this.getCanonicalId(episode)
        ) {
          this.logger.debug(
            "Skipping episode key = %s because it hasn't changed",
            externalKey,
          );
          continue;
        }

        const fullMetadataResult = await this.getFullEpisodeMetadata(
          episode,
          scanContext,
        );

        const upsertResult = await fullMetadataResult.flatMapAsync(
          (fullEpisode) => {
            const episodeWithJoins = {
              ...fullEpisode,
              season,
              mediaSourceId: mediaSource.uuid,
              libraryId: library.uuid,
            };

            const dao = this.programMinter.mintEpisode(
              mediaSource,
              library,
              episodeWithJoins,
            );

            dao.tvShowUuid = show.uuid;
            dao.seasonUuid = season.uuid;

            return Result.attemptAsync(() =>
              this.programDB.upsertPrograms([dao]),
            ).then((_) =>
              _.mapAsync(([inserted]) =>
                this.searchService.indexEpisodes([
                  { ...episodeWithJoins, uuid: inserted.uuid },
                ]),
              ),
            );
          },
        );

        if (upsertResult.isFailure()) {
          this.logger.warn(upsertResult.error);
        }

        await wait();
      }
    });
  }

  protected abstract getTvShowLibraryContents(
    libraryId: string, // TODO: Full library type?
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<ShowT>;

  protected abstract getTvShowSeasons(
    show: ShowT,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<SeasonT>;

  protected abstract getSeasonEpisodes(
    season: SeasonT,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<EpisodeT>;

  protected getCanonicalId(entity: ShowT | SeasonT | EpisodeT): string {
    return entity.canonicalId;
  }

  protected abstract getEntityExternalKey(
    show: ShowT | SeasonT | EpisodeT,
  ): string;

  protected abstract getFullEpisodeMetadata(
    episodeT: EpisodeT,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<Result<EpisodeT>>;
}
