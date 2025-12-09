import { TvEpisodeNfo, TvShowNfo } from '@/nfo/NfoSchemas.js';
import { isNonEmptyString, seq } from '@tunarr/shared/util';
import {
  EpisodeMetadata,
  EpisodeWithHierarchy,
  SeasonMetadata,
  Show,
  ShowMetadata,
} from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import {
  chunk,
  compact,
  entries,
  groupBy,
  isNil,
  isNull,
  isUndefined,
  range,
} from 'lodash-es';
import { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path, { basename, dirname, extname } from 'node:path';
import { format } from 'node:util';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import { LocalMediaDB } from '../../db/LocalMediaDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { ArtworkType } from '../../db/schema/Artwork.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import { TvEpisodeNfoParser } from '../../nfo/TvEpisodeNfoParser.ts';
import { TvShowNfoParser } from '../../nfo/TvShowNfoParser.ts';
import { FfprobeStreamDetails } from '../../stream/FfprobeStreamDetails.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { HasMediaSourceInfo, SeasonWithShow } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { isDefined, wait } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { Canonicalizer } from '../Canonicalizer.ts';
import { ImageCache } from '../ImageCache.ts';
import { FallbackMetadataService } from '../local/FallbackMetadataService.ts';
import {
  extractSeasonAndEpisodeNumber,
  extractSeasonNumberFromFolder,
  mapNfoActors,
  mapNfoToNamedEntity,
} from '../local/localMetadataUtil.ts';
import { LocalSubtitlesService } from '../local/LocalSubtitlesService.ts';
import { FolderAndContents } from '../LocalFolderCanonicalizer.ts';
import { LocalMediaCanonicalizer } from '../LocalMediaCanonicalizer.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { KnownVideoFileExtensions } from './constants.ts';
import { FileSystemScanner, LocalScanContext } from './FileSystemScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class LocalTvShowScanner extends FileSystemScanner {
  #pathsComplete: number = 0;
  #pathCount: number = 0;

  private tvShowNfoParser = new TvShowNfoParser();
  private tvEpisodeNfoParser = new TvEpisodeNfoParser();

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.LocalFolderCanonicalizer)
    private canonicalizer: Canonicalizer<FolderAndContents>,
    @inject(LocalMediaDB) localMediaDB: LocalMediaDB,
    @inject(FfprobeStreamDetails)
    ffprobeStreamDetails: FfprobeStreamDetails,
    @inject(ImageCache) imageCache: ImageCache,
    @inject(ProgramGroupingMinter)
    private programGroupingMinter: ProgramGroupingMinter,
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
    const scanResult = await Result.attemptAsync(async () => {
      const showFolders = await this.getAllScannableSubdirectories(
        context.library.externalKey,
      );

      this.#pathCount += showFolders.length;
      for (const showFolder of showFolders) {
        if (this.state === 'canceled') {
          this.logger.debug(
            'Aborting directory scan for %s because it was canceled',
            showFolder,
          );
          return;
        }

        const fullPath = path.join(showFolder.parentPath, showFolder.name);

        if (
          isNonEmptyString(context.pathFilter) &&
          !fullPath.toLowerCase().startsWith(context.pathFilter.toLowerCase())
        ) {
          continue;
        }
        const result = await Result.attemptAsync(() =>
          this.scanShowFolder(showFolder, context),
        );

        if (result.isFailure()) {
          this.logger.error(
            result.error,
            'Failed to scan show directory %s',
            fullPath,
          );
        }

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
    });

    if (scanResult.isFailure() || this.state === 'canceled') {
      return scanResult;
    }

    const markMissingResult = await Result.attemptAsync(async () => {
      if (isNonEmptyString(context.pathFilter)) {
        return;
      }
      // Look for missing episodes.
      const existingMovies =
        await this.programDB.getProgramInfoForMediaSourceLibrary(
          context.library.uuid,
          ProgramType.Episode,
        );

      const missingMovies: ProgramCanonicalIdLookupResult[] = [];
      for (const episodeChunk of chunk(Object.values(existingMovies), 100)) {
        const results = episodeChunk.map(async (movie) => {
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

    return Result.all([scanResult, markMissingResult]).map(() => void 0);
  }

  private async scanShowFolder(showDirent: Dirent, context: LocalScanContext) {
    const { library } = context;

    if (!showDirent.isDirectory()) {
      this.logger.warn(
        'Unsupported path structure. %s is not a directory under %s',
        showDirent.name,
        showDirent.parentPath,
      );
      return;
    }

    const parentFolder = await this.localMediaDB.findFolder(
      library,
      library.externalKey,
    );
    const fullPath = path.join(showDirent.parentPath, showDirent.name);
    const thisFolder = await this.localMediaDB.findFolder(library, fullPath);

    const allFiles = await fs.readdir(fullPath, { withFileTypes: true });

    // Calculate the folder's canonical ID from its contents and update
    // the DB with the paths and ID
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

    let shouldScan = false;
    let isNew = false;
    let folderId: string;
    if (!thisFolder) {
      shouldScan = true;
      const folderResult = await this.localMediaDB.upsertFolder(
        context.library,
        parentFolder?.uuid,
        fullPath,
        canonicalId,
      );
      isNew = folderResult.isNew;
      folderId = folderResult.folder.uuid;
    } else if (thisFolder.canonicalId !== canonicalId) {
      shouldScan = true;
      folderId = thisFolder.uuid;
    } else {
      folderId = thisFolder.uuid;
    }

    shouldScan = shouldScan || context.force;

    if (!shouldScan) {
      this.logger.debug('Skipping unchanged folder %s', fullPath);
      return;
    }

    const showFolder = await this.localMediaDB.upsertFolder(
      library,
      parentFolder?.uuid,
      fullPath,
      canonicalId,
    );

    // Locate the tvshow.nfo metadata and parse
    const showResult = await this.loadTvMetadataFromNfo(fullPath);
    if (showResult.isFailure()) {
      this.logger.error(showResult.error);
      return;
    }
    const showMetadata = showResult.get();

    // Scan artwork
    const artworkResults = await Promise.all([
      this.scanShowArtwork(fullPath, 'poster'),
      this.scanShowArtwork(fullPath, 'fanart'),
      this.scanShowArtwork(fullPath, 'thumbnail'),
      this.scanShowArtwork(fullPath, 'banner'),
    ]);

    const show: Show = {
      ...showMetadata,
      canonicalId: '',
      externalId: fullPath,
      libraryId: library.uuid,
      mediaSourceId: context.mediaSource.uuid,
    };

    // Upsert the show and metadata
    show.canonicalId = this.localMediaCanonicalizer.getCanonicalId(show);
    const mintedShow = this.programGroupingMinter.mintForMediaSourceShow(
      context.mediaSource,
      context.library,
      show,
    );

    mintedShow.artwork.push(
      ...seq.collect(artworkResults, (result) => {
        if (result.isFailure()) {
          this.logger.error(result.error);
          return;
        }
        return result.get();
      }),
    );

    const upsertedShow = await this.programDB.upsertProgramGrouping(
      mintedShow,
      context.force,
    );

    show.uuid = upsertedShow.entity.uuid;

    await this.searchService.indexShow(show);

    // Check for season folders
    await this.scanSeasons(context, show, showDirent);

    // Check for flat lists
    await this.scanFlatShowDirectory(
      context,
      show,
      showDirent,
      allFiles.filter((dirent) => dirent.isFile()),
      showFolder.folder.uuid,
    );

    if (!isNew) {
      await this.localMediaDB.setCanonicalId(folderId, canonicalId);
    }
  }

  private async scanSeasons(
    context: LocalScanContext,
    show: Show,
    showDirent: Dirent,
  ) {
    const fullShowDirPath = path.join(showDirent.parentPath, showDirent.name);
    const seasonDirs =
      await this.getAllScannableSubdirectories(fullShowDirPath);

    for (const seasonDir of seasonDirs) {
      const fullPath = path.join(seasonDir.parentPath, seasonDir.name);
      const allFilesAndSubdirs = (
        await fs.readdir(fullPath, { withFileTypes: true })
      ).filter((dirent) => dirent.isFile() || dirent.isDirectory());
      const seasonNumber = extractSeasonNumberFromFolder(fullPath);

      if (isNull(seasonNumber)) {
        this.logger.debug(
          `Skipping directory %s because couldn't parse season number`,
          fullPath,
        );
        continue;
      }

      const canonicalFilesAndStats = await Promise.all(
        allFilesAndSubdirs.map(async (file) => {
          const stat = await fs.stat(path.join(file.parentPath, file.name));
          return {
            dirent: file,
            stats: stat,
          };
        }),
      );

      const canonicalId = this.canonicalizer.getCanonicalId({
        contents: canonicalFilesAndStats,
        folderName: fullPath,
        folderStats: await fs.stat(fullPath),
      });

      const parentFolder = await this.localMediaDB.findFolder(
        context.library,
        seasonDir.parentPath,
      );

      const thisFolder = await this.localMediaDB.findFolder(
        context.library,
        fullPath,
      );

      let shouldScan = false;
      let isNew = false;
      let folderId: string;
      if (!thisFolder) {
        shouldScan = true;
        const folderResult = await this.localMediaDB.upsertFolder(
          context.library,
          parentFolder?.uuid,
          fullPath,
          canonicalId,
        );
        isNew = folderResult.isNew;
        folderId = folderResult.folder.uuid;
      } else if (thisFolder.canonicalId !== canonicalId) {
        shouldScan = true;
        folderId = thisFolder.uuid;
      } else {
        folderId = thisFolder.uuid;
      }

      shouldScan = shouldScan || context.force;

      if (!shouldScan) {
        this.logger.debug('Skipping unchanged season folder %s', fullPath);
        return;
      }

      const seasonMetadata = this.seasonForNumber(show, seasonNumber);

      const season: SeasonWithShow = {
        ...seasonMetadata,
        canonicalId: '',
        externalId: fullPath,
        libraryId: context.library.uuid,
        mediaSourceId: context.mediaSource.uuid,
        show,
      };

      season.canonicalId = this.localMediaCanonicalizer.getCanonicalId(season);

      const seasonDao = this.programGroupingMinter.mintSeason(
        context.mediaSource,
        context.library,
        season,
      );
      seasonDao.programGrouping.showUuid = show.uuid;

      // Posters
      const seasonPosterResult = await this.scanSeasonArtwork(
        path.join(showDirent.parentPath, showDirent.name),
        seasonNumber,
        'poster',
        context.force,
      );

      seasonPosterResult.filter(isDefined).forEach((poster) => {
        seasonDao.artwork.push(poster);
      });

      const upsertedSeason = await this.programDB.upsertProgramGrouping(
        seasonDao,
        context.force,
      );

      season.uuid = upsertedSeason.entity.uuid;

      await this.searchService.indexSeason(season);

      const epScanResult = await Result.attemptAsync(() =>
        this.scanEpisodes(context, show, season, seasonDir, folderId),
      );

      if (epScanResult.isFailure()) {
        return;
      }

      if (!isNew) {
        await this.localMediaDB.setCanonicalId(folderId, canonicalId);
      }
    }
  }

  private async scanFlatShowDirectory(
    context: LocalScanContext,
    show: Show,
    showDirent: Dirent,
    allFiles: Dirent[],
    folderId: string,
  ) {
    const validFiles = seq.collect(allFiles, (dirent) => {
      if (!KnownVideoFileExtensions.has(extname(dirent.name))) {
        return;
      }

      if (dirent.name.startsWith('._')) {
        return;
      }

      const seasonAndEpisode = extractSeasonAndEpisodeNumber(dirent.name);
      if (!seasonAndEpisode) {
        return;
      }

      return [dirent, seasonAndEpisode] as const;
    });

    const groupedBySeason = groupBy(validFiles, ([_, { season }]) => season);

    for (const [seasonNumString, episodeFiles] of entries(groupedBySeason)) {
      const seasonNumber = parseInt(seasonNumString);
      this.logger.debug(
        'Scanning pseudo-season (flat directory) %d',
        seasonNumber,
      );

      const seasonMetadata = this.seasonForNumber(
        show,
        seasonNumber,
        episodeFiles.length,
      );

      const season: SeasonWithShow = {
        ...seasonMetadata,
        canonicalId: '',
        externalId: `${show.externalId}/_S${seasonNumber}_flat`,
        libraryId: context.library.uuid,
        mediaSourceId: context.mediaSource.uuid,
        show,
      };
      season.canonicalId = this.localMediaCanonicalizer.getCanonicalId(season);

      const seasonDao = this.programGroupingMinter.mintSeason(
        context.mediaSource,
        context.library,
        season,
      );
      seasonDao.programGrouping.showUuid = show.uuid;

      // Posters
      const seasonPosterResult = await this.scanSeasonArtwork(
        path.join(showDirent.parentPath, showDirent.name),
        seasonNumber,
        'poster',
        context.force,
      );

      seasonPosterResult.filter(isDefined).forEach((poster) => {
        seasonDao.artwork.push(poster);
      });

      const upsertedSeason = await this.programDB.upsertProgramGrouping(
        seasonDao,
        context.force,
      );
      season.uuid = upsertedSeason.entity.uuid;

      await this.searchService.indexSeason(season);

      this.logger.debug(
        'Upserted season number %d (ID = %s) for show %s (insert = %s)',
        upsertedSeason.entity.index ?? -1,
        upsertedSeason.entity.uuid,
        show.title,
        upsertedSeason.wasInserted,
      );

      for (const [episodeFile, { episodes }] of episodeFiles) {
        for (const episode of episodes) {
          const episodeResult = await Result.attemptAsync(() =>
            this.handleEpisodeFile(
              context,
              show,
              season,
              episodeFile,
              folderId,
              episode,
            ),
          );
          if (episodeResult.isFailure()) {
            this.logger.error(
              episodeResult.error,
              'Error while scanning episode file: %s',
              episodeFile.name,
            );
          }
        }
      }
    }
  }

  private async scanEpisodes(
    context: LocalScanContext,
    show: Show,
    season: SeasonWithShow,
    seasonDirent: Dirent,
    folderId: string,
  ) {
    const fullSeasonPath = path.join(
      seasonDirent.parentPath,
      seasonDirent.name,
    );
    const allSubdirents = await fs.readdir(fullSeasonPath, {
      withFileTypes: true,
      recursive: true,
    });
    const allFiles = seq.collect(allSubdirents, (dirent) => {
      if (!dirent.isFile()) {
        return;
      }
      if (!KnownVideoFileExtensions.has(extname(dirent.name))) {
        return;
      }
      if (dirent.name.startsWith('._')) {
        return;
      }
      return dirent;
    });

    for (const epFile of allFiles) {
      await wait();
      const epResult = await Result.attemptAsync(() =>
        this.handleEpisodeFile(context, show, season, epFile, folderId),
      );

      if (epResult.isFailure()) {
        this.logger.error(
          epResult.error,
          'Failed to scan epsiode at %s%s%s',
          epFile.parentPath,
          path.sep,
          epFile.name,
        );
      }
    }
  }

  private async handleEpisodeFile(
    context: LocalScanContext,
    show: Show,
    season: SeasonWithShow,
    episodeDirent: Dirent,
    folderId: string,
    episodeNumber?: number,
  ) {
    if (isUndefined(episodeNumber)) {
      const seasonAndEp = extractSeasonAndEpisodeNumber(episodeDirent.name);
      if (!seasonAndEp) {
        // Should this be a failure?
        throw new Error(
          `Could not extract episode number from filename ${episodeDirent.name}`,
        );
      }

      for (const num of seasonAndEp.episodes) {
        await this.handleEpisodeFile(
          context,
          show,
          season,
          episodeDirent,
          folderId,
          num,
        );
      }
      return;
    }

    const fullEpisodePath = path.join(
      episodeDirent.parentPath,
      episodeDirent.name,
    );

    const mediaItem = (await this.getMediaItem(fullEpisodePath)).getOrThrow();

    if (isNil(mediaItem.duration)) {
      throw new Error(`Could not derive duration for item: ${fullEpisodePath}`);
    }

    const metadata = (
      await this.loadEpisodeMetadata(fullEpisodePath, episodeNumber)
    ).getOrThrow();

    // Artwork
    const artworkResult = await this.scanEpisodeArtwork(
      episodeDirent,
      'thumbnail',
      context.force,
    );

    // Subtitles
    const subtitles =
      await this.localSubtitlesService.findExternalSubtitles(fullEpisodePath);

    const episode = {
      mediaItem,
      ...metadata,
      duration: mediaItem.duration,
      mediaSourceId: context.mediaSource.uuid,
      libraryId: context.library.uuid,
      canonicalId: '',
      externalSubtitles: subtitles.filter(
        (sub) => sub.subtitleType === 'sidecar',
      ),
      season,
      externalId: fullEpisodePath,
    } satisfies EpisodeWithHierarchy & HasMediaSourceInfo;

    episode.canonicalId = this.localMediaCanonicalizer.getCanonicalId(episode);

    const episodeDao = this.programDaoMinter.mintEpisode(
      context.mediaSource,
      context.library,
      episode,
      folderId,
    );
    artworkResult.filter(isDefined).forEach((art) => {
      episodeDao.artwork ??= [];
      episodeDao.artwork?.push(art);
    });
    episodeDao.program.tvShowUuid = show.uuid;
    episodeDao.program.seasonUuid = season.uuid;

    const upsertResult = await this.programDB.upsertPrograms(episodeDao);
    this.logger.debug(
      'Upserted episode %s (ID = %s)',
      upsertResult.title,
      upsertResult.uuid,
    );

    episode.uuid = upsertResult.uuid;

    await this.searchService.indexEpisodes([episode]);

    return;
  }

  private async loadTvMetadataFromNfo(
    fullShowPath: string,
  ): Promise<Result<ShowMetadata>> {
    const nfoFile = path.join(fullShowPath, 'tvshow.nfo');
    if (!(await fileExists(nfoFile))) {
      this.logger.debug(
        'No NFO file found for show at %s, using fallback metadata',
        fullShowPath,
      );
      return Result.attemptAsync(() =>
        Promise.resolve(
          this.fallbackMetadataService.getShowFallbackMetadata(fullShowPath),
        ),
      );
    }

    const metadata = await this.tvShowNfoParser.parseFile(nfoFile);

    if (metadata.isFailure()) {
      return Result.forError(
        new Error(
          format('Error loading metadata for show at path: %s', fullShowPath),
          metadata.error,
        ),
      );
    }

    const show = this.tvShowNfoToShow(metadata.get().tvshow);

    if (!show) {
      return Result.failure(
        WrappedError.forMessage('Could not convert show nfo.'),
      );
    }

    return Result.success(show);
  }

  private tvShowNfoToShow(tvShowNfo: TvShowNfo): ShowMetadata {
    const releaseDate = tvShowNfo.premiered
      ? Result.attempt(() => dayjs(tvShowNfo.premiered, 'YYYY-MM-DD')).orNull()
      : null;
    return {
      uuid: v4(),
      summary: null,
      plot: tvShowNfo.plot ?? null,
      tagline: tvShowNfo.tagline ?? null,
      sourceType: 'local',
      identifiers: [],
      title: tvShowNfo.title ?? '',
      // sortTitle: tvShowNfo.sortTitle ?? tvShowNfo.title ?? '',
      sortTitle: tvShowNfo.title, // TODO: derive
      tags: [],
      type: 'show',
      genres: tvShowNfo.genre ? tvShowNfo.genre.map((name) => ({ name })) : [],
      actors: mapNfoActors(tvShowNfo.actor),
      studios: [],
      rating: tvShowNfo.mpaa ?? null,
      releaseDate: releaseDate ? +releaseDate : null,
      releaseDateString: releaseDate?.format() ?? null,
      year: releaseDate?.year() ?? null,
      childCount: undefined,
      grandchildCount: undefined,
      artwork: [], // Added later
    };
  }

  private async loadEpisodeMetadata(
    fullEpisodePath: string,
    expectedEpisodeNumber: number,
  ): Promise<Result<EpisodeMetadata>> {
    const nfoPath = path.join(
      dirname(fullEpisodePath),
      basename(fullEpisodePath, extname(fullEpisodePath)) + '.nfo',
    );
    if (!(await fileExists(nfoPath))) {
      // Do fallback
      this.logger.debug(
        'No nfo file found for episode %s. Falling back to basic metadata',
        fullEpisodePath,
      );
      const title = basename(fullEpisodePath, extname(fullEpisodePath));
      return Result.success({
        episodeNumber: expectedEpisodeNumber,
        identifiers: [],
        originalTitle: null,
        releaseDate: null,
        releaseDateString: null,
        sortTitle: title, // TODO:
        sourceType: 'local',
        summary: null,
        title,
        tags: [],
        type: 'episode',
        uuid: v4(),
        year: null,
        artwork: [],
        state: 'ok',
      });
    }

    const parseResult = await this.tvEpisodeNfoParser.parseFile(nfoPath);

    return (
      parseResult
        .flatMapPure<TvEpisodeNfo>(({ episodedetails }) => {
          const matchingEpisode = episodedetails.find(
            (ep) => ep.episode === expectedEpisodeNumber,
          );
          if (!matchingEpisode) {
            return Result.failure(
              `Episode details from NFO did not match expected episode number: NFO = ${JSON.stringify(episodedetails)}, expected; ${expectedEpisodeNumber}`,
            );
          }
          return Result.success(matchingEpisode);
        })
        // .filter(isDefined)
        .mapPure((episode) => {
          const releaseDate = episode.aired
            ? Result.attempt(() => dayjs(episode.aired, 'YYYY-MM-DD')).orNull()
            : null;
          return {
            episodeNumber: expectedEpisodeNumber,
            identifiers: seq.collect(
              episode.uniqueid,
              ({ '@_type': sourceType, '#text': value }) =>
                isValidSingleExternalIdType(sourceType)
                  ? {
                      id: value,
                      type: sourceType,
                    }
                  : null,
            ),
            originalTitle: episode.title,
            releaseDate: releaseDate?.valueOf() ?? null,
            releaseDateString: releaseDate?.format() ?? null,
            sortTitle: '', // TODO
            sourceType: 'local',
            summary: episode.plot ?? null,
            tags: [],
            title: episode.title,
            type: 'episode',
            uuid: v4(),
            year: releaseDate?.year() ?? null,
            actors: mapNfoActors(episode.actor),
            directors: mapNfoToNamedEntity(episode.director),
            writers: mapNfoToNamedEntity(episode.credits),
            artwork: [], // Added later
            state: 'ok',
          } satisfies EpisodeMetadata;
        })
    );
  }

  private async scanShowArtwork(
    showFullPath: string,
    artworkType: ArtworkType,
    force: boolean = false,
  ) {
    const artworkFileNames = match(artworkType)
      .with('poster', () => ['poster', 'folder'])
      .with('fanart', () => ['fanart'])
      .with('thumbnail', () => ['thumb'])
      .with('banner', () => ['banner'])
      .otherwise(() => []);

    if (artworkFileNames.length === 0) {
      this.logger.warn(
        'Tried to scan unsupported artwork type for show: %s',
        artworkType,
      );
      return Result.success(undefined);
    }

    const artPath = await FileSystemScanner.locateArtworkInDirectory(
      showFullPath,
      artworkFileNames,
    );

    if (!artPath) {
      this.logger.debug(
        'No artwork found for %s with types %O',
        showFullPath,
        artworkFileNames,
      );
      return Result.success(undefined);
    }

    const scanResult = await this.scanArtwork(
      artPath,
      artworkType,
      undefined,
      force,
    );

    scanResult.ifError((e) => {
      this.logger.error(
        e,
        'Failed to scan artwork of type %s for item %s',
        artworkType,
        showFullPath,
      );
    });

    return scanResult;
  }

  private async scanSeasonArtwork(
    showFolderPath: string,
    seasonNumber: number,
    artworkType: ArtworkType,
    force: boolean = false,
  ) {
    const artworkFileNames = match(artworkType)
      .with('poster', () => ['poster'])
      .otherwise(() => []);
    if (artworkFileNames.length === 0) {
      this.logger.warn(
        'Tried to scan unsupported artwork type for show: %s',
        artworkType,
      );
      return Result.success(undefined);
    }

    // Try 2, 3, and 4 digit seasons.
    const possibleNames = range(2, 5)
      .flatMap((i) => [
        `season${seasonNumber.toString().padStart(i, '0')}`,
        `${seasonNumber.toString().padStart(i, '0')}`,
      ])
      .flatMap((seasonName) =>
        artworkFileNames.map((artName) =>
          path.join(showFolderPath, `${seasonName}-${artName}`),
        ),
      );

    const foundPath =
      await FileSystemScanner.locateArtworkForPossibleNames(possibleNames);

    if (!foundPath) {
      this.logger.debug(
        'Could not find season artwork path at %s for season number %d and art type %s',
        showFolderPath,
        seasonNumber,
        artworkType,
      );
      return Result.success(undefined);
    }

    const scanResult = await this.scanArtwork(
      foundPath,
      artworkType,
      undefined,
      force,
    );

    scanResult.ifError((e) => {
      this.logger.error(
        e,
        'Failed to scan artwork of type %s for item %s',
        artworkType,
        showFolderPath,
      );
    });

    return scanResult;
  }

  private async scanEpisodeArtwork(
    episodeDirent: Dirent,
    artworkType: ArtworkType,
    force: boolean = false,
  ) {
    const artworkFileNames = match(artworkType)
      .with('thumbnail', () => ['thumb'])
      .otherwise(() => []);
    if (artworkFileNames.length === 0) {
      this.logger.warn(
        'Tried to scan unsupported artwork type for show: %s',
        artworkType,
      );
      return Result.success(undefined);
    }

    // Try 2, 3, and 4 digit seasons.
    const pathPart = path.join(
      episodeDirent.parentPath,
      basename(episodeDirent.name, extname(episodeDirent.name)),
    );
    const possibleNames = artworkFileNames.map((artName) => {
      return `${pathPart}-${artName}`;
    });

    const foundPath =
      await FileSystemScanner.locateArtworkForPossibleNames(possibleNames);

    if (!foundPath) {
      this.logger.debug(
        'Could not find episode artwork path at %s for art type %s',
        pathPart,
        artworkType,
      );
      return Result.success(undefined);
    }

    const scanResult = await this.scanArtwork(
      foundPath,
      artworkType,
      undefined,
      force,
    );

    scanResult.ifError((e) => {
      this.logger.error(
        e,
        'Failed to scan artwork of type %s for item %s',
        artworkType,
        pathPart,
      );
    });

    return scanResult;
  }

  private seasonForNumber(
    show: Show,
    seasonNumber: number,
    episodeFileCount?: number,
  ): SeasonMetadata {
    return {
      // canonicalId: '',
      // externalId: '', // what do here
      index: seasonNumber,
      // libraryId: '', //
      title: `Season ${seasonNumber}`,
      tags: [],
      identifiers: [],

      plot: null,
      sourceType: 'local',
      // Can we derive this from the first episode?
      releaseDate: null,
      releaseDateString: null,
      year: null,
      type: 'season',
      studios: [],
      summary: null,
      tagline: null,
      uuid: v4(),
      sortTitle: `season ${seasonNumber.toString().padStart(4)}`,
      // mediaSourceId: '',
      childCount: episodeFileCount,
      show,
      artwork: [], // Added later
    };
  }
}
