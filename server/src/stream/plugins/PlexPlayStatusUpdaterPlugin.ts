import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import { isContentBackedLineupItem } from '../../db/derived_types/StreamLineup.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  UpdatePlexPlayStatusScheduledTaskFactory} from '../../tasks/plex/UpdatePlexPlayStatusTask.ts';
import {
  UpdatePlexPlayStatusScheduledTask
} from '../../tasks/plex/UpdatePlexPlayStatusTask.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { PluginContext, ProgramStreamPlugin } from './ProgramStreamPlugin.ts';

@injectable()
export class PlexPlayStatusUpdaterPlugin implements ProgramStreamPlugin {
  @InjectLogger() declare private readonly logger: Logger;

  private updatePlexStatusTask: Maybe<UpdatePlexPlayStatusScheduledTask>;

  constructor(
    @inject(UpdatePlexPlayStatusScheduledTask.KEY)
    private playStatusTaskFactory: UpdatePlexPlayStatusScheduledTaskFactory,
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

    this.updatePlexStatusTask = this.playStatusTaskFactory(
      server,
      {
        channelNumber: context.playerContext.sourceChannel.number,
        duration: lineupItem.duration,
        ratingKey: lineupItem.program.externalKey,
        startTime: lineupItem.startOffset ?? 0,
      },
      v4(),
    );

    return Result.void();
  }

  shutdown(): Promise<Result<void>> {
    this.updatePlexStatusTask?.stop();
    return Promise.resolve(Result.void());
  }
}
