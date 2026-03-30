import { MediaSourceType } from '@/db/schema/base.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { KEYS } from '../../types/inject.ts';
import type { EmbyT } from '../../types/internal.ts';
import type { EmbyOtherVideo } from '../../types/Media.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { JellyfinCompatibleOtherVideoScanner } from './JellyfinCompatibleOtherVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class EmbyMediaSourceOtherVideoScanner extends JellyfinCompatibleOtherVideoScanner<
  EmbyT,
  EmbyOtherVideo,
  EmbyApiClient
> {
  readonly type = 'other_videos';
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

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<EmbyApiClient> {
    return this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
      mediaSource,
    );
  }
}
