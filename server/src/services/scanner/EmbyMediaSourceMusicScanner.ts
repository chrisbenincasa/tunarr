import { inject, interfaces } from 'inversify';
import { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { EmbyT } from '../../types/internal.ts';
import {
  EmbyMusicAlbum,
  EmbyMusicArtist,
  EmbyMusicTrack,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceMusicArtistScanner } from './MediaSourceMusicArtistScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { ScanContext } from './MediaSourceScanner.ts';

export class EmbyMediaSourceMusicScanner extends MediaSourceMusicArtistScanner<
  EmbyT,
  EmbyMusicArtist,
  EmbyMusicAlbum,
  EmbyMusicTrack,
  EmbyApiClient
> {
  readonly mediaSourceType = 'emby';

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
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbyMusicArtist> {
    return context.apiClient.getMusicLibraryContents(libraryId, 50);
  }

  protected getAlbums(
    show: EmbyMusicArtist,
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbyMusicAlbum> {
    return context.apiClient.getArtistAlbums(show.externalId, 50);
  }

  protected getAlbumTracks(
    season: EmbyMusicAlbum,
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbyMusicTrack> {
    return context.apiClient.getAlbumTracks(season.externalId, 50);
  }

  protected getFullTrackMetadata(
    episodeT: EmbyMusicTrack,
    context: ScanContext<EmbyApiClient>,
  ): Promise<Result<EmbyMusicTrack, WrappedError>> {
    return context.apiClient.getMusicTrack(episodeT.externalId);
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<EmbyApiClient> {
    return this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getEntityExternalKey(
    show: EmbyMusicArtist | EmbyMusicAlbum | EmbyMusicTrack,
  ): string {
    return show.externalId;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<EmbyApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'MusicArtist')
      .then((_) => _.getOrThrow());
  }
}
