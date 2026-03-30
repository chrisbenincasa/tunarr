import { MediaSourceType } from '@/db/schema/base.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { KEYS } from '../../types/inject.ts';
import type { JellyfinT } from '../../types/internal.ts';
import type { JellyfinOtherVideo } from '../../types/Media.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { JellyfinCompatibleOtherVideoScanner } from './JellyfinCompatibleOtherVideoScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class JellyfinMediaSourceOtherVideoScanner extends JellyfinCompatibleOtherVideoScanner<
  JellyfinT,
  JellyfinOtherVideo,
  JellyfinApiClient
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

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }
}
