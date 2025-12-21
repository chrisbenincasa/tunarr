import { isNonEmptyString } from '@tunarr/shared/util';
import type { ProgramGrouping } from '@tunarr/types';
import { differenceWith, flatten, isEmpty, round, values } from 'lodash-es';
import type { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import type { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type {
  IProgramDB,
  ProgramGroupingCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type {
  HasMediaSourceAndLibraryId,
  MediaSourceEpisode,
  MediaSourceSeason,
  MediaSourceShow,
  SeasonWithShow,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
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
  RemoteMediaSourceType,
  MediaSourceApiClient,
  ShowT,
  SeasonT,
  EpisodeT
>;

export abstract class MediaSourceTvShowLibraryScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
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
    private getProgramGroupingByIdCommand: GetProgramGroupingById,
  ) {
    super(logger, mediaSourceDB);
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library, pathFilter } = context;
    const existingShowsByExternalId =
      await this.programDB.getExistingProgramGroupingDetails(
        library.uuid,
        ProgramGroupingType.Show,
        this.mediaSourceType,
      );
    const seenShows = new Set<string>();

    const totalSize = await this.getLibrarySize(library.externalKey, context);

    for await (const show of this.getTvShowLibraryContents(
      library.externalKey,
      context,
    )) {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      const processedAmount = round(seenShows.size / totalSize, 2) * 100.0;
      if (isNonEmptyString(pathFilter) && show.externalId !== pathFilter) {
        this.mediaSourceProgressService.scanProgress(
          library.uuid,
          processedAmount,
        );
        continue;
      }

      seenShows.add(show.externalId);

      const existingShow = existingShowsByExternalId[show.externalId];

      const showResult = await this.scanShow(show, existingShow, context);

      this.mediaSourceProgressService.scanProgress(
        library.uuid,
        processedAmount,
      );

      if (showResult.isFailure() || !showResult.get()) {
        this.logger.warn('Failed to scan show. Continuing.');
        continue;
      }

      const scanSeasonsResult = await this.scanSeasons(
        showResult.get()!,
        context,
      );

      if (scanSeasonsResult.isFailure()) {
        this.logger.warn(scanSeasonsResult.error);
      }
    }

    if (isEmpty(context.pathFilter)) {
      const missingShows = differenceWith(
        values(existingShowsByExternalId),
        [...seenShows.values()],
        (existing, seen) => {
          return existing.externalKey === seen;
        },
      );

      const missingSeasons = flatten(
        await Promise.all(
          missingShows.map((show) =>
            this.programDB.getChildren(show.uuid, ProgramGroupingType.Show),
          ),
        ),
      );

      const missingEpisodes = flatten(
        await Promise.all(
          missingShows.map((show) =>
            this.programDB.getProgramGroupingDescendants(
              show.uuid,
              ProgramGroupingType.Show,
            ),
          ),
        ),
      );

      const missingGroupingIds = missingSeasons
        .flatMap((season) => season.results.map((s) => s.uuid))
        .concat(missingShows.map((show) => show.uuid));
      await this.programDB.updateGroupingsState(missingGroupingIds, 'missing');

      const missingEpisodeIds = missingEpisodes.map((ep) => ep.uuid);
      await this.programDB.updateProgramsState(missingEpisodeIds, 'missing');

      // Mark programs we didn't find as missing in the search index.
      await this.searchService.updatePrograms(
        missingEpisodeIds.concat(missingGroupingIds).map((id) => ({
          id,
          state: 'missing',
        })),
      );
    }

    this.mediaSourceProgressService.scanEnded(library.uuid);
  }

  protected async scanShow(
    incomingShow: ShowT,
    existingShow: Maybe<ProgramGroupingCanonicalIdLookupResult>,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<Result<Maybe<ShowT>>> {
    const showResult = await this.getFullTvShowMetadata(
      incomingShow.externalId,
      context,
    );
    if (showResult.isFailure()) {
      this.logger.warn(
        showResult.error,
        'Error while querying full details for show ID %s.',
        incomingShow.externalId,
      );
      return showResult.recast();
    }

    const show = showResult.get();
    const needsDeepScan =
      context.force ||
      !existingShow ||
      (existingShow.canonicalId &&
        show.canonicalId !== existingShow.canonicalId);

    if (!needsDeepScan) {
      const existing = await this.getProgramGroupingByIdCommand.execute(
        existingShow.uuid,
      );
      return Result.success(
        existing && this.isShowT(existing) ? existing : undefined,
      );
    }

    this.logger.debug('Upserting show key = %s', incomingShow.externalId);

    const { mediaSource, library } = context;

    const groupingAndRelations =
      this.programGroupingMinter.mintForMediaSourceShow(
        mediaSource,
        library,
        show,
      );
    groupingAndRelations.programGrouping.libraryId = context.library.uuid;

    const upsertResult = await Result.attemptAsync(() =>
      this.programDB.upsertProgramGrouping(groupingAndRelations, context.force),
    );

    if (upsertResult.isFailure()) {
      this.logger.warn(upsertResult.error, 'Failed to upsert show');
      return upsertResult.recast();
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
      this.logger.warn(
        indexResult.error,
        'Failed to update search index for show',
      );
      // Should we skip indexing the rest in this case??
      return indexResult.recast();
    }

    return Result.success(persistedShow);
  }

  protected async scanSeasons(
    show: ShowT,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    return Result.attemptAsync(async () => {
      const { library } = scanContext;
      const existingSeasons =
        await this.programDB.getExistingProgramGroupingDetails(
          library.uuid,
          ProgramGroupingType.Season,
          this.mediaSourceType,
          show.uuid,
        );
      const seenSeasons = new Set<string>();

      // TODO: Add seen ids
      for await (const season of this.getTvShowSeasons(show, scanContext)) {
        if (this.state(library.uuid) === 'canceled') {
          return;
        }

        seenSeasons.add(season.externalId);

        const persistedSeason = await this.updateSeason(
          season,
          show,
          existingSeasons[season.externalId],
          scanContext,
        );

        if (persistedSeason.isFailure()) {
          this.logger.warn(
            persistedSeason.error,
            'Failed to scan season %s',
            season.externalId,
          );
          continue;
        } else if (!persistedSeason.get()) {
          this.logger.error(
            'Bad state - existing season found but not properly returned by the DB.',
          );
          continue;
        }

        const scanEpisodesResult = await this.scanEpisodes(
          show,
          persistedSeason.get()!,
          scanContext,
        );

        if (scanEpisodesResult.isFailure()) {
          this.logger.warn(scanEpisodesResult.error);
        }
      }

      if (isEmpty(scanContext.pathFilter)) {
        const missingSeasons = differenceWith(
          values(existingSeasons),
          [...seenSeasons.values()],
          (existing, seen) => {
            return existing.externalKey === seen;
          },
        );

        const missingEpisodes = flatten(
          await Promise.all(
            missingSeasons.map((show) =>
              this.programDB.getProgramGroupingDescendants(show.uuid),
            ),
          ),
        );

        const missingSeasonIds = missingSeasons.map((season) => season.uuid);
        await this.programDB.updateGroupingsState(missingSeasonIds, 'missing');

        const missingEpisodeIds = missingEpisodes.map((movie) => movie.uuid);
        await this.programDB.updateProgramsState(missingEpisodeIds, 'missing');

        // Mark programs we didn't find as missing in the search index.
        await this.searchService.updatePrograms(
          missingEpisodeIds.concat(missingSeasonIds).map((id) => ({
            id,
            state: 'missing',
          })),
        );
      }
    });
  }

  protected async updateSeason(
    season: SeasonT,
    show: ShowT,
    existingSeason: Maybe<ProgramGroupingCanonicalIdLookupResult>,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<
    Result<Maybe<SeasonWithShow<SeasonT, ShowT> & HasMediaSourceAndLibraryId>>
  > {
    const fullSeasonResult = await this.getFullTvSeasonMetadata(
      season.externalId,
      scanContext,
    );
    if (fullSeasonResult.isFailure()) {
      this.logger.warn(
        fullSeasonResult.error,
        'Error while querying full details for season ID %s.',
        season.externalId,
      );
      return fullSeasonResult.recast();
    }

    const fullSeason = fullSeasonResult.get();

    const needsUpdate =
      scanContext.force ||
      !existingSeason ||
      fullSeason.canonicalId !== existingSeason.canonicalId;

    if (!needsUpdate) {
      const existing = await this.getProgramGroupingByIdCommand.execute(
        existingSeason.uuid,
      );
      if (existing && this.isSeasonT(existing)) {
        const returnSeason: SeasonWithShow<SeasonT, ShowT> &
          HasMediaSourceAndLibraryId = {
          ...existing,
          show,
          mediaSourceId: scanContext.mediaSource.uuid,
          libraryId: scanContext.library.uuid,
        };
        return Result.success(returnSeason);
      }

      return Result.success(undefined);
    }

    this.logger.debug('Upserting season key = %s', fullSeason.externalId);

    const { mediaSource, library } = scanContext;

    const seasonAndRelations = this.programGroupingMinter.mintSeason(
      mediaSource,
      library,
      fullSeason,
    );
    seasonAndRelations.programGrouping.libraryId = scanContext.library.uuid;
    seasonAndRelations.programGrouping.showUuid = show.uuid;

    const upsertResult = await Result.attemptAsync(() =>
      this.programDB.upsertProgramGrouping(
        seasonAndRelations,
        scanContext.force,
      ),
    );

    if (upsertResult.isFailure()) {
      this.logger.warn(upsertResult.error);
      return upsertResult.recast();
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

    const indexResult = await Result.attemptAsync(() =>
      this.searchService.indexSeason(persistedSeason),
    );

    if (indexResult.isFailure()) {
      return indexResult.recast();
    }

    return Result.success(persistedSeason);
  }

  protected async scanEpisodes(
    show: ShowT,
    season: SeasonWithShow<SeasonT, ShowT>,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    // TODO track incoming
    return Result.attemptAsync(async () => {
      const { mediaSource, library, force } = scanContext;
      const existing = await this.programDB.getProgramInfoForMediaSourceLibrary(
        library.uuid,
        ProgramType.Episode,
        [ProgramGroupingType.Season, season.uuid],
      );

      const seenEpisodes = new Set<string>();

      for await (const episode of this.getSeasonEpisodes(season, scanContext)) {
        const externalKey = this.getEntityExternalKey(episode);
        const fullMetadataResult = await this.getFullEpisodeMetadata(
          episode,
          scanContext,
        );

        seenEpisodes.add(episode.externalId);

        if (fullMetadataResult.isFailure()) {
          this.logger.warn(
            fullMetadataResult.error,
            'Failed to query episode %s for metadata',
            episode.externalId,
          );
          continue;
        }

        const fullEpisode = fullMetadataResult.get();

        if (
          !force &&
          existing[externalKey]?.canonicalId === fullEpisode.canonicalId
        ) {
          this.logger.debug(
            "Skipping episode key = %s because it hasn't changed",
            externalKey,
          );
          continue;
        }

        this.logger.debug('Upserting episode key = %s', externalKey);

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

        dao.program.tvShowUuid = show.uuid;
        dao.program.seasonUuid = season.uuid;

        try {
          const [upsertResult] = await this.programDB.upsertPrograms([dao]);

          this.logger.trace('Upserted episode ID %s', upsertResult!.uuid);

          await this.searchService.indexEpisodes([
            { ...episodeWithJoins, uuid: upsertResult!.uuid },
          ]);
        } catch (e) {
          this.logger.warn(
            e,
            'Failed to upsert episode %s',
            episode.externalId,
          );
        }
      }

      if (isEmpty(scanContext.pathFilter)) {
        const missingEpisodes = differenceWith(
          values(existing),
          [...seenEpisodes.values()],
          (existing, seen) => existing.externalKey === seen,
        );

        await this.programDB.updateProgramsState(
          missingEpisodes.map((ep) => ep.uuid),
          'missing',
        );
        await this.searchService.updatePrograms(
          missingEpisodes.map((ep) => ({
            id: ep.uuid,
            state: 'missing',
          })),
        );
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
    season: SeasonWithShow<SeasonT, ShowT>,
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

  protected abstract getFullTvShowMetadata(
    externalId: string,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<Result<ShowT>>;

  protected abstract getFullTvSeasonMetadata(
    externalId: string,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<Result<SeasonT>>;

  protected abstract isShowT(grouping: ProgramGrouping): grouping is ShowT;

  protected abstract isSeasonT(grouping: ProgramGrouping): grouping is SeasonT;
}
