import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { ScanContext } from '@/services/scanner/MediaSourceScanner.js';
import { inject, injectable, interfaces } from 'inversify';
import { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { PlexT } from '../../types/internal.ts';
import { PlexAlbum, PlexArtist, PlexTrack } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceMusicArtistScanner } from './MediaSourceMusicArtistScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class PlexMediaSourceMusicScanner extends MediaSourceMusicArtistScanner<
  PlexT,
  PlexArtist,
  PlexAlbum,
  PlexTrack,
  PlexApiClient
> {
  readonly mediaSourceType = 'plex';

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
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexArtist> {
    return context.apiClient.getMusicLibraryContents(libraryId);
  }

  protected getAlbums(
    show: PlexArtist,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexAlbum> {
    return context.apiClient.getArtistAlbums(show.externalId);
  }

  protected getAlbumTracks(
    season: PlexAlbum,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexTrack> {
    return context.apiClient.getAlbumTracks(season.externalId);
  }

  protected getFullTrackMetadata(
    episodeT: PlexTrack,
    context: ScanContext<PlexApiClient>,
  ): Promise<Result<PlexTrack, WrappedError>> {
    return context.apiClient.getMusicTrack(episodeT.externalId);
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<PlexApiClient> {
    return this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getEntityExternalKey(
    show: PlexArtist | PlexAlbum | PlexTrack,
  ): string {
    return show.externalId;
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<PlexApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getLibraryCount(libraryKey)
      .then((_) => _.getOrThrow());
  }
}
