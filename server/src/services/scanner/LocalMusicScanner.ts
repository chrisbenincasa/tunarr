import { isNonEmptyString, seq } from '@tunarr/shared/util';
import {
  Genre,
  MusicAlbumMetadata,
  MusicArtist,
  MusicArtistMetadata,
  MusicTrackMetadata,
  MusicTrackWithHierarchy,
} from '@tunarr/types';
import glob from 'fast-glob';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { chunk, compact, head, isNil, uniq, uniqBy, uniqWith } from 'lodash-es';
import { IAudioMetadata, parseStream } from 'music-metadata';
import { createReadStream, Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path, { extname } from 'node:path';
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
import { NewGenre } from '../../db/schema/Genre.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import { MusicAlbumNfoParser } from '../../nfo/MusicAlbumNfoParser.ts';
import { MusicArtistNfoParser } from '../../nfo/MusicArtistNfoParser.ts';
import { MusicAlbumNfo, MusicArtistNfo } from '../../nfo/NfoSchemas.ts';
import { FfprobeStreamDetails } from '../../stream/FfprobeStreamDetails.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { AlbumWithArtist, HasMediaSourceInfo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Maybe } from '../../types/util.ts';
import dayjs from '../../util/dayjs.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { isDefined, wait } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import { Canonicalizer } from '../Canonicalizer.ts';
import { ImageCache } from '../ImageCache.ts';
import { FallbackMetadataService } from '../local/FallbackMetadataService.ts';
import { FolderAndContents } from '../LocalFolderCanonicalizer.ts';
import { LocalMediaCanonicalizer } from '../LocalMediaCanonicalizer.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { KnownAudioFileExtensions } from './constants.ts';
import { FileSystemScanner, LocalScanContext } from './FileSystemScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

type TrackParseResult = {
  // trackDao: ProgramWithExternalIds;
  track: MusicTrackWithHierarchy;
  rawMetadata: IAudioMetadata;
};

@injectable()
export class LocalMusicScanner extends FileSystemScanner {
  #pathsComplete: number = 0;
  #pathCount: number = 0;

  private artistNfoParser = new MusicArtistNfoParser();
  private albumNfoParser = new MusicAlbumNfoParser();

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.LocalFolderCanonicalizer)
    canonicalizer: Canonicalizer<FolderAndContents>,
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
      canonicalizer,
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
          this.scanArtistFolder(showFolder, context),
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
      // Look for missing tracks.
      const existingTracks =
        await this.programDB.getProgramInfoForMediaSourceLibrary(
          context.library.uuid,
          ProgramType.Track,
        );

      const missingTracks: ProgramCanonicalIdLookupResult[] = [];
      for (const episodeChunk of chunk(Object.values(existingTracks), 100)) {
        const results = episodeChunk.map(async (movie) => {
          const exists = await fileExists(movie.externalKey);
          if (!exists) {
            return movie;
          }
          return;
        });
        missingTracks.push(...compact(await Promise.all(results)));
      }

      await this.programDB.updateProgramsState(
        missingTracks.map((track) => track.uuid),
        'missing',
      );
      await this.searchService.updatePrograms(
        missingTracks.map((track) => ({
          id: track.uuid,
          state: 'missing',
        })),
      );
    });

    return Result.all([scanResult, markMissingResult]).flatMap(() =>
      Result.void(),
    );
  }

  private async scanArtistFolder(
    artistDirent: Dirent,
    context: LocalScanContext,
  ) {
    const { library } = context;

    if (!artistDirent.isDirectory()) {
      this.logger.warn(
        'Unsupported path structure. %s is not a directory under %s',
        artistDirent.name,
        artistDirent.parentPath,
      );
      return;
    }

    const fullPath = path.join(artistDirent.parentPath, artistDirent.name);

    // TODO: add path upsert and canonical ID checking
    const { shouldScan, canonicalId, folderId, isNew } =
      await this.upsertFolder(fullPath, context, library.externalKey);
    if (!shouldScan) {
      this.logger.debug('Skipping unchanged folder %s', fullPath);
      return;
    }

    let artistResult = await this.loadArtistMetadataFromNfo(fullPath);
    if (artistResult.isFailure()) {
      this.logger.debug(
        'Could not find artist NFO at %s. Using fallback metadata',
        fullPath,
      );
      artistResult = Result.success(
        this.fallbackMetadataService.getArtistFallbackMetadata(fullPath),
      );
    }

    const artistMetadata = artistResult.get();

    // Scan artwork
    const artworkResults = await Promise.all([
      this.scanMusicArtistArtwork(fullPath, 'poster'),
      this.scanMusicArtistArtwork(fullPath, 'fanart'),
      // this.scanMusicArtistArtwork(fullPath, 'thumbnail'),
      this.scanMusicArtistArtwork(fullPath, 'banner'),
    ]);

    const artist: MusicArtist = {
      ...artistMetadata,
      canonicalId: '',
      externalId: fullPath,
      libraryId: library.uuid,
      mediaSourceId: context.mediaSource.uuid,
    };

    // Upsert the show and metadata
    artist.canonicalId = this.localMediaCanonicalizer.getCanonicalId(artist);
    const mintedShow = this.programGroupingMinter.mintForMediaSourceArtist(
      context.mediaSource,
      context.library,
      artist,
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

    artist.uuid = upsertedShow.entity.uuid;

    await this.searchService.indexMusicArtist(artist);

    // Check for album folders
    await this.scanAlbums(context, artist, artistDirent);

    if (!isNew) {
      await this.localMediaDB.setCanonicalId(folderId, canonicalId);
    }
  }

  private async scanAlbums(
    context: LocalScanContext,
    artist: MusicArtist,
    artistDir: Dirent,
  ) {
    const fullArtistDirPath = path.join(artistDir.parentPath, artistDir.name);
    const albumDirs =
      await this.getAllScannableSubdirectories(fullArtistDirPath);

    const scannedAlbums: AlbumWithArtist[] = [];
    for (const albumDir of albumDirs) {
      const fullPath = path.join(albumDir.parentPath, albumDir.name);

      const { shouldScan, canonicalId, folderId, folderResult, isNew } =
        await this.upsertFolder(fullPath, context, albumDir.parentPath);

      if (!shouldScan) {
        this.logger.debug('Skipping unchanged album folder %s', fullPath);
        continue;
      }

      const albumResult = await this.scanAlbum(
        context,
        fullPath,
        artist,
        folderResult.folder.uuid,
      );

      if (albumResult.isFailure()) {
        this.logger.warn(
          albumResult.error,
          'Failed to scan album at %s',
          fullPath,
        );
      } else {
        scannedAlbums.push(albumResult.get());
      }

      if (!isNew) {
        await this.localMediaDB.setCanonicalId(folderId, canonicalId);
      }
    }

    // Retroactively update artist genres if necessary
    const albumGenres = scannedAlbums.flatMap((album) => album.genres ?? []);
    artist.genres = uniqBy(
      (artist.genres ?? []).concat(albumGenres),
      (genre) => genre.name,
    );
    const newGenres = artist.genres.map(
      (genre) =>
        ({
          name: genre.name,
          uuid: v4(),
        }) satisfies NewGenre,
    );
    await this.programDB.upsertProgramGroupingGenres(artist.uuid, newGenres);
    await this.searchService.updatePrograms([
      {
        id: artist.uuid,
        genres: artist.genres,
      },
    ]);
  }

  private async scanAlbum(
    context: LocalScanContext,
    albumDir: string,
    artist: MusicArtist,
    albumFolderId: string,
  ): Promise<Result<AlbumWithArtist>> {
    let metadata = await this.loadAlbumMetadataFromNfo(albumDir);
    if (metadata.isFailure()) {
      this.logger.debug(
        'Could not find NFO file for album: %s. Using fallback metadata.',
        albumDir,
      );
      metadata = Result.success(
        this.fallbackMetadataService.getAlbumFallbackMetadata(albumDir),
      );
    }

    // Artwork
    const artworkResults = await Promise.all([
      this.scanMusicAlbumArtwork(albumDir, 'poster'),
    ]);

    const album: AlbumWithArtist = {
      ...metadata.get(),
      canonicalId: '',
      externalId: albumDir,
      libraryId: context.library.uuid,
      mediaSourceId: context.mediaSource.uuid,
      artist,
    };

    // We have to go back and derive some album details from the tracks
    // since the NFOs generated from various providers can be extremely
    // sparse.
    const trackResults = (
      await Result.attemptAsync(() =>
        this.scanTracks(context, artist, album, albumDir),
      )
    ).getOrElse([] as TrackParseResult[]);

    // Merge genres
    const rawGenres = uniq(
      trackResults.flatMap(
        (track) =>
          track.rawMetadata.common.genre
            ?.flatMap((g) => g.split(/[;,|]/))
            .filter(isNonEmptyString) ?? [],
      ),
    );
    const genreObjs = rawGenres.map((g) => ({ name: g }) satisfies Genre);

    album.genres = uniqWith(
      (album.genres ?? []).concat(genreObjs),
      (l, r) => l.name === r.name,
    );
    const trackWithReleaseDate = trackResults.find(
      (result) => result.track.releaseDate,
    )?.track;
    album.releaseDate ??= trackWithReleaseDate?.releaseDate ?? null;
    album.releaseDateString ??= trackWithReleaseDate?.releaseDateString ?? null;
    album.year ??= trackWithReleaseDate?.year ?? null;

    // Upsert the show and metadata
    album.canonicalId = this.localMediaCanonicalizer.getCanonicalId(artist);
    const mintedAlbum = this.programGroupingMinter.mintMusicAlbum(
      context.mediaSource,
      context.library,
      album,
    );
    mintedAlbum.programGrouping.artistUuid = artist.uuid;
    mintedAlbum.artwork.push(
      ...seq.collect(artworkResults, (result) => {
        if (result.isFailure()) {
          this.logger.error(result.error);
          return;
        }
        return result.get();
      }),
    );

    const upsertedAlbum = await this.programDB.upsertProgramGrouping(
      mintedAlbum,
      context.force,
    );

    album.uuid = upsertedAlbum.entity.uuid;

    await this.searchService.indexMusicAlbum(album);

    // Now we can mint and insert the tracks
    const tracks = trackResults.map(({ track }) => track);
    for (const track of tracks) {
      // Upserted album UUID update.
      track.album.uuid = album.uuid;
    }

    const upsertTrackTasks = tracks.map(async (track) => {
      const dao = this.programDaoMinter.mintMusicTrack(
        context.mediaSource,
        context.library,
        track,
        albumFolderId,
      );

      dao.program.albumUuid = album.uuid;
      dao.program.artistUuid = artist.uuid;
      const upsertResult = await this.programDB.upsertPrograms(dao);
      this.logger.debug(
        'Upserted track %s (ID = %s)',
        upsertResult.title,
        upsertResult.uuid,
      );
      dao.program.uuid = upsertResult.uuid;
      track.uuid = upsertResult.uuid;

      return track;
    });

    const upsertedTracks = await Promise.all(upsertTrackTasks);

    await this.searchService.indexMusicTracks(upsertedTracks);

    return Result.success(album);
  }

  private async scanTracks(
    context: LocalScanContext,
    artist: MusicArtist,
    album: AlbumWithArtist,
    fullAlbumPath: string,
  ) {
    const allSubdirents = await fs.readdir(fullAlbumPath, {
      withFileTypes: true,
      recursive: true,
    });
    const allFiles = seq.collect(allSubdirents, (dirent) => {
      if (!dirent.isFile()) {
        return;
      }
      if (!KnownAudioFileExtensions.has(extname(dirent.name))) {
        return;
      }
      if (dirent.name.startsWith('._')) {
        return;
      }
      return dirent;
    });

    const trackResults: TrackParseResult[] = [];
    for (const epFile of allFiles) {
      await wait();
      const epResult = await Result.attemptAsync(() =>
        this.scanTrack(context, artist, album, epFile),
      );

      if (epResult.isFailure()) {
        this.logger.error(
          epResult.error,
          'Failed to scan epsiode at %s%s%s',
          epFile.parentPath,
          path.sep,
          epFile.name,
        );
        continue;
      }

      const ep = epResult.get();
      if (ep) {
        trackResults.push(ep);
      }
    }

    return trackResults;
  }

  private async scanTrack(
    context: LocalScanContext,
    artist: MusicArtist,
    album: AlbumWithArtist,
    trackDirent: Dirent,
  ): Promise<Maybe<TrackParseResult>> {
    const trackPath = path.join(trackDirent.parentPath, trackDirent.name);
    const fileDetails = (await this.getMediaItem(trackPath)).getOrThrow();
    const parsedTrackMetadataResult = await Result.attemptAsync(() =>
      parseStream(createReadStream(trackPath), undefined, {
        skipCovers: true,
      }),
    );

    if (parsedTrackMetadataResult.isFailure()) {
      this.logger.warn(
        parsedTrackMetadataResult.error,
        'Unable to scan track %s',
        trackPath,
      );
      return;
    }

    const parsedTrackMetadata = parsedTrackMetadataResult.get();

    if (!isNonEmptyString(parsedTrackMetadata.common.title)) {
      this.logger.warn(
        'Skipping track file %s because metadata did not contain a title',
        trackPath,
      );
      return;
    }

    const trackNo = parsedTrackMetadata.common.track?.no;
    if (isNil(trackNo)) {
      this.logger.warn(
        'Skipping track file %s because metadata did not contain a track number',
        trackPath,
      );
      return;
    }

    const releaseDateString =
      parsedTrackMetadata.common.originaldate ??
      parsedTrackMetadata.common.releasedate ??
      null;
    const parsedReleaseDate = isNonEmptyString(releaseDateString)
      ? dayjs(releaseDateString, 'YYYY-MM-DD', true)
      : null;
    const year = parsedReleaseDate?.isValid()
      ? parsedReleaseDate.year()
      : isDefined(parsedTrackMetadata.common.year) &&
          parsedTrackMetadata.common.year > 0
        ? parsedTrackMetadata.common.year
        : null;

    const genres = uniq(
      parsedTrackMetadata.common.genre?.flatMap((genre) =>
        genre.split(/[;,|]/),
      ),
    );

    const trackMetadata: MusicTrackMetadata = {
      artwork: [],
      identifiers: [],
      originalTitle: null,
      title: parsedTrackMetadata.common.title,
      trackNumber: trackNo,
      releaseDate: parsedReleaseDate?.isValid()
        ? parsedReleaseDate.valueOf()
        : null,
      year,
      releaseDateString,
      sortTitle: parsedTrackMetadata.common.title,
      sourceType: 'local',
      state: 'ok',
      genres: genres.map((g) => ({ name: g })),
      tags: [], // What could go here?
      type: 'track',
      uuid: v4(),
    };

    const track = {
      ...trackMetadata,
      album,
      artist,
      canonicalId: '',
      artwork: [],
      duration: fileDetails.duration,
      externalId: trackPath,
      libraryId: context.library.uuid,
      mediaSourceId: context.mediaSource.uuid,
      mediaItem: fileDetails,
    } satisfies MusicTrackWithHierarchy & HasMediaSourceInfo;

    track.canonicalId = this.localMediaCanonicalizer.getCanonicalId(track);

    // We cannot insert these yet because we need to first potentially update
    // album metadata with stuff we found here. Inserting tracks relies on
    // first inserting albums due to foreign key constraints
    return {
      rawMetadata: parsedTrackMetadata,
      track,
    };
  }

  private async scanMusicArtistArtwork(
    artistFullPath: string,
    artworkType: ArtworkType,
    force: boolean = false,
  ) {
    const artworkFileNames = match(artworkType)
      .with('poster', () => ['poster', 'folder'])
      .with('fanart', () => ['fanart'])
      .with('thumbnail', () => ['thumb'])
      .with('banner', () => ['banner'])
      .otherwise(() => []);

    return await this.produceArtwork(
      artistFullPath,
      artworkType,
      artworkFileNames,
      force,
    );
  }

  private async scanMusicAlbumArtwork(
    albumFullPath: string,
    artworkType: ArtworkType,
    force: boolean = false,
  ) {
    const artworkFileNames = match(artworkType)
      .with('poster', () => ['poster', 'folder', '**/folder'])
      .with('fanart', () => ['fanart'])
      .with('thumbnail', () => ['thumb'])
      .with('banner', () => ['banner'])
      .otherwise(() => []);

    return await this.produceArtwork(
      albumFullPath,
      artworkType,
      artworkFileNames,
      force,
    );
  }

  private async loadArtistMetadataFromNfo(
    fullShowPath: string,
  ): Promise<Result<MusicArtistMetadata>> {
    const nfoFile = path.join(fullShowPath, 'artist.nfo');
    if (!(await fileExists(nfoFile))) {
      this.logger.debug(
        'No NFO file found for show at %s, using fallback metadata',
        fullShowPath,
      );
      // return Result.attemptAsync(() =>
      //   Promise.resolve(
      //     this.fallbackMetadataService.getShowFallbackMetadata(fullShowPath),
      //   ),
      // );
      return Result.failure(
        format(
          'No NFO file found for show at %s, using fallback metadata',
          fullShowPath,
        ),
      );
    }

    const metadata = await this.artistNfoParser.parseFile(nfoFile);

    if (metadata.isFailure()) {
      return Result.forError(
        new Error(
          format(
            'Error loading metadata for music artist at path: %s',
            fullShowPath,
          ),
          metadata.error,
        ),
      );
    }

    const artist = this.artistNfoToMetadata(metadata.get().artist);

    if (!artist) {
      return Result.failure(
        WrappedError.forMessage('Could not convert music artist nfo.'),
      );
    }

    return Result.success(artist);
  }

  private artistNfoToMetadata(artistNfo: MusicArtistNfo): MusicArtistMetadata {
    // const releaseDate = artistNfo.formed
    //   ? Result.attempt(() => dayjs(artistNfo.formed, 'YYYY-MM-DD')).orNull()
    //   : null;
    return {
      uuid: v4(),
      summary: artistNfo.biography ?? null,
      plot: null,
      // plot: artistNfo.plot ?? null,
      tagline: null,
      // tagline: artistNfo.tagline ?? null,
      sourceType: 'local',
      identifiers: [],
      title: artistNfo.name ?? '',
      // sortTitle: tvShowNfo.sortTitle ?? tvShowNfo.title ?? '',
      sortTitle: titleToSortTitle(artistNfo.name ?? ''),
      tags: [],
      type: 'artist',
      genres: artistNfo.genre ? artistNfo.genre.map((name) => ({ name })) : [],
      // actors: mapNfoActors(artistNfo.actor),
      // studios: [],
      // rating: artistNfo.mpaa ?? null,
      // releaseDate: releaseDate ? +releaseDate : null,
      // releaseDateString: releaseDate?.format() ?? null,
      // year: releaseDate?.year() ?? null,
      childCount: undefined,
      grandchildCount: undefined,
      artwork: [], // Added later
    };
  }

  private async loadAlbumMetadataFromNfo(
    fullAlbumPath: string,
  ): Promise<Result<MusicAlbumMetadata>> {
    let nfoFile = path.join(fullAlbumPath, 'album.nfo');
    if (!(await fileExists(nfoFile))) {
      const nestedNfoFile = head(
        await glob.async(
          glob.convertPathToPattern(fullAlbumPath) + '/**/album.nfo',
        ),
      );
      if (nestedNfoFile) {
        nfoFile = nestedNfoFile;
      } else {
        this.logger.debug(
          'No NFO file found for show at %s, using fallback metadata',
          fullAlbumPath,
        );
      }
      // return Result.attemptAsync(() =>
      //   Promise.resolve(
      //     this.fallbackMetadataService.getShowFallbackMetadata(fullShowPath),
      //   ),
      // );
    }

    const metadata = await this.albumNfoParser.parseFile(nfoFile);

    if (metadata.isFailure()) {
      return Result.forError(
        new Error(
          format(
            'Error loading metadata for music artist at path: %s',
            fullAlbumPath,
          ),
          metadata.error,
        ),
      );
    }

    const album = this.albumNfoToMetadata(metadata.get().album);

    if (!album) {
      return Result.failure(
        WrappedError.forMessage('Could not convert music album nfo.'),
      );
    }

    return Result.success(album);
  }

  private albumNfoToMetadata(albumNfo: MusicAlbumNfo): MusicAlbumMetadata {
    const releaseDate = albumNfo.releasedate
      ? Result.attempt(() =>
          dayjs(albumNfo.releasedate, 'YYYY-MM-DD', true),
        ).orNull()
      : null;
    return {
      uuid: v4(),
      summary: null,
      plot: null,
      // plot: artistNfo.plot ?? null,
      tagline: null,
      // tagline: artistNfo.tagline ?? null,
      sourceType: 'local',
      identifiers: [],
      title: albumNfo.title ?? '',
      // sortTitle: tvShowNfo.sortTitle ?? tvShowNfo.title ?? '',
      sortTitle: titleToSortTitle(albumNfo.title ?? ''),
      tags: [],
      type: 'album',
      genres: albumNfo.genre ? albumNfo.genre.map((name) => ({ name })) : [],
      // actors: mapNfoActors(artistNfo.actor),
      // studios: [],
      // rating: artistNfo.mpaa ?? null,
      // releaseDate: releaseDate ? +releaseDate : null,
      // releaseDateString: releaseDate?.format() ?? null,
      // year: releaseDate?.year() ?? null,
      childCount: undefined,
      grandchildCount: undefined,
      artwork: [], // Added later
      releaseDate: releaseDate?.isValid() ? releaseDate.valueOf() : null,
      releaseDateString: releaseDate?.isValid() ? releaseDate?.format() : null,
      year:
        releaseDate?.isValid() && releaseDate.year() > 0
          ? releaseDate.year()
          : null,
    };
  }
}
