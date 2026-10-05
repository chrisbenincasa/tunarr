import { inject, injectable } from 'inversify';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceId } from '../../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { MeilisearchService } from '../../services/MeilisearchService.ts';
import { KEYS } from '../../types/inject.ts';
import type { Command } from '../Command.ts';

@injectable()
export class DeleteMediaSourceCommand
  implements Command<MediaSourceId, MediaSourceWithRelations>
{
  constructor(
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MeilisearchService)
    private searchService: MeilisearchService,
    @inject(KEYS.MediaSourceApiFactory)
    private mediaSourceApiFactory: () => MediaSourceApiFactory,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
  ) {}

  async run(request: MediaSourceId): Promise<MediaSourceWithRelations> {
    const { programIds, groupingIds, deletedServer } =
      await this.mediaSourceDB.deleteMediaSource(request);
    await this.channelDB.removeProgramsFromAllLineups(programIds);
    await this.searchService.deleteByIds(programIds.concat(groupingIds));
    this.mediaSourceApiFactory().deleteCachedClient(deletedServer);
    return deletedServer;
  }
}
