import { MediaSourceType } from '@/db/schema/base.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import type { JellyfinT } from '../../types/internal.ts';
import type { JellyfinOtherVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceOtherVideoScanner } from './MediaSourceOtherVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

@injectable()
export class JellyfinMediaSourceOtherVideoScanner extends MediaSourceOtherVideoScanner<
  JellyfinT,
  JellyfinApiClient,
  JellyfinOtherVideo
> {
  readonly type = 'other_videos';
  readonly mediaSourceType = MediaSourceType.Jellyfin;

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
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinOtherVideo> {
    return context.apiClient.getOtherVideoLibraryContents(libraryId);
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Video')
      .then((_) => _.getOrThrow());
  }

  protected async scanVideo(
    context: ScanContext<JellyfinApiClient>,
    incomingVideo: JellyfinOtherVideo,
  ): Promise<Result<JellyfinOtherVideo>> {
    const convertedItem = await context.apiClient.getItem(
      incomingVideo.externalId,
      'Video',
    );
    return convertedItem.flatMap((item) => {
      if (!item) {
        return Result.failure(
          WrappedError.forMessage(
            `Could not find Jellyfin item id ${incomingVideo.externalId}`,
          ),
        );
      } else if (item.type !== 'other_video') {
        return Result.failure(
          WrappedError.forMessage(
            `Expected item type to be other_video for ID ${incomingVideo.externalId} but got ${item.type}`,
          ),
        );
      }

      return Result.success(item);
    });
  }

  protected getExternalKey(video: JellyfinOtherVideo): string {
    return video.externalId;
  }
}
