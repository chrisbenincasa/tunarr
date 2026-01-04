import { MovieNfo } from '@/nfo/NfoSchemas.js';
import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { Actor, Director, Identifier, MovieMetadata } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { chunk, compact, isEmpty, isUndefined } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { basename, dirname, extname } from 'node:path';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import { LocalMediaDB } from '../../db/LocalMediaDB.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { Artwork, ArtworkType } from '../../db/schema/Artwork.ts';
import { ProgramOrm, ProgramType } from '../../db/schema/Program.ts';
import { MovieNfoParser } from '../../nfo/MovieNfoParser.ts';
import { FfprobeStreamDetails } from '../../stream/FfprobeStreamDetails.ts';
import { MediaSourceMovie } from '../../types/Media.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.js';
import { Maybe } from '../../types/util.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { caughtErrorToError, isDefined } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import { Canonicalizer } from '../Canonicalizer.ts';
import { ImageCache } from '../ImageCache.ts';
import { FolderAndContents } from '../LocalFolderCanonicalizer.ts';
import { LocalMediaCanonicalizer } from '../LocalMediaCanonicalizer.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { FallbackMetadataService } from '../local/FallbackMetadataService.ts';
import { LocalSubtitlesService } from '../local/LocalSubtitlesService.ts';
import { FileSystemScanner, LocalScanContext } from './FileSystemScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import {
  KnownImageFileExtensions,
  KnownVideoFileExtensions,
} from './constants.ts';

@injectable()
export class LocalMovieScanner extends FileSystemScanner {
  #pathsComplete: number = 0;
  #pathCount: number = 0;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.LocalFolderCanonicalizer)
    private canonicalizer: Canonicalizer<FolderAndContents>,
    @inject(LocalMediaDB) localMediaDB: LocalMediaDB,
    @inject(FfprobeStreamDetails)
    ffprobeStreamDetails: FfprobeStreamDetails,
    @inject(ImageCache) imageCache: ImageCache,
    @inject(ProgramDaoMinter) private programDaoMinter: ProgramDaoMinter,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(new LazyServiceIdentifier(() => KEYS.LocalMediaCanonicalizer))
    private localMediaCanonicalizer: LocalMediaCanonicalizer,
    @inject(LocalSubtitlesService)
    private localSubtitlesService: LocalSubtitlesService,
    @inject(FallbackMetadataService)
    private fallbackMetadataService: FallbackMetadataService,
  ) {
    super(
      logger,
      ffprobeStreamDetails,
      imageCache,
      localMediaDB,
      mediaSourceProgressService,
      mediaSourceDB,
    );
  }

  async scanPath(context: LocalScanContext): Promise<Result<void>> {
    const rootResult = await Result.attemptAsync(() =>
      // Only scan for files in the root directory.
      this.scanDirectory(
        context.library.externalKey,
        context,
        /* recurse= */ false,
      ),
    );

    if (rootResult.isFailure()) {
      this.logger.error(
        'Error while scanning for files in root folder of library: %s. Continuing',
        context.library.externalKey,
      );
    }

    const recursiveResult = await Result.attemptAsync(() =>
      this.loopThroughDir(context.library.externalKey, context),
    );

    if (this.state === 'canceled') {
      return Result.all([rootResult, recursiveResult]).map(() => void 0);
    }

    const markMissingResult = await Result.attemptAsync(async () => {
      if (isNonEmptyString(context.pathFilter)) {
        return;
      }
      // Look for missing movies.
      const existingMovies =
        await this.programDB.getProgramInfoForMediaSourceLibrary(
          context.library.uuid,
          ProgramType.Movie,
        );

      const missingMovies: ProgramCanonicalIdLookupResult[] = [];
      for (const movieChunk of chunk(Object.values(existingMovies), 100)) {
        const results = movieChunk.map(async (movie) => {
          const exists = await fileExists(movie.externalKey);
          if (!exists) {
            return movie;
          }
          return;
        });
        missingMovies.push(...compact(await Promise.all(results)));
      }

      await this.programDB.updateProgramsState(
        missingMovies.map((movie) => movie.uuid),
        'missing',
      );
      await this.searchService.updatePrograms(
        missingMovies.map((movie) => ({
          id: movie.uuid,
          state: 'missing',
        })),
      );
    });

    return Result.all([rootResult, recursiveResult, markMissingResult]).map(
      () => void 0,
    );
  }

  private async loopThroughDir(basePath: string, context: LocalScanContext) {
    const entries = await fs.readdir(basePath, {
      withFileTypes: true,
    });

    this.#pathCount += entries.length;
    for (const dirent of entries) {
      if (this.state === 'canceled') {
        this.logger.debug(
          'Aborting directory scan for %s because it was canceled',
          basePath,
        );
        return;
      }

      if (!dirent.isDirectory()) {
        continue;
      }

      try {
        await this.scanDirectory(
          path.join(dirent.parentPath, dirent.name),
          context,
        );
      } finally {
        this.#pathsComplete++;
        const pctComplete =
          this.#pathsComplete / (this.#pathsComplete + this.#pathCount);
        const progressPct =
          context.percentMin + pctComplete * context.percentCompleteMultiplier;
        this.mediaSourceProgressService.scanProgress(
          context.mediaSource.uuid,
          progressPct * 100.0,
        );
        this.#pathCount--;
      }
    }
  }

  private async scanDirectory(
    fullPath: string,
    context: LocalScanContext,
    recurse: boolean = true,
  ) {
    const { library, force } = context;
    const parent = dirname(fullPath);
    if (!(await this.shouldScanDirectory(fullPath))) {
      return;
    }

    const allFiles = await fs.readdir(fullPath, { withFileTypes: true });

    // TODO filter extra files
    const videoFiles = allFiles.filter(
      (file) =>
        file.isFile() &&
        KnownVideoFileExtensions.has(extname(file.name)) &&
        !basename(file.name).startsWith('._'),
    );

    const canonicalFiles = allFiles.filter(
      (f) => !basename(f.name).startsWith('.'),
    );
    const canonicalFilesAndStats = await Promise.all(
      canonicalFiles.map(async (file) => {
        const stat = await fs.stat(path.join(file.parentPath, file.name));
        return {
          dirent: file,
          stats: stat,
        };
      }),
    );

    const canonicalId = this.canonicalizer.getCanonicalId({
      folderName: fullPath,
      folderStats: await fs.stat(fullPath),
      contents: canonicalFilesAndStats,
    });

    const parentFolder = await this.localMediaDB.findFolder(library, parent);

    const folderModel = await this.localMediaDB.upsertFolder(
      library,
      parentFolder?.uuid,
      fullPath,
      canonicalId,
    );

    if (videoFiles.length === 0 && recurse) {
      for (const subdir of await fs.readdir(fullPath, {
        withFileTypes: true,
      })) {
        if (subdir.isDirectory()) {
          await this.loopThroughDir(
            path.join(subdir.parentPath, subdir.name),
            context,
          );
        }
      }

      await this.localMediaDB.setCanonicalId(
        folderModel.folder.uuid,
        canonicalId,
      );

      return;
    }

    if (
      !force &&
      !folderModel.isNew &&
      folderModel.folder.canonicalId === canonicalId
    ) {
      this.logger.trace('Folder %s is unchanged, not scanning', fullPath);
      return;
    } else if (folderModel.isNew) {
      this.logger.trace('Scanning new folder: %s', fullPath);
    } else if (force) {
      this.logger.trace('Force scanning folder %s', fullPath);
    } else {
      this.logger.trace('Existing folder %s changed, scanning', fullPath);
    }

    this.logger.debug('Scanning local folder %s for movies', fullPath);

    for (const videoFile of videoFiles) {
      const fullVideoFilePath = path.join(videoFile.parentPath, videoFile.name);
      const result = await this.handleVideoFile(
        fullVideoFilePath,
        folderModel.folder.uuid,
        context,
      );
      if (result.isFailure()) {
        this.logger.error(
          result.error,
          'Error while scanning movie file: %s',
          fullVideoFilePath,
        );
      }
    }
  }

  private async handleVideoFile(
    fullVideoFilePath: string,
    folderId: string,
    context: LocalScanContext,
  ): Promise<Result<void>> {
    try {
      const existingMovie = await this.localMediaDB.findExistingLocalProgram(
        context.mediaSource.uuid,
        context.library.uuid,
        fullVideoFilePath,
        'movie',
      );

      const stat = await fs.stat(fullVideoFilePath);

      const mediaItemResult = await this.getMediaItem(fullVideoFilePath);

      if (mediaItemResult.isFailure()) {
        return mediaItemResult.mapPure(() => void 0);
      }

      const metadataResult = await this.loadMovieMetadata(fullVideoFilePath);
      if (metadataResult.isFailure()) {
        return metadataResult.recast();
      }

      const posterArtResult = await this.scanArtworkForMovie(
        fullVideoFilePath,
        'poster',
        existingMovie,
        context.force,
      );
      const fanartArtResult = await this.scanArtworkForMovie(
        fullVideoFilePath,
        'fanart',
        existingMovie,
        context.force,
      );

      const subtitlesResult = await Result.attemptAsync(() =>
        this.localSubtitlesService.findExternalSubtitles(fullVideoFilePath),
      );
      if (subtitlesResult.isFailure()) {
        this.logger.error(
          subtitlesResult.error,
          'Failed to find external subtitles',
        );
      }

      const movie: MediaSourceMovie = {
        ...metadataResult.get(),
        mediaSourceId: context.mediaSource.uuid,
        libraryId: context.library.uuid,
        duration: mediaItemResult.get().duration,
        mediaItem: mediaItemResult.get(),
        externalId: fullVideoFilePath,
        canonicalId: '',
        externalSubtitles: subtitlesResult.getOrElse([]),
      };

      movie.canonicalId = this.localMediaCanonicalizer.getCanonicalId(movie);

      const movieDao = this.programDaoMinter.mintMovie(
        context.mediaSource,
        context.library,
        movie,
        folderId,
        stat.mtimeMs,
      );

      posterArtResult.filter(isDefined).forEach((poster) => {
        movieDao.artwork.push(poster);
      });
      fanartArtResult.filter(isDefined).forEach((fanart) => {
        movieDao.artwork.push(fanart);
      });

      const upsertResult = await this.programDB.upsertPrograms(movieDao);

      this.logger.debug(
        'Upserted movie %s (ID = %s)',
        upsertResult.title,
        upsertResult.uuid,
      );

      await this.searchService.indexMovie([
        {
          ...movie,
          uuid: upsertResult.uuid,
        },
      ]);

      return Result.success(void 0);
    } catch (e) {
      return Result.forError(caughtErrorToError(e));
    }
  }

  private async loadMovieMetadata(fullVideoFilePath: string) {
    const nfoPath = await this.findNfoFile(fullVideoFilePath);
    if (isUndefined(nfoPath) || isEmpty(nfoPath)) {
      return Result.attemptAsync(() =>
        Promise.resolve(
          this.fallbackMetadataService.getMovieFallbackMetadata(
            fullVideoFilePath,
          ),
        ),
      );
    }

    const parseResult = await new MovieNfoParser().parse(
      await fs.readFile(nfoPath, 'utf-8'),
    );
    if (parseResult.isFailure()) {
      return parseResult.recast();
    }

    return Result.attemptAsync(() =>
      Promise.resolve(this.movieNfoToMovie(parseResult.get().movie)),
    );
  }

  private movieNfoToMovie(movieNfo: MovieNfo): MovieMetadata {
    const identifiers: Identifier[] = seq.collect(movieNfo.uniqueid, (id) => {
      const typ = id['@_type'].toLowerCase().trim();
      switch (typ) {
        case 'tmdb':
        case 'imdb':
        case 'tvdb':
          return {
            id: id['#text'],
            type: typ,
          } satisfies Identifier;
        default:
          return null;
      }
    });

    const releaseDate = movieNfo.premiered
      ? Result.attempt(() => dayjs(movieNfo.premiered, 'YYYY-MM-DD')).orNull()
      : null;

    const actors = seq.collect(movieNfo.actor, (actor, idx) => {
      return {
        name: actor.name,
        role: actor.role ?? undefined,
        order: actor.order ?? idx,
        thumb: actor.thumb,
      } satisfies Actor;
    });

    const directors = seq.collect(movieNfo.director, (director) => {
      return {
        name: typeof director === 'string' ? director : director['#text'],
      } satisfies Director;
    });

    return {
      identifiers,
      originalTitle: movieNfo.originaltitle ?? null,
      plot: movieNfo.plot ?? null,
      rating: movieNfo.mpaa ?? null,
      summary: null,
      releaseDate: releaseDate ? +releaseDate : null,
      releaseDateString: releaseDate?.format() ?? null,
      sourceType: 'local',
      tagline: movieNfo.tagline ?? null,
      title: movieNfo.title,
      sortTitle: titleToSortTitle(movieNfo.title),
      uuid: v4(),
      year: releaseDate?.year() ?? null,
      actors,
      tags: movieNfo.tag ?? [],
      type: 'movie',
      directors,
      studios: movieNfo.studio ? [{ name: movieNfo.studio }] : [],
      genres: movieNfo.genre?.map((g) => ({ name: g })) ?? [],
      writers:
        movieNfo.credits?.map((c) => ({
          name: typeof c === 'string' ? c : c['#text'],
        })) ?? [],
      artwork: [], // Added later
      state: 'ok',
    };
  }

  private async findNfoFile(fullVideoFilePath: string) {
    const withNfo = path.join(
      path.dirname(fullVideoFilePath),
      path.basename(fullVideoFilePath, path.extname(fullVideoFilePath)) +
        '.nfo',
    );
    const movieNfo = path.join(path.dirname(fullVideoFilePath), 'movie.nfo');
    for (const file of [withNfo, movieNfo]) {
      const exists = await fileExists(file);
      if (exists) {
        return file;
      }
      this.logger.debug('No nfo file located at %s', file);
    }
    return;
  }

  private async scanArtworkForMovie(
    fullMoviePath: string,
    artworkType: ArtworkType,
    existingItem: Maybe<ProgramOrm & { artwork: Artwork[] }>,
    force: boolean = false,
  ) {
    const artworkPath = await this.getArtworkPath(fullMoviePath, artworkType);
    if (!artworkPath) {
      this.logger.debug(
        'Could not locate artwork type %s for file %s',
        artworkType,
        fullMoviePath,
      );
      return Result.success(undefined);
    }

    const scanResult = await this.scanArtwork(
      artworkPath,
      artworkType,
      existingItem,
      force,
    );

    scanResult.ifError((e) => {
      this.logger.error(
        e,
        'Failed to scan artwork of type %s for item %s',
        artworkType,
        fullMoviePath,
      );
    });

    return scanResult;
  }

  private async getArtworkPath(
    fullMoviePath: string,
    artworkType: ArtworkType,
  ) {
    const filename = match(artworkType)
      .with(P.union('poster', 'fanart', 'banner', 'landscape'), (s) => s)
      .otherwise(() => null);
    if (!filename) {
      return;
    }

    const folder = dirname(fullMoviePath);
    const possibleArtworkPaths = KnownImageFileExtensions.values()
      .flatMap((ext) => [
        `${filename}.${ext}`,
        `${basename(fullMoviePath, extname(fullMoviePath))}-${filename}.${ext}`,
      ])
      .map((name) => path.join(folder, name));
    let foundPath: Maybe<string>;
    for (const possiblePath of possibleArtworkPaths) {
      if (await fileExists(possiblePath)) {
        foundPath = possiblePath;
        break;
      }
    }

    // Check for folder.exr
    if (!foundPath && artworkType === 'poster') {
      const folderPaths = KnownImageFileExtensions.values()
        .map((ext) => `folder.${ext}`)
        .map((name) => path.join(folder, name));
      for (const possiblePath of folderPaths) {
        if (await fileExists(possiblePath)) {
          foundPath = possiblePath;
          break;
        }
      }
    }

    return foundPath;
  }
}
