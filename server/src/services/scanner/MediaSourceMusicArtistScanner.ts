import { round } from 'lodash-es';
import type { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type {
  AlbumWithArtist,
  HasMediaSourceAndLibraryId,
  MediaSourceMusicAlbum,
  MediaSourceMusicArtist,
  MediaSourceMusicTrack,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { wait } from '../../util/index.ts';
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
  MediaSourceApiClient,
  ArtistT,
  AlbumT,
  TrackT
>;

export abstract class MediaSourceMusicArtistScanner<
  MediaSourceTypeT extends RemoteMediaSourceType,
  ApiClientTypeT extends MediaSourceApiClient,
  ArtistT extends MediaSourceMusicArtist,
  AlbumT extends MediaSourceMusicAlbum<ArtistT>,
  TrackT extends MediaSourceMusicTrack<ArtistT, AlbumT>,
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
  ) {
    super(logger, mediaSourceDB);
  }

  protected async scanInternal(
    context: ScanContext<ApiClientTypeT>,
  ): Promise<void> {
    this.mediaSourceProgressService.scanStarted(context.library.uuid);

    const { library, mediaSource } = context;
    // TODO: CHeck
    // const existingShows = this.programDB.getProgramGroupingCanonicalIds(
    //   library.uuid,
    //   ProgramGroupingType.Artist,
    //   this.mediaSourceType,
    // );
    const seenShows = new Set<string>();

    const totalSize = await this.getLibrarySize(library.externalKey, context);

    for await (const artist of this.getArtists(library.externalKey, context)) {
      if (this.state(library.uuid) === 'canceled') {
        return;
      }

      seenShows.add(artist.externalId);
      const processedAmount = round(seenShows.size / totalSize, 2) * 100.0;
      // const canonicalId = this.getCanonicalId(show);

      this.mediaSourceProgressService.scanProgress(
        library.uuid,
        processedAmount,
      );

      // Get full metadata?
      const dao = this.programGroupingMinter.mintForMediaSourceArtist(
        mediaSource,
        library,
        artist,
      );

      const upsertResult = await Result.attemptAsync(() =>
        this.programDB.upsertProgramGrouping(dao, {
          externalKey: this.getEntityExternalKey(artist),
          externalSourceId: mediaSource.uuid,
          sourceType: this.mediaSourceType,
        }),
      );

      if (upsertResult.isFailure()) {
        this.logger.warn(upsertResult.error);
        continue;
      }

      const upsertedShow = upsertResult.get().entity;
      const persistedArtist: ArtistT & HasMediaSourceAndLibraryId = {
        ...artist,
        uuid: upsertedShow.uuid,
        mediaSourceId: mediaSource.uuid,
        libraryId: library.uuid,
      };

      const indexResult = await Result.attemptAsync(() =>
        this.searchService.indexMusicArtist(persistedArtist),
      );

      if (indexResult.isFailure()) {
        this.logger.warn(indexResult.error);
        // Should we skip indexing the rest in this case??
        continue;
      }

      const scanSeasonsResult = await this.scanSeasons(
        persistedArtist,
        context,
      );

      if (scanSeasonsResult.isFailure()) {
        this.logger.warn(scanSeasonsResult.error);
      }

      await wait();
    }

    this.mediaSourceProgressService.scanEnded(library.uuid);
  }

  protected async scanSeasons(
    artist: ArtistT,
    scanContext: ScanContext<ApiClientTypeT>,
  ): Promise<Result<void>> {
    return Result.attemptAsync(async () => {
      const { mediaSource, library } = scanContext;
      // const existingSeasons = await this.programDB.getArtistAlbums(artist.uuid);

      // TODO: Add seen ids
      for await (const album of this.getAlbums(artist, scanContext)) {
        if (this.state(library.uuid) === 'canceled') {
          return;
        }

        const dao = this.programGroupingMinter.mintMusicAlbum(
          mediaSource,
          library,
          album,
        );
        dao.programGrouping.libraryId = scanContext.library.uuid;
        dao.programGrouping.showUuid = artist.uuid;

        const upsertResult = await Result.attemptAsync(() =>
          this.programDB.upsertProgramGrouping(dao, {
            externalKey: this.getEntityExternalKey(album),
            externalSourceId: mediaSource.uuid,
            sourceType: this.mediaSourceType,
          }),
        );

        if (upsertResult.isFailure()) {
          this.logger.warn(upsertResult.error);
          continue;
        }

        album.uuid = upsertResult.get().entity.uuid;

        const persistedAlbum = {
          ...album,
          uuid: upsertResult.get().entity.uuid,
          artist,
          mediaSourceId: mediaSource.uuid,
          libraryId: library.uuid,
        } satisfies AlbumWithArtist<AlbumT, ArtistT>;

        await this.searchService.indexMusicAlbum(persistedAlbum);

        const scanEpisodesResult = await this.scanTracks(
          artist,
          persistedAlbum,
          scanContext,
        );

        if (scanEpisodesResult.isFailure()) {
          this.logger.warn(scanEpisodesResult.error);
        }

        await wait();
      }
    });
  }

  protected async scanTracks(
    artist: ArtistT,
    album: AlbumWithArtist<AlbumT, ArtistT>,
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
      for await (const track of this.getAlbumTracks(album, scanContext)) {
        const externalKey = this.getEntityExternalKey(track);
        if (
          !force &&
          existing[externalKey]?.canonicalId === this.getCanonicalId(track)
        ) {
          this.logger.debug(
            "Skipping episode key = %s because it hasn't changed",
            externalKey,
          );
          continue;
        }

        const fullMetadataResult = await this.getFullTrackMetadata(
          track,
          scanContext,
        );

        const upsertResult = await fullMetadataResult.flatMapAsync(
          (fullEpisode) => {
            const trackWithJoins = {
              ...fullEpisode,
              album,
              mediaSourceId: mediaSource.uuid,
              libraryId: library.uuid,
            };

            const dao = this.programMinter.mintMusicTrack(
              mediaSource,
              library,
              trackWithJoins,
            );

            dao.program.tvShowUuid = artist.uuid;
            dao.program.seasonUuid = album.uuid;

            return Result.attemptAsync(() =>
              this.programDB.upsertPrograms([dao]),
            ).then((_) =>
              _.mapAsync(([inserted]) =>
                this.searchService.indexMusicTracks([
                  { ...trackWithJoins, uuid: inserted.uuid },
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

  protected abstract getFullTrackMetadata(
    episodeT: TrackT,
    context: ScanContext<ApiClientTypeT>,
  ): Promise<Result<TrackT>>;
}
