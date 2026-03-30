import { inject, injectable, interfaces } from 'inversify';
import { GetProgramGroupingById } from '../../commands/GetProgramGroupingById.ts';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { KEYS } from '../../types/inject.ts';
import { JellyfinT } from '../../types/internal.ts';
import {
  JellyfinMusicAlbum,
  JellyfinMusicArtist,
  JellyfinMusicTrack,
} from '../../types/Media.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { MeilisearchService } from '../MeilisearchService.ts';
import { JellyfinCompatibleMusicScanner } from './JellyfinCompatibleMusicScanner.ts';
import { MediaSourceProgressService } from './MediaSourceProgressService.ts';

@injectable()
export class JellyfinMediaSourceMusicScanner extends JellyfinCompatibleMusicScanner<
  JellyfinT,
  JellyfinMusicArtist,
  JellyfinMusicAlbum,
  JellyfinMusicTrack,
  JellyfinApiClient
> {
  readonly mediaSourceType = 'jellyfin';

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

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<JellyfinApiClient> {
    return this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
      mediaSource,
    );
  }
}
