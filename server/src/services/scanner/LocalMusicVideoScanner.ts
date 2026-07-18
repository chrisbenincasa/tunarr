import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { Director, MusicVideo, MusicVideoMetadata } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { chunk, compact, isNil } from 'lodash-es';
import { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path, { basename, dirname, extname } from 'node:path';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
} from '../../db/interfaces/IProgramDB.ts';
import { LocalMediaDB } from '../../db/LocalMediaDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { ArtworkType } from '../../db/schema/Artwork.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import { MusicVideoNfoParser } from '../../nfo/MusicVideoNfoParser.ts';
import { MusicVideoNfo } from '../../nfo/NfoSchemas.ts';
import { FfprobeStreamDetails } from '../../stream/FfprobeStreamDetails.ts';
import { KEYS } from '../../types/inject.ts';
import { HasMediaSourceInfo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Maybe } from '../../types/util.ts';
import { changeFileExtension, fileExists } from '../../util/fsUtil.ts';
import { isDefined, wait } from '../../util/index.ts';
import { InjectLogger } from '../../util/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import { Canonicalizer } from '../Canonicalizer.ts';
import { ImageCache } from '../ImageCache.ts';
import { FallbackMetadataService } from '../local/FallbackMetadataService.ts';
import { LocalSubtitlesService } from '../local/LocalSubtitlesService.ts';
import { FolderAndContents } from '../LocalFolderCanonicalizer.ts';
import { LocalMediaCanonicalizer } from '../LocalMediaCanonicalizer.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { KnownVideoFileExtensions } from './constants.ts';
import { FileSystemScanner, LocalScanContext } from './FileSystemScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class LocalMusicVideoScanner extends FileSystemScanner {
  #pathsComplete: number = 0;
  #queue: string[] = [];

  private nfoParser = new MusicVideoNfoParser();

  @InjectLogger() protected declare readonly logger: Logger;

  constructor(
    @inject(KEYS.LocalFolderCanonicalizer)
    canonicalizer: Canonicalizer<FolderAndContents>,
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
      ffprobeStreamDetails,
      imageCache,
      localMediaDB,
      mediaSourceProgressService,
      mediaSourceDB,
      canonicalizer,
    );
  }

  private get pathCount() {
    return this.#queue.length;
  }

  async scanPath(context: LocalScanContext): Promise<Result<void>> {
    const scanResult = await Result.attemptAsync(async () => {
      // Queue the root of the library.
      this.#queue.push(context.library.externalKey);

      const subfolders = await this.getAllScannableSubdirectories(
        context.library.externalKey,
      );

      this.#queue.push(
        ...subfolders.map((dir) => path.join(dir.parentPath, dir.name)),
      );

      const seenPaths = new Set<string>();

      while (this.#queue.length > 0) {
        if (this.state === 'canceled') {
          this.logger.debug(
            'Aborting scan for media source %s because it was canceled',
            context.mediaSource.uuid,
          );
          break;
        }

        const folder = this.#queue.shift();
        if (!folder) {
          break;
        }

        if (
          isNonEmptyString(context.pathFilter) &&
          !context.pathFilter.toLowerCase().startsWith(folder.toLowerCase())
        ) {
          continue;
        }

        this.logger.debug('Scanning directory: %s', folder);

        const result = await Result.attemptAsync(() =>
          this.scanFolder(folder, context),
        );

        if (result.isFailure()) {
          this.logger.error(
            result.error,
            'Failed to scan show directory %s',
            folder,
          );
        } else {
          result.get()?.forEach((video) => {
            seenPaths.add(video.externalId);
          });
        }

        this.#pathsComplete++;
        const pctComplete =
          this.#pathsComplete / (this.#pathsComplete + this.pathCount);
        const progressPct =
          context.percentMin + pctComplete * context.percentCompleteMultiplier;
        this.mediaSourceProgressService.scanProgress(
          context.mediaSource.uuid,
          progressPct * 100.0,
        );
      }
    });

    if (scanResult.isFailure() || this.state === 'canceled') {
      return scanResult;
    }

    // Look for missing movies.
    return Result.attemptAsync(async () => {
      if (isNonEmptyString(context.pathFilter)) {
        return;
      }
      // Look for missing movies.
      const existingMovies =
        await this.programDB.getProgramInfoForMediaSourceLibrary(
          context.library.uuid,
          ProgramType.OtherVideo,
        );

      const missingMovies: ProgramCanonicalIdLookupResult[] = [];
      for (const videoChunk of chunk(Object.values(existingMovies), 100)) {
        const results = videoChunk.map(async (movie) => {
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
  }

  private async scanFolder(fullPath: string, context: LocalScanContext) {
    const parent = dirname(fullPath);

    if (
      isNonEmptyString(context.pathFilter) &&
      !context.pathFilter.toLowerCase().startsWith(fullPath.toLowerCase())
    ) {
      return;
    }

    // Find the existing parent folder if it exists
    const parentFolder = await this.localMediaDB.findFolder(
      context.library,
      parent,
    );

    // Find the existing version of this folder
    const thisFolder = await this.localMediaDB.findFolder(
      context.library,
      fullPath,
    );

    // Get all of the files. These are used to calculate the canonicalId
    const allFiles = await fs.readdir(fullPath, { withFileTypes: true });
    const scannableSubdirs = await this.getAllScannableSubdirectories(fullPath);
    this.#queue.push(
      ...scannableSubdirs.map((dir) => path.join(dir.parentPath, dir.name)),
    );

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
        const stat = await fs.stat(fullPath);
        return {
          dirent: file,
          stats: stat,
        };
      }),
    );

    const canonicalId = this.localFolderCanonicalizer.getCanonicalId({
      contents: canonicalFilesAndStats,
      folderName: fullPath,
      folderStats: await fs.stat(fullPath),
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

    const files: MusicVideo[] = [];
    for (const file of videoFiles) {
      const result = await Result.attemptAsync(() =>
        this.scanVideoFile(file, context),
      );

      if (result.isFailure()) {
        this.logger.warn(
          result.error,
          'Failed to scan video file: %s',
          path.join(file.parentPath, file.name),
        );
      } else {
        const video = result.get();
        if (video) {
          files.push(video);
        }
      }
    }

    if (!isNew) {
      await this.localMediaDB.setCanonicalId(folderId, canonicalId);
    }
    return files;
  }

  private async scanVideoFile(
    file: Dirent,
    context: LocalScanContext,
  ): Promise<Maybe<MusicVideo>> {
    if (!file.isFile()) {
      return;
    }

    const fullFilePath = path.join(file.parentPath, file.name);
    if (
      isNonEmptyString(context.pathFilter) &&
      !context.pathFilter.toLowerCase().startsWith(fullFilePath.toLowerCase())
    ) {
      return;
    }

    await wait();

    const { mediaItem, formatTags } = (await this.getMediaItem(fullFilePath)).getOrThrow();

    if (isNil(mediaItem.duration)) {
      throw new Error(`Could not derive duration for item: ${fullFilePath}`);
    }

    const metadata = (await this.loadVideoMetadata(fullFilePath, formatTags)).getOrThrow();

    metadata.tags.push(file.parentPath);

    // Artwork
    const artworkResult = await this.scanVideoArtwork(
      file,
      'thumbnail',
      context.force,
    );

    // Subtitles
    const subtitles =
      await this.localSubtitlesService.findExternalSubtitles(fullFilePath);

    const video = {
      mediaItem,
      ...metadata,
      duration: mediaItem.duration,
      mediaSourceId: context.mediaSource.uuid,
      libraryId: context.library.uuid,
      canonicalId: '',
      externalSubtitles: subtitles.filter(
        (sub) => sub.subtitleType === 'sidecar',
      ),
      externalId: fullFilePath,
    } satisfies MusicVideo & HasMediaSourceInfo;

    video.canonicalId = this.localMediaCanonicalizer.getCanonicalId(video);

    const videoDao = this.programDaoMinter.mintMusicVideo(
      context.mediaSource,
      context.library,
      video,
    );
    artworkResult.filter(isDefined).forEach((art) => {
      videoDao.artwork ??= [];
      videoDao.artwork?.push(art);
    });

    const upsertResult = await this.programDB.upsertPrograms(videoDao);
    this.logger.debug(
      'Upserted episode %s (ID = %s)',
      upsertResult.title,
      upsertResult.uuid,
    );

    video.uuid = upsertResult.uuid;

    await this.searchService.indexMusicVideo([video]);

    return video;
  }

  private async loadVideoMetadata(
    fullVideoFilePath: string,
    formatTags?: Record<string, string>,
  ): Promise<Result<MusicVideoMetadata>> {
    const probeMeta = this.extractMetadataFromFormatTags(formatTags);
    const nfoPath = await this.findNfoFile(fullVideoFilePath);

    if (!isNonEmptyString(nfoPath)) {
      const fallback =
        this.fallbackMetadataService.getMusicVideoFallbackMetadata(
          fullVideoFilePath,
        );
      return Result.success({
        ...fallback,
        title: probeMeta.title ?? fallback.title,
        sortTitle: titleToSortTitle(probeMeta.title ?? fallback.title),
        artistName: probeMeta.artistName ?? null,
        albumName: probeMeta.albumName ?? null,
        year: probeMeta.year ?? fallback.year,
      });
    }

    const parseResult = await this.nfoParser.parse(
      await fs.readFile(nfoPath, 'utf-8'),
    );

    if (parseResult.isFailure()) {
      return parseResult.recast();
    }

    const nfoMetadata = this.nfoToMusicVideo(parseResult.get().musicvideo);

    return Result.success({
      ...nfoMetadata,
      artistName: nfoMetadata.artistName ?? probeMeta.artistName ?? null,
      albumName: nfoMetadata.albumName ?? probeMeta.albumName ?? null,
      year: nfoMetadata.year ?? probeMeta.year ?? null,
    });
  }

  private extractMetadataFromFormatTags(
    formatTags?: Record<string, string>,
  ): {
    title?: string;
    artistName?: string;
    albumName?: string;
    year?: number;
  } {
    if (formatTags === undefined) {
      return {};
    }

    const getTag = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const val =
          formatTags[key] ??
          formatTags[key.toLowerCase()] ??
          formatTags[key.toUpperCase()];
        if (val !== undefined) return val;
      }
      return undefined;
    };

    let year: number | undefined;
    const dateStr = getTag('date', 'DATE', 'year', 'YEAR');
    if (dateStr !== undefined) {
      const parsed = parseInt(dateStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        year = parsed;
      }
    }

    return {
      title: getTag('title', 'TITLE'),
      artistName: getTag(
        'artist',
        'ARTIST',
        'album_artist',
        'ALBUM_ARTIST',
      ),
      albumName: getTag('album', 'ALBUM'),
      year,
    };
  }

  private async findNfoFile(videoPath: string) {
    const nfoPath = changeFileExtension(videoPath, 'nfo');
    const exists = await fileExists(nfoPath);
    if (exists) {
      return nfoPath;
    }
    this.logger.debug('No nfo file located at %s', nfoPath);
    return;
  }

  private nfoToMusicVideo(nfo: MusicVideoNfo): MusicVideoMetadata {
    const releaseDate = nfo.premiered
      ? Result.attempt(() => dayjs(nfo.premiered, 'YYYY-MM-DD')).orNull()
      : null;

    const directors = seq.collect(nfo.director, (director) => {
      return {
        name: typeof director === 'string' ? director : director['#text'],
      } satisfies Director;
    });

    return {
      identifiers: [],
      originalTitle: null,
      releaseDate: releaseDate ? +releaseDate : null,
      releaseDateString: releaseDate?.format() ?? null,
      sourceType: 'local',
      title: nfo.title,
      sortTitle: titleToSortTitle(nfo.title),
      uuid: v4(),
      year: releaseDate?.year() ?? null,
      actors: [],
      tags: nfo.tag ?? [],
      artistName: nfo.artist?.join(', ') ?? null,
      albumName: nfo.album ?? null,
      type: 'music_video',
      directors,
      studios: nfo.studio ? [{ name: nfo.studio }] : [],
      genres: nfo.genre?.map((g) => ({ name: g })) ?? [],
      writers: [],
      artwork: [], // Added later
      state: 'ok',
    } satisfies MusicVideoMetadata;
  }

  private async scanVideoArtwork(
    file: Dirent,
    artworkType: ArtworkType,
    forceScan: boolean,
  ) {
    const artworkFileNames = match(artworkType)
      .with('thumbnail', () => ['thumb', ''])
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
      file.parentPath,
      basename(file.name, extname(file.name)),
    );
    const possibleNames = artworkFileNames.map((artName) => {
      return isNonEmptyString(artName) ? `${pathPart}-${artName}` : pathPart;
    });

    const foundPath =
      await FileSystemScanner.locateArtworkForPossibleNames(possibleNames);

    if (!foundPath) {
      this.logger.debug(
        'Could not find season artwork path at %s for art type %s',
        pathPart,
        artworkType,
      );
      return Result.success(undefined);
    }

    const scanResult = await this.scanArtwork(
      foundPath,
      artworkType,
      undefined,
      forceScan,
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
}
