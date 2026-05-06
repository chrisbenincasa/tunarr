import { inject, injectable } from 'inversify';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceType } from '../../db/schema/base.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { QueryResult } from '../../external/BaseApiClient.ts';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { JellyfinT } from '../../types/internal.ts';
import { JellyfinMusicVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { InjectLogger } from '../../util/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { JellyfinScanUtil } from './JellyfinScanUtil.ts';
import { MediaSourceMusicVideoScanner } from './MediaSourceMusicVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

@injectable()
export class JellyfinMediaSourceMusicVideoScanner extends MediaSourceMusicVideoScanner<
  JellyfinT,
  JellyfinApiClient,
  JellyfinMusicVideo
> {
  readonly type = 'music_videos';
  readonly mediaSourceType = MediaSourceType.Jellyfin;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: () => ProgramDaoMinter,
    @inject(ExternalSubtitleDownloader)
    externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(
      mediaSourceDB,
      programDB,
      searchService,
      mediaSourceProgressService,
      programMinterFactory(),
      externalSubtitleDownloader,
    );
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getVideos(
    libraryId: string,
    context: ScanContext<JellyfinApiClient>,
  ): AsyncIterable<JellyfinMusicVideo> {
    return context.apiClient.getMusicVideoLibraryContents(libraryId);
  }

  protected async getLibrarySize(
    libraryKey: string,
    context: ScanContext<JellyfinApiClient>,
  ): Promise<number> {
    const _ = await context.apiClient.getChildItemCount(libraryKey, 'Video');
    return _.getOrThrow();
  }

  protected async scanVideo(
    context: ScanContext<JellyfinApiClient>,
    incomingVideo: JellyfinMusicVideo,
  ): Promise<Result<JellyfinMusicVideo>> {
    const convertedItem = await context.apiClient.getItem(
      incomingVideo.externalId,
      'MusicVideo',
    );
    return convertedItem.flatMap((item) => {
      if (!item) {
        return Result.failure(
          WrappedError.forMessage(
            `Could not find Jellyfin item id ${incomingVideo.externalId}`,
          ),
        );
      } else if (item.type !== 'music_video') {
        return Result.failure(
          WrappedError.forMessage(
            `Expected item type to be music_video for ID ${incomingVideo.externalId} but got ${item.type}`,
          ),
        );
      }

      return Result.success(item);
    });
  }

  protected getExternalKey(video: JellyfinMusicVideo): string {
    return video.externalId;
  }

  protected getSubtitles(
    context: ScanContext<JellyfinApiClient>,
    request: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    return JellyfinScanUtil.getSubtitles(context, request);
  }
}
