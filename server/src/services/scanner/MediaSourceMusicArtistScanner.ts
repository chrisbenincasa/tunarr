import type {
  Episode,
  Movie,
  ProgramGrouping,
  Season,
  Show,
} from '@tunarr/types';
import { differenceWith, flatten, head, round, values } from 'lodash-es';
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
import type {
  MediaSourceApiClient,
  ProgramTypeMap,
} from '../../external/MediaSourceApiClient.ts';
import type {
  AlbumWithArtist,
  HasMediaSourceAndLibraryId,
  MediaSourceMusicAlbum,
  MediaSourceMusicArtist,
  MediaSourceMusicTrack,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceScanner } from './MediaSourceScanner.ts';

export type GenericMediaSourceMusicLibraryScanner<
  ArtistT extends MediaSourceMusicArtist = MediaSourceMusicArtist,
  AlbumT extends
    MediaSourceMusicAlbum<ArtistT> = MediaSourceMusicAlbum<ArtistT>,
  TrackT extends MediaSourceMusicTrack<ArtistT, AlbumT> = MediaSourceMusicTrack<
    ArtistT,
    AlbumT
  >,
> = MediaSourceMusicArtistScanner<
  RemoteMediaSourceType,
  ArtistT,
  AlbumT,
  TrackT,
  MediaSourceApiClient<ProgramTypeMapForMusic<ArtistT, AlbumT, TrackT>>
>;

type ProgramTypeMapForMusic<
  ArtistT extends MediaSourceMusicArtist,
  AlbumT extends MediaSourceMusicAlbum<ArtistT>,
  TrackT extends MediaSourceMusicTrack<ArtistT, AlbumT>,
> = ProgramTypeMap<Movie, Show, Season, Episode, ArtistT, AlbumT, TrackT>;

export abstract class MediaSourceMusicArtistScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
  ArtistT extends MediaSourceMusicArtist,
  AlbumT extends MediaSourceMusicAlbum<ArtistT>,
  TrackT extends MediaSourceMusicTrack<ArtistT, AlbumT>,
  ApiClientTypeT extends MediaSourceApiClient<
    ProgramTypeMapForMusic<ArtistT, AlbumT, TrackT>
  >,
> extends MediaSourceScanner<'tracks', MediaSourceTypeT, ApiClientTypeT> {
  readonly type = 'tracks' as const;

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

    const { library } = context;
    const existingArtists =
      await this.programDB.getExistingProgramGroupingDetails(
        library.uuid,
        ProgramGroupingType.Artist,
        this.mediaSourceType,
      );
    const seenArtists = new Set<string>();

    const totalSize = await this.getLibrarySize(library.externalKey, context);

    for await (const artist of this.getArtists(library.externalKey, context)) {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      seenArtists.add(artist.externalId);
      const processedAmount = round(seenArtists.size / totalSize, 2) * 100.0;

      const persistedArtist = await this.scanArtist(
        artist,
        existingArtists[artist.externalId],
        context,
      );
      this.mediaSourceProgressService.scanProgress(
        library.uuid,
        processedAmount,
      );

      if (persistedArtist.isFailure()) {
        this.logger.warn(
          persistedArtist.error,
          'Failed to scan artist %s',
          artist.externalId,
        );
        continue;
      } else if (!persistedArtist.get()) {
        continue;
      }

      const scanSeasonsResult = await this.scanAlbums(
        persistedArtist.get()!,
        context,
      );

      if (scanSeasonsResult.isFailure()) {
        this.logger.warn(scanSeasonsResult.error);
      }
    }

    const missingArtists = differenceWith(
      values(existingArtists),
      [...seenArtists.values()],
      (existing, seen) => {
        return existing.externalKey === seen;
      },
    );

    const missingAlbums = flatten(
      await Promise.all(
        missingArtists.map((show) =>
          this.programDB.getChildren(show.uuid, ProgramGroupingType.Artist),
        ),
      ),
    );

    const missingTracks = flatten(
      await Promise.all(
        missingArtists.map((show) =>
          this.programDB.getProgramGroupingDescendants(
            show.uuid,
            ProgramGroupingType.Artist,
          ),
        ),
      ),
    );

    const missingAlbumIds = missingAlbums.flatMap((album) =>
      album.results.map((a) => a.uuid),
    );
    await this.programDB.updateGroupingsState(missingAlbumIds, 'missing');

    const missingTrackIds = missingTracks.map((track) => track.uuid);
    await this.programDB.updateProgramsState(missingTrackIds, 'missing');

    // Mark programs we didn't find as missing in the search index.
    await this.searchService.updatePrograms(
      missingAlbumIds
        .concat(missingTrackIds)
        .concat(missingArtists.map((artist) => artist.uuid))
        .map((id) => ({
          id,
          state: 'missing',
        })),
    );

    this.mediaSourceProgressService.scanEnded(library.uuid);
  }

  protected async scanArtist(
    incomingArtist: ArtistT,
    existingArtist: Maybe<ProgramGroupingCanonicalIdLookupResult>,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<Result<Maybe<ArtistT & HasMediaSourceAndLibraryId>>> {
    const artistResult = await context.apiClient.getMusicArtist(
      incomingArtist.externalId,
    );

    if (artistResult.isFailure()) {
      this.logger.warn(
        artistResult.error,
        'Error while querying full details for show ID %s.',
        incomingArtist.externalId,
      );
      return artistResult.recast();
    }

    const artist = artistResult.get();
    const needsDeepScan =
      context.force ||
      !existingArtist ||
      (existingArtist.canonicalId &&
        artist.canonicalId !== existingArtist.canonicalId);

    if (!needsDeepScan) {
      const existing = await this.getProgramGroupingByIdCommand.execute(
        existingArtist.uuid,
      );
      return Result.success(
        existing && this.isArtistT(existing) ? existing : undefined,
      );
    }

    this.logger.debug('Upserting artist key = %s', incomingArtist.externalId);

    const { mediaSource, library } = context;

    const groupingAndRelations =
      this.programGroupingMinter.mintForMediaSourceArtist(
        mediaSource,
        library,
        artist,
      );
    groupingAndRelations.programGrouping.libraryId = context.library.uuid;

    const upsertResult = await Result.attemptAsync(() =>
      this.programDB.upsertProgramGrouping(groupingAndRelations, context.force),
    );

    if (upsertResult.isFailure()) {
      this.logger.warn(upsertResult.error, 'Failed to upsert show');
      return upsertResult.recast();
    }

    const upsertedArtist = upsertResult.get().entity;
    const persistedArtist: ArtistT & HasMediaSourceAndLibraryId = {
      ...artist,
      uuid: upsertedArtist.uuid,
      mediaSourceId: mediaSource.uuid,
      libraryId: library.uuid,
    };

    const indexResult = await Result.attemptAsync(() =>
      this.searchService.indexMusicArtist(persistedArtist),
    );

    if (indexResult.isFailure()) {
      this.logger.warn(
        indexResult.error,
        'Failed to update search index for artist',
      );
      // Should we skip indexing the rest in this case??
      return indexResult.recast();
    }

    return Result.success(persistedArtist);
  }

  protected async scanAlbums(
    artist: ArtistT,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    return Result.attemptAsync(async () => {
      const { library } = scanContext;
      const existingAlbums =
        await this.programDB.getExistingProgramGroupingDetails(
          library.uuid,
          ProgramGroupingType.Album,
          this.mediaSourceType,
          artist.uuid,
        );

      const seenAlbums = new Set<string>();

      for await (const album of this.getAlbums(artist, scanContext)) {
        if (this.state(library.uuid) === 'canceled') {
          return;
        }

        const persistedAlbum = await this.updateAlbum(
          album,
          artist,
          existingAlbums[album.externalId],
          scanContext,
        );

        seenAlbums.add(album.externalId);

        if (persistedAlbum.isFailure()) {
          this.logger.warn(
            persistedAlbum.error,
            'Failed to scan album %s',
            album.externalId,
          );
          continue;
        } else if (!persistedAlbum.get()) {
          continue;
        }

        const scanTracksResult = await this.scanTracks(
          artist,
          persistedAlbum.get()!,
          scanContext,
        );

        if (scanTracksResult.isFailure()) {
          this.logger.warn(scanTracksResult.error);
        }
      }

      const missingSeasons = differenceWith(
        values(existingAlbums),
        [...seenAlbums.values()],
        (existing, seen) => {
          return existing.externalKey === seen;
        },
      );

      const missingTracks = flatten(
        await Promise.all(
          missingSeasons.map((track) =>
            this.programDB.getProgramGroupingDescendants(
              track.uuid,
              ProgramGroupingType.Album,
            ),
          ),
        ),
      );

      const missingAlbumIds = missingSeasons.map((season) => season.uuid);
      await this.programDB.updateGroupingsState(missingAlbumIds, 'missing');

      const missingTrackIds = missingTracks.map((track) => track.uuid);
      await this.programDB.updateProgramsState(missingTrackIds, 'missing');

      // Mark programs we didn't find as missing in the search index.
      await this.searchService.updatePrograms(
        missingAlbumIds.concat(missingTrackIds).map((id) => ({
          id,
          state: 'missing',
        })),
      );
    });
  }

  protected async updateAlbum(
    album: AlbumT,
    artist: ArtistT,
    existingAlbum: Maybe<ProgramGroupingCanonicalIdLookupResult>,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<
    Result<Maybe<AlbumWithArtist<AlbumT, ArtistT> & HasMediaSourceAndLibraryId>>
  > {
    const fullAlbumResult = await scanContext.apiClient.getMusicAlbum(
      album.externalId,
    );

    if (fullAlbumResult.isFailure()) {
      this.logger.warn(
        fullAlbumResult.error,
        'Error while querying full details for season ID %s.',
        album.externalId,
      );
      return fullAlbumResult.recast();
    }

    const fullAlbum = fullAlbumResult.get();

    const needsUpdate =
      scanContext.force ||
      !existingAlbum ||
      (existingAlbum.canonicalId &&
        fullAlbum.canonicalId !== existingAlbum.canonicalId);

    if (!needsUpdate) {
      const existing = await this.getProgramGroupingByIdCommand.execute(
        existingAlbum.uuid,
      );
      if (existing && this.isAlbumT(existing)) {
        const returnAlbum: AlbumWithArtist<AlbumT, ArtistT> &
          HasMediaSourceAndLibraryId = {
          ...existing,
          artist,
          mediaSourceId: scanContext.mediaSource.uuid,
          libraryId: scanContext.library.uuid,
        };
        return Result.success(returnAlbum);
      }

      return Result.success(undefined);
    }

    this.logger.debug('Upserting season key = %s', fullAlbum.externalId);

    const { mediaSource, library } = scanContext;

    const albumAndRelations = this.programGroupingMinter.mintMusicAlbum(
      mediaSource,
      library,
      fullAlbum,
    );

    albumAndRelations.programGrouping.libraryId = scanContext.library.uuid;
    albumAndRelations.programGrouping.showUuid = artist.uuid;

    const upsertResult = await Result.attemptAsync(() =>
      this.programDB.upsertProgramGrouping(
        albumAndRelations,
        scanContext.force,
      ),
    );

    if (upsertResult.isFailure()) {
      this.logger.warn(upsertResult.error);
      return upsertResult.recast();
    }

    album.uuid = upsertResult.get().entity.uuid;

    const persistedAlbum: AlbumWithArtist<AlbumT, ArtistT> &
      HasMediaSourceAndLibraryId = {
      ...album,
      uuid: upsertResult.get().entity.uuid,
      artist,
      mediaSourceId: mediaSource.uuid,
      libraryId: library.uuid,
    };

    const indexResult = await Result.attemptAsync(() =>
      this.searchService.indexMusicAlbum(persistedAlbum),
    );

    if (indexResult.isFailure()) {
      return indexResult.recast();
    }

    return Result.success(persistedAlbum);
  }

  protected async scanTracks(
    artist: ArtistT,
    album: AlbumWithArtist<AlbumT, ArtistT>,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    return Result.attemptAsync(async () => {
      const { mediaSource, library, force } = scanContext;
      const existing = await this.programDB.getProgramInfoForMediaSourceLibrary(
        library.uuid,
        ProgramType.Episode,
      );

      const seenTracks = new Set<string>();

      for await (const track of this.getAlbumTracks(album, scanContext)) {
        const externalKey = track.externalId;

        const fullMetadataResult = await scanContext.apiClient.getMusicTrack(
          track.externalId,
        );

        seenTracks.add(track.externalId);

        if (fullMetadataResult.isFailure()) {
          this.logger.warn(
            fullMetadataResult.error,
            'Failed to get full metadata for track %s',
            externalKey,
          );
          continue;
        }

        const fullMetadata = fullMetadataResult.get();

        if (
          !force &&
          existing[externalKey]?.canonicalId === fullMetadata.canonicalId
        ) {
          this.logger.debug(
            "Skipping track key = %s because it hasn't changed",
            externalKey,
          );
          continue;
        }

        const trackWithJoins = {
          ...fullMetadata,
          album,
          mediaSourceId: mediaSource.uuid,
          libraryId: library.uuid,
        };

        const dao = this.programMinter.mintMusicTrack(
          mediaSource,
          library,
          trackWithJoins,
        );

        dao.program.tvShowUuid = null;
        dao.program.seasonUuid = null;
        dao.program.artistUuid = artist.uuid;
        dao.program.albumUuid = album.uuid;

        const upserted = head(await this.programDB.upsertPrograms([dao]));
        if (!upserted) {
          continue;
        }

        await this.searchService.indexMusicTracks([
          { ...trackWithJoins, uuid: upserted.uuid },
        ]);
      }

      const missingTracks = differenceWith(
        values(existing),
        [...seenTracks.values()],
        (existing, seen) => {
          return existing.externalKey === seen;
        },
      );

      await this.programDB.updateProgramsState(
        missingTracks.map((movie) => movie.uuid),
        'missing',
      );

      // Mark programs we didn't find as missing in the search index.
      await this.searchService.updatePrograms(
        missingTracks.map((movie) => ({
          id: movie.uuid,
          state: 'missing',
        })),
      );
    });
  }

  protected abstract getArtists(
    libraryId: string, // TODO: Full library type?
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<ArtistT>;

  protected abstract getAlbums(
    show: ArtistT,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<AlbumT>;

  protected abstract getAlbumTracks(
    season: AlbumT,
    context: ScanContext<ApiClientTypeT>,
  ): AsyncIterable<TrackT>;

  protected getCanonicalId(entity: ArtistT | AlbumT | TrackT): string {
    return entity.canonicalId;
  }

  protected abstract getEntityExternalKey(
    show: ArtistT | AlbumT | TrackT,
  ): string;

  protected isArtistT(grouping: ProgramGrouping): grouping is ArtistT {
    return (
      grouping.sourceType === this.mediaSourceType && grouping.type === 'artist'
    );
  }

  protected isAlbumT(grouping: ProgramGrouping): grouping is AlbumT {
    return (
      grouping.sourceType === this.mediaSourceType && grouping.type === 'album'
    );
  }
}
