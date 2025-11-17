import { isNonEmptyString } from '@tunarr/shared/util';
import { head, round } from 'lodash-es';
import type { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import { isMovieProgram } from '../../db/schema/schemaTypeGuards.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { HasMediaSourceInfo, Movie } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
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
    logger: Logger,
    mediaSourceDB: MediaSourceDB,
    protected programDB: IProgramDB,
    protected mediaSourceProgressService: MediaSourceProgressService,
    private searchService: MeilisearchService,
    protected programConverter: ProgramConverter,
    protected programMinter: ProgramDaoMinter,
  ) {
    super(logger, mediaSourceDB);
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { mediaSource, library, force, pathFilter } = context;
    const existingPrograms =
      await this.programDB.getProgramCanonicalIdsForMediaSource(
        library.uuid,
        ProgramType.Movie,
      );

    // const existingWithoutCanonicalIds = await run(async () => {
    //   const allForMediaSource = await this.programDB.lookupByMediaSource(
    //     mediaSource.type,
    //     mediaSource.uuid,
    //     'movie',
    //   );
    //   return groupByUniq(
    //     allForMediaSource.filter((program) => !program.canonicalId),
    //     (program) => program.externalKey,
    //   );
    // });

    const seenMovieIds = new Set<string>();

    const totalSize = await this.getLibrarySize(library.externalKey, context);

    for await (const movie of this.getLibraryContents(
      library.externalKey,
      context,
    )) {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      if (isNonEmptyString(pathFilter) && movie.externalId !== pathFilter) {
        continue;
      }

      const canonicalId = this.getCanonicalId(movie);
      seenMovieIds.add(movie.externalId);

      const processedAmount = round(seenMovieIds.size / totalSize, 2) * 100.0;

      this.mediaSourceProgressService.scanProgress(
        library.uuid,
        processedAmount,
      );

      const fullMovieResult = await this.scanMovie(context, movie);

      if (fullMovieResult.isFailure()) {
        this.logger.warn(
          fullMovieResult.error,
          'Error querying full movie metadata for ID = %s',
          movie.externalId,
        );
        continue;
      }

      const fullMovie = fullMovieResult.get();

      if (
        !force &&
        existingPrograms[fullMovie.externalId] &&
        existingPrograms[fullMovie.externalId].canonicalId === canonicalId
      ) {
        this.logger.debug(
          'Found an unchanged program: rating key = %s, program ID = %s',
          fullMovie.externalId,
          existingPrograms[fullMovie.externalId].uuid,
        );
        continue;
      }

      const minted = this.programMinter.mintMovie(
        mediaSource,
        library,
        fullMovie,
      );

      const upsertResult = await Result.attemptAsync(() =>
        this.programDB.upsertPrograms([minted]),
      );
      if (upsertResult.isFailure()) {
        this.logger.warn(
          upsertResult.error,
          'Error while processing movie (%O)',
          movie,
        );

        continue;
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
            mediaSourceId: mediaSource.uuid,
            libraryId: library.uuid,
          },
        ]);
      } else {
        this.logger.warn('No upserted movie');
      }
    }

    this.logger.debug('Completed scanning library %s', context.library.uuid);
    this.mediaSourceProgressService.scanEnded(context.library.uuid);
  }

  protected abstract scanMovie(
    context: ScanContext<ApiClientTypeT>,
    incomingMovie: MovieT,
  ): Promise<Result<MovieT & HasMediaSourceInfo>>;

  protected abstract getLibrarySize(
    libraryKey: string,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<number>;

  protected abstract getLibraryContents(
    libraryKey: string,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<MovieT>;

  protected abstract getCanonicalId(entity: MovieT): string;

  protected abstract getExternalKey(entity: MovieT): string;
}
