import { MediaSourceType } from '@/db/schema/base.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import type { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import type { PlexT } from '../../types/internal.ts';
import type { PlexOtherVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceOtherVideoScanner } from './MediaSourceOtherVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

@injectable()
export class PlexMediaSourceOtherVideoScanner extends MediaSourceOtherVideoScanner<
  PlexT,
  PlexApiClient,
  PlexOtherVideo
> {
  readonly type = 'other_videos';
  readonly mediaSourceType = MediaSourceType.Plex;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
  ) {
    super(
      logger,
      mediaSourceDB,
      programDB,
      searchService,
      mediaSourceProgressService,
      programMinterFactory(),
    );
  }

  protected getVideos(
    libraryId: string,
    context: ScanContext<PlexApiClient>,
  ): AsyncIterable<PlexOtherVideo> {
    return context.apiClient.getOtherVideosLibraryContents(libraryId);
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<PlexApiClient> {
    return this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<PlexApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getLibraryCount(libraryKey)
      .then((_) => _.getOrThrow());
  }

  protected scanVideo(
    context: ScanContext<PlexApiClient>,
    incomingVideo: PlexOtherVideo,
  ): Promise<Result<PlexOtherVideo, WrappedError>> {
    return context.apiClient.getVideo(incomingVideo.externalId);
  }

  protected getExternalKey(video: PlexOtherVideo): string {
    return video.externalId;
  }
}
