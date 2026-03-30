import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/base.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { inject, injectable, interfaces } from 'inversify';
import { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { type IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { KEYS } from '../../types/inject.ts';
import { JellyfinMovie } from '../../types/Media.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { JellyfinCompatibleMovieScanner } from './JellyfinCompatibleMovieScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class JellyfinMediaSourceMovieScanner extends JellyfinCompatibleMovieScanner<
  typeof MediaSourceType.Jellyfin,
  JellyfinApiClient,
  JellyfinMovie
> {
  readonly mediaSourceType = MediaSourceType.Jellyfin;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.ProgramDaoMinterFactory)
    programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
    @inject(MediaSourceProgressService)
    mediaSourceProgressService: MediaSourceProgressService,
    @inject(MeilisearchService) searchService: MeilisearchService,
    @inject(ProgramConverter) programConverter: ProgramConverter,
  ) {
    super(
      logger,
      mediaSourceDB,
      programDB,
      mediaSourceProgressService,
      searchService,
      programConverter,
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
