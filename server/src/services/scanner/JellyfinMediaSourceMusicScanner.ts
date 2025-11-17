import { inject, interfaces } from 'inversify';
import { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { JellyfinT } from '../../types/internal.ts';
import {
  JellyfinMusicAlbum,
  JellyfinMusicArtist,
  JellyfinMusicTrack,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceMusicArtistScanner } from './MediaSourceMusicArtistScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { ScanContext } from './MediaSourceScanner.ts';

export class JellyfinMediaSourceMusicScanner extends MediaSourceMusicArtistScanner<
  JellyfinT,
  JellyfinMusicArtist,
  JellyfinMusicAlbum,
  JellyfinMusicTrack,
  JellyfinApiClient
> {
  readonly mediaSourceType = 'jellyfin';

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
    @inject(ProgramGroupingMinter)
    programGroupingMinter: ProgramGroupingMinter,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(GetProgramGroupingById)
    getProgramGroupingsById: GetProgramGroupingById,
  ) {
    super(
      logger,
      mediaSourceDB,
      programDB,
      programGroupingMinter,
      programMinterFactory(),
      searchService,
      mediaSourceProgressService,
      getProgramGroupingsById,
    );
  }

  protected getArtists(
    libraryId: string,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinMusicArtist> {
    return context.apiClient.getMusicLibraryContents(libraryId, 50);
  }

  protected getAlbums(
    show: JellyfinMusicArtist,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinMusicAlbum> {
    return context.apiClient.getArtistAlbums(show.externalId, 50);
  }

  protected getAlbumTracks(
    season: JellyfinMusicAlbum,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinMusicTrack> {
    return context.apiClient.getAlbumTracks(season.externalId, 50);
  }

  protected getFullTrackMetadata(
    episodeT: JellyfinMusicTrack,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<Result<JellyfinMusicTrack, WrappedError>> {
    return context.apiClient.getMusicTrack(episodeT.externalId);
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getEntityExternalKey(
    show: JellyfinMusicArtist | JellyfinMusicAlbum | JellyfinMusicTrack,
  ): string {
    return show.externalId;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'MusicArtist')
      .then((_) => _.getOrThrow());
  }
}
