import { inject, injectable } from 'inversify';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceType } from '../../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { QueryResult } from '../../external/BaseApiClient.ts';
import type { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { WrappedError } from '../../types/errors.ts';
import { KEYS } from '../../types/inject.ts';
import type { EmbyT } from '../../types/internal.ts';
import type { EmbyMusicVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { EmbyScanUtil } from './EmbyScanUtil.ts';
import { MediaSourceMusicVideoScanner } from './MediaSourceMusicVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

@injectable()
export class EmbyMediaSourceMusicVideoScanner extends MediaSourceMusicVideoScanner<
  EmbyT,
  EmbyApiClient,
  EmbyMusicVideo
> {
  readonly type = 'music_videos';
  readonly mediaSourceType = MediaSourceType.Emby;

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

  protected async scanVideoById(
    context: ScanContext<EmbyApiClient>,
    externalKey: string,
  ): Promise<Result<EmbyMusicVideo>> {
    const convertedItem = await context.apiClient.getMusicVideo(externalKey);
    return convertedItem.flatMap((item) => {
      if (!item) {
        return Result.failure(
          WrappedError.forMessage(`Could not find Emby item id ${externalKey}`),
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
