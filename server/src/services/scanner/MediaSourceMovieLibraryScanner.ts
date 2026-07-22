import { isNonEmptyString } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import { differenceWith, head, isEmpty, round, values } from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import type { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import { isMovieProgram } from '../../db/schema/schemaTypeGuards.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import type { HasMediaSourceInfo, Movie } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
import { devAssert } from '../../util/debug.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import { PlexProgramIdentityService } from '../plex/PlexProgramIdentityService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceScanner } from './MediaSourceScanner.ts';

export type GenericMediaSourceMovieLibraryScanner<
  MovieT extends Movie = Movie,
> = MediaSourceMovieLibraryScanner<
  RemoteMediaSourceType,
  MediaSourceApiClient,
  MovieT
>;

type SingleMovieScanRequest = {
  library: MediaSourceLibrary;
  externalId: string;
  force?: boolean;
};

export abstract class MediaSourceMovieLibraryScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT extends MediaSourceApiClient,
  MovieT extends Movie = ApiClientTypeT extends MediaSourceApiClient<
    infer ProgramMapType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? ProgramMapType['movie']
    : Movie,
> extends MediaSourceScanner<'movies', MediaSourceTypeT, ApiClientTypeT> {
  readonly type = 'movies';

  constructor(
    mediaSourceDB: MediaSourceDB,
    protected programDB: IProgramDB,
    protected mediaSourceProgressService: MediaSourceProgressService,
    private searchService: MeilisearchService,
    protected programConverter: ProgramConverter,
    protected programMinter: ProgramDaoMinter,
    protected externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(mediaSourceDB, externalSubtitleDownloader);
  }

  async scanSingle({
    library,
    externalId,
    force,
  }: SingleMovieScanRequest): Promise<Result<void>> {
    const mediaSource = await this.mediaSourceDB.getById(library.mediaSourceId);

    if (!mediaSource) {
      throw new Error(`Media source ${library.mediaSourceId} not found.`);
    }

    devAssert(mediaSource.type === this.mediaSourceType);

    this.logger.info(
      'Scanning %s library for single item (ID = %s, name = %s, item = %s, force = %s)',
      mediaSource.type,
      library.uuid,
      library.name,
      externalId,
      force,
    );

    const client = await this.getApiClient(mediaSource);
    const ctx = {
      library,
      mediaSource,
      force: force ?? false,
      apiClient: client,
      scannedEntities: 0,
      totalEntities: 0,
    } satisfies ScanContext<ApiClientTypeT>;

    this.logger.debug('Scanning single movie with ID = %s', externalId);

    const apiMovie = await this.scanMovieById(ctx, externalId);

    if (apiMovie.isFailure()) {
      return apiMovie.recast();
    }

    const existingMovie = await this.programDB.lookupByExternalId({
      sourceType: this.mediaSourceType,
      externalSourceId: mediaSource.uuid,
      externalKey: externalId,
    });

    return Result.attemptAsync(() =>
      this.scanSingleInternal(
        ctx,
        apiMovie.get(),
        existingMovie,
        undefined,
        new PlexProgramIdentityService(this.programDB),
      ),
    );
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library, pathFilter } = context;
    const existingPrograms =
      await this.programDB.getProgramInfoForMediaSourceLibrary(
        library.uuid,
        ProgramType.Movie,
      );

    const existingByCanonicalId: Dictionary<ProgramCanonicalIdLookupResult> =
      {};
    for (const program of values(existingPrograms)) {
      if (program.canonicalId) {
        existingByCanonicalId[program.canonicalId] = program;
      }
    }

    const identityService = new PlexProgramIdentityService(this.programDB);

    const seenMovieIds = new Set<string>();

    const totalSize = await this.getLibrarySize(library.externalKey, context);

    for await (const incomingMovie of this.getLibraryContents(
      library.externalKey,
      context,
    )) {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      if (
        isNonEmptyString(pathFilter) &&
        incomingMovie.externalId !== pathFilter
      ) {
        continue;
      }

      seenMovieIds.add(incomingMovie.externalId);

      await this.scanSingleInternal(
        context,
        incomingMovie,
        existingPrograms[incomingMovie.externalId],
        existingByCanonicalId[incomingMovie.canonicalId ?? ''],
        identityService,
      );

      const processedAmount = round(seenMovieIds.size / totalSize, 2) * 100.0;

      this.mediaSourceProgressService.scanProgress(
        library.uuid,
        processedAmount,
      );
    }

    if (isEmpty(context.pathFilter)) {
      const missingMovies = differenceWith(
        values(existingPrograms),
        [...seenMovieIds.values()],
        (existing, seen) => {
          return existing.externalKey === seen;
        },
      );

      await this.programDB.updateProgramsState(
        missingMovies.map((movie) => movie.uuid),
        'missing',
      );

      // Mark programs we didn't find as missing in the search index.
      await this.searchService.updatePrograms(
        missingMovies.map((movie) => ({
          id: movie.uuid,
          state: 'missing',
        })),
      );
    }

    this.logger.debug('Completed scanning library %s', context.library.uuid);
    this.mediaSourceProgressService.scanEnded(context.library.uuid);
  }

  protected async scanSingleInternal(
    context: ScanContext<ApiClientTypeT>,
    incomingMovie: MovieT,
    existingMovie: Maybe<ProgramCanonicalIdLookupResult>,
    existingByCanonicalId: Maybe<ProgramCanonicalIdLookupResult>,
    identityService: PlexProgramIdentityService,
  ) {
    const { mediaSource, library, force } = context;

    const fullMovieResult = await this.scanMovie(context, incomingMovie);

    if (fullMovieResult.isFailure()) {
      this.logger.warn(
        fullMovieResult.error,
        'Error querying full movie metadata for ID = %s',
        incomingMovie.externalId,
      );
      return;
    }

    const fullMovie = fullMovieResult.get();

    const resolved = await identityService.resolveExistingProgram({
      incoming: incomingMovie,
      existingByRatingKey: existingMovie,
      existingByCanonicalId,
      mediaSource,
    });

    if (
      identityService.shouldSkipScanUpdate(
        force,
        resolved,
        incomingMovie.canonicalId,
      )
    ) {
      this.logger.debug(
        'Found an unchanged program: rating key = %s, program ID = %s',
        fullMovie.externalId,
        resolved!.existing.uuid,
      );
      return;
    }

    const plexLocation = fullMovie.mediaItem?.locations?.find(
      (loc) => loc.sourceType === mediaSource.type,
    );

    const reuseProgramUuid =
      resolved && (await identityService.reconcileRatingKeyIfChanged(
        resolved,
        mediaSource.uuid,
        fullMovie.externalId,
        {
          directFilePath:
            plexLocation?.type === 'local' ? plexLocation.path : null,
          externalFilePath:
            plexLocation?.type === 'remote' ? plexLocation.externalKey : null,
        },
      )) ?? resolved?.existing.uuid;

    const minted = this.programMinter.mintMovie(
      mediaSource,
      library,
      fullMovie,
      undefined,
      +dayjs(),
      reuseProgramUuid,
    );

    await this.downloadExternalSubtitleStreams(minted, (req) =>
      this.getSubtitles(context, {
        ...req,
        externalMediaItemId: fullMovie.mediaItem?.externalKey ?? undefined,
      }),
    );

    const upsertResult = await Result.attemptAsync(() =>
      this.programDB.upsertPrograms([minted]),
    );
    if (upsertResult.isFailure()) {
      this.logger.warn(
        upsertResult.error,
        'Error while processing movie (%O)',
        incomingMovie,
      );

      return;
    }

    const dbMovie = head(upsertResult.get().filter(isMovieProgram));

    if (dbMovie) {
      this.logger.debug(
        'Upserted movie %s (ID = %s)',
        dbMovie?.title,
        dbMovie?.uuid,
      );

      await this.searchService.indexMovie([
        {
          ...fullMovie,
          uuid: dbMovie.uuid,
          createdAt: dbMovie.createdAt,
          mediaSourceId: mediaSource.uuid,
          libraryId: library.uuid,
        },
      ]);
    } else {
      this.logger.warn('No upserted movie');
    }
  }

  protected abstract scanMovie(
    context: ScanContext<ApiClientTypeT>,
    incomingMovie: MovieT,
  ): Promise<Result<MovieT & HasMediaSourceInfo>>;

  protected abstract scanMovieById(
    context: ScanContext<ApiClientTypeT>,
    externalId: string,
  ): Promise<Result<MovieT & HasMediaSourceInfo>>;

  protected abstract getLibrarySize(
    libraryKey: string,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<number>;

  protected abstract getLibraryContents(
    libraryKey: string,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<MovieT>;
}
