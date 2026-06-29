import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type { CondensedChannelProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { sum } from 'lodash-es';
import { match, P } from 'ts-pattern';
import type { LineupItem } from '../db/derived_types/Lineup.ts';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';
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
  ) {}

  async execute({ channelId }: Request) {
    const channelAndLineup =
      await this.channelDB.loadChannelAndLineupOrm(channelId);
    if (!channelAndLineup) {
      this.logger.warn('Channel ID %s not found', channelId);
      return;
    }

    if (channelAndLineup.lineup.schedule) {
      if (channelAndLineup.lineup.schedule.type === 'time') {
        const { result } = await this.workerPoolProvider().queueTask({
          type: 'time-slots',
          request: {
            type: 'channel',
            channelId,
            schedule: channelAndLineup.lineup.schedule,
            startTime: channelAndLineup.channel.startTime,
          },
        });

        const lineupItems = seq.collect<CondensedChannelProgram, LineupItem>(
          result.lineup,
          channelProgramToLineupItem,
        );

        const programIds = seq.collect(lineupItems, (item) => {
          return match(item)
            .with({ type: 'content' }, (i) => i.id)
            .otherwise(() => null);
        });

        // Regenerate schedule at the new start time.
        this.channelDB.replaceChannelPrograms(channelId, programIds);
        await this.channelDB.saveLineup(channelId, { items: lineupItems });
        await this.channelDB.updateChannelDuration(
          channelId,
          sum(lineupItems.map((item) => item.durationMs)),
        );
      } else if (channelAndLineup.lineup.schedule.type === 'random') {
        const { result } = await this.workerPoolProvider().queueTask({
          type: 'schedule-slots',
          request: {
            type: 'channel',
            channelId,
            schedule: channelAndLineup.lineup.schedule,
            startTime: channelAndLineup.channel.startTime,
          },
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

        // Regenerate schedule at the new start time.
        this.channelDB.replaceChannelPrograms(channelId, programIds);
        await this.channelDB.saveLineup(channelId, { items: lineupItems });
        await this.channelDB.updateChannelDuration(
          channelId,
          sum(lineupItems.map((item) => item.durationMs)),
        );
      }
    }

    await this.tvGuideService.updateCachedChannel(channelId, true);
  }
}

function channelProgramToLineupItem(
  p: CondensedChannelProgram,
): Nullable<LineupItem> {
  return match(p)
    .returnType<LineupItem | null>()
    .with({ type: 'content', id: P.when(isNonEmptyString) }, (program) => ({
      type: 'content',
      id: program.id,
      durationMs: program.duration,
      startOffsetMs: program.startOffsetMs,
    }))
    .with({ type: 'custom' }, (program) => ({
      type: 'content', // Custom program
      durationMs: program.duration,
      id: program.id,
      customShowId: program.customShowId,
    }))
    .with({ type: 'filler' }, (program) => ({
      type: 'content',
      durationMs: program.duration,
      id: program.id,
      fillerListId: program.fillerListId,
      fillerType: program.fillerType,
    }))
    .with({ type: 'redirect' }, (program) => ({
      type: 'redirect',
      channel: program.channel,
      durationMs: program.duration,
    }))
    .with({ type: 'flex' }, (program) => ({
      type: 'offline',
      durationMs: program.duration,
      fillerConfig: program.fillerConfig,
    }))
    .otherwise(() => null);
}
