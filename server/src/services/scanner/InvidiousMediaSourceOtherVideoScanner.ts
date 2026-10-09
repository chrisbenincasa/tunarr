import { MediaSourceType } from '@/db/schema/base.js';
import { inject, injectable } from 'inversify';
import type { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import {
  QueryError,
  type QueryResult,
} from '../../external/BaseApiClient.ts';
import type { InvidiousApiClient } from '../../external/invidious/InvidiousApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { ExternalSubtitleDownloader } from '../../stream/ExternalSubtitleDownloader.ts';
import { KEYS } from '../../types/inject.ts';
import type { InvidiousT } from '../../types/internal.ts';
import type { InvidiousOtherVideo } from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { MediaSourceOtherVideoScanner } from './MediaSourceOtherVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';
import type { GetSubtitlesRequest, ScanContext } from './MediaSourceScanner.ts';

/**
 * Scans one YouTube channel (the library's externalKey is its UC… id) through
 * Invidious. The channel listing already carries everything a program needs,
 * so unlike Plex/Jellyfin/Emby there is no per-item metadata request: a
 * channel with a thousand uploads costs ~17 listing requests, not a thousand.
 */
@injectable()
export class InvidiousMediaSourceOtherVideoScanner extends MediaSourceOtherVideoScanner<
  InvidiousT,
  InvidiousApiClient,
  InvidiousOtherVideo
> {
  readonly type = 'other_videos';
  readonly mediaSourceType = MediaSourceType.Invidious;

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

  protected getVideos(
    libraryId: string,
    context: ScanContext<InvidiousApiClient>,
  ): AsyncIterable<InvidiousOtherVideo> {
    return context.apiClient.getChannelVideos(libraryId);
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<InvidiousApiClient> {
    return this.mediaSourceApiFactory.getInvidiousApiClientForMediaSource(
      mediaSource,
    );
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<InvidiousApiClient>,
  ): Promise<number> {
    return context.apiClient.getChannelVideoCount(libraryKey);
  }

  protected scanVideo(
    _context: ScanContext<InvidiousApiClient>,
    incomingVideo: InvidiousOtherVideo,
  ): Promise<Result<InvidiousOtherVideo>> {
    return Promise.resolve(Result.success(incomingVideo));
  }

  protected scanVideoById(
    context: ScanContext<InvidiousApiClient>,
    externalKey: string,
  ): Promise<Result<InvidiousOtherVideo>> {
    return context.apiClient.getVideo(externalKey);
  }

  protected getExternalKey(video: InvidiousOtherVideo): string {
    return video.externalId;
  }

  // YouTube captions are not downloaded; the channel streams without them.
  protected getSubtitles(
    _context: ScanContext<InvidiousApiClient>,
    _request: GetSubtitlesRequest,
  ): Promise<QueryResult<string>> {
    return Promise.resolve(
      Result.failure(
        QueryError.create(
          'not_found',
          'Subtitles are not supported for Invidious sources',
        ),
      ),
    );
  }
}
