import { inject, injectable } from 'inversify';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceId } from '../../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { MeilisearchService } from '../../services/MeilisearchService.ts';
import { SlotCycleBoundaryService } from '../../services/scheduling/SlotCycleBoundaryService.ts';
import { KEYS } from '../../types/inject.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { Command } from '../Command.ts';

@injectable()
export class DeleteMediaSourceCommand
  implements Command<MediaSourceId, MediaSourceWithRelations>
{
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MeilisearchService)
    private searchService: MeilisearchService,
    @inject(KEYS.MediaSourceApiFactory)
    private mediaSourceApiFactory: () => MediaSourceApiFactory,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(SlotCycleBoundaryService)
    private slotCycles: SlotCycleBoundaryService,
  ) {}

  async run(request: MediaSourceId): Promise<MediaSourceWithRelations> {
    const { programIds, groupingIds, deletedServer } =
      await this.mediaSourceDB.deleteMediaSource(request);
    const changedChannels =
      await this.channelDB.removeProgramsFromAllLineups(programIds);

    // Rebuilding slot channels replace the deleted programs after the one on
    // air. The programs are already gone, so the rebuild cannot pick them.
    for (const channelId of changedChannels) {
      try {
        await this.slotCycles.regenerateChannel(channelId);
      } catch (e) {
        this.logger.error(
          e,
          'Failed to rebuild slot cycles for channel %s after deleting a media source',
          channelId,
        );
      }
    }

    await this.searchService.deleteByIds(programIds.concat(groupingIds));
    this.mediaSourceApiFactory().deleteCachedClient(deletedServer);
    return deletedServer;
  }
}
