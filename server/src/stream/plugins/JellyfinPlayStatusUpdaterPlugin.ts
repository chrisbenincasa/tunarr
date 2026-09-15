import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import { isContentBackedLineupItem } from '../../db/derived_types/StreamLineup.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  UpdateJellyfinPlayStatusScheduledTaskFactory} from '../../tasks/jellyfin/UpdateJellyfinPlayStatusTask.ts';
import {
  UpdateJellyfinPlayStatusScheduledTask
} from '../../tasks/jellyfin/UpdateJellyfinPlayStatusTask.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { PluginContext, ProgramStreamPlugin } from './ProgramStreamPlugin.ts';

@injectable()
export class JellyfinPlayStatusUpdaterPlugin implements ProgramStreamPlugin {
  @InjectLogger() declare private readonly logger: Logger;

  private updateStatusTask: Maybe<UpdateJellyfinPlayStatusScheduledTask>;

  constructor(
    @inject(UpdateJellyfinPlayStatusScheduledTask.KEY)
    private playStatusTaskFactory: UpdateJellyfinPlayStatusScheduledTaskFactory,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async run(context: PluginContext): Promise<Result<void>> {
    const lineupItem = context.playerContext.lineupItem;
    if (!isContentBackedLineupItem(lineupItem)) {
      return Result.void();
    }

    if (lineupItem.program.sourceType !== 'plex') {
      return Result.void();
    }

    const server = await this.mediaSourceDB.getById(
      lineupItem.program.mediaSourceId,
    );

    if (!server) {
      return Result.forError(
        new Error(
          `Unable to find server "${lineupItem.program.mediaSourceId}" specified by program.`,
        ),
      );
    }

    if (!server.sendPlayStatusUpdates) {
      return Result.void();
    }

    this.updateStatusTask = this.playStatusTaskFactory(
      server,
      {
        channelNumber: context.playerContext.sourceChannel.number,
        first: true,
        itemDuration: lineupItem.duration,
        itemId: lineupItem.program.externalKey,
        itemStartPositionMs: lineupItem.startOffset ?? 0,
      },
      v4(),
    );

    return Result.void();
  }

  shutdown(): Promise<Result<void>> {
    this.updateStatusTask?.stop();
    return Promise.resolve(Result.void());
  }
}
