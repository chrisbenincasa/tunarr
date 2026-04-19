import { inject, injectable, interfaces } from 'inversify';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceType } from '../../db/schema/base.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { QueryResult } from '../../external/BaseApiClient.ts';
import { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import { EmbyT } from '../../types/internal.ts';
import { EmbyMusicVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { EmbyScanUtil } from './EmbyScanUtil.ts';
import { MediaSourceMusicVideoScanner } from './MediaSourceMusicVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

@injectable()
export class EmbyMediaSourceMusicVideoScanner extends MediaSourceMusicVideoScanner<
  EmbyT,
  EmbyApiClient,
  EmbyMusicVideo
> {
  readonly type = 'music_videos';
  readonly mediaSourceType = MediaSourceType.Emby;

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
    @inject(ExternalSubtitleDownloader)
    externalSubtitleDownloader: ExternalSubtitleDownloader,
  ) {
    super(
      logger,
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
  ): Promise<EmbyApiClient> {
    return this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getVideos(
    libraryId: string,
    context: ScanContext<EmbyApiClient>,
  ): AsyncIterable<EmbyMusicVideo> {
    return context.apiClient.getMusicVideoLibraryContents(libraryId);
  }

  protected async getLibrarySize(
    libraryKey: string,
    context: ScanContext<EmbyApiClient>,
  ): Promise<number> {
    const _ = await context.apiClient.getChildItemCount(libraryKey, 'Video');
    return _.getOrThrow();
  }

  protected async scanVideo(
    context: ScanContext<EmbyApiClient>,
    incomingVideo: EmbyMusicVideo,
  ): Promise<Result<EmbyMusicVideo>> {
    const convertedItem = await context.apiClient.getMusicVideo(
      incomingVideo.externalId,
    );
    return convertedItem.flatMap((item) => {
      if (!item) {
        return Result.failure(
          WrappedError.forMessage(
            `Could not find Emby item id ${incomingVideo.externalId}`,
          ),
        );
      }

      return Result.success(item);
    });
  }

  protected getExternalKey(video: EmbyMusicVideo): string {
    return video.externalId;
  }

  protected getSubtitles(
    context: ScanContext<EmbyApiClient>,
    request: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    return EmbyScanUtil.getSubtitles(context, request);
  }
}
