import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type { CondensedChannelProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { isUndefined, sum } from 'lodash-es';
import { match } from 'ts-pattern';
import { condensedProgramToLineupItem } from '../db/channel/lineupItemConversion.ts';
import type { LineupItem } from '../db/derived_types/Lineup.ts';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import type { ChannelLineupLock } from '../services/ChannelLineupLock.ts';
import { SlotCycleBoundaryService } from '../services/scheduling/SlotCycleBoundaryService.ts';
import { TVGuideService } from '../services/TvGuideService.ts';
import { KEYS } from '../types/inject.ts';
import type { Nullable } from '../types/util.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';

type Request = {
  channelId: string;
};

@injectable()
export class RegenerateChannelLineupCommand {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.WorkerPoolFactory)
    private workerPoolProvider: () => IWorkerPool,
    @inject(TVGuideService) private tvGuideService: TVGuideService,
    @inject(KEYS.ChannelLineupLock) private lineupLock: ChannelLineupLock,
    @inject(SlotCycleBoundaryService)
    private boundaryService: SlotCycleBoundaryService,
  ) {}

  execute(request: Request) {
    // The lock covers the read, the rebuild and both writes. It is reentrant,
    // so a caller that already holds it -- the duration reconciler does --
    // passes straight through.
    return this.lineupLock.run(request.channelId, () =>
      this.regenerate(request),
    );
  }

  private async regenerate({ channelId }: Request) {
    const channelAndLineup =
      await this.channelDB.loadChannelAndLineupOrm(channelId);
    if (!channelAndLineup) {
      this.logger.warn('Channel ID %s not found', channelId);
      return;
    }

    const { schedule, scheduleSeed, rebuildEachCycle, onDemandConfig } =
      channelAndLineup.lineup;

    // A rebuilding channel's lineup is a run of cycles, not one loop, so it is
    // rebuilt cycle by cycle. That path writes the guide update itself. An
    // on-demand channel loops its lineup against a cursor, so it regenerates
    // the ordinary way whatever the flag says.
    if (rebuildEachCycle && schedule && isUndefined(onDemandConfig)) {
      await this.boundaryService.regenerateChannel(channelId);
      return;
    }

    if (schedule) {
      const request = {
        type: 'channel' as const,
        channelId,
        startTime: channelAndLineup.channel.startTime,
        seed: scheduleSeed,
      };

      const { result } =
        schedule.type === 'time'
          ? await this.workerPoolProvider().queueTask({
              type: 'time-slots',
              request: { ...request, schedule },
            })
          : await this.workerPoolProvider().queueTask({
              type: 'schedule-slots',
              request: { ...request, schedule },
            });

      const lineupItems = seq.collect(
        result.lineup,
        channelProgramToLineupItem,
      );

      const programIds = seq.collect(lineupItems, (item) => {
        return match(item)
          .with({ type: 'content' }, (i) => i.id)
          .otherwise(() => null);
      });

      this.channelDB.replaceChannelPrograms(channelId, programIds);
      await this.channelDB.saveLineup(channelId, {
        items: lineupItems,
        scheduleSeed: result.seed,
      });
      await this.channelDB.updateChannelDuration(
        channelId,
        sum(lineupItems.map((item) => item.durationMs)),
      );
    }

    await this.tvGuideService.updateCachedChannel(channelId, true);
  }
}

function channelProgramToLineupItem(
  p: CondensedChannelProgram,
): Nullable<LineupItem> {
  if (p.type === 'content' && !isNonEmptyString(p.id)) {
    return null;
  }
  return condensedProgramToLineupItem(p);
}
