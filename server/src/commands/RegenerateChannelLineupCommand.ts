import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { ChannelProgram } from '@tunarr/types';
import { inject, injectable, interfaces } from 'inversify';
import { match, P } from 'ts-pattern';
import { LineupItem } from '../db/derived_types/Lineup.ts';
import { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import { TVGuideService } from '../services/TvGuideService.ts';
import { KEYS } from '../types/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';

type Request = {
  channelId: string;
};

@injectable()
export class RegenerateChannelLineupCommand {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.WorkerPoolFactory)
    private workerPoolProvider: interfaces.AutoFactory<IWorkerPool>,
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

        const lineupItems = seq.collect(
          result.lineup,
          channelProgramToLineupItem,
        );

        const programIds = seq.collect(lineupItems, (item) => {
          return match(item)
            .with({ type: 'content' }, (i) => i.id)
            .otherwise(() => null);
        });

        await this.channelDB.replaceChannelPrograms(channelId, programIds);
        await this.channelDB.saveLineup(channelId, { items: lineupItems });
        // Regenerate schedule at the new start time.
      }
    }

    await this.tvGuideService.updateCachedChannel(channelId, true);
  }
}

function channelProgramToLineupItem(p: ChannelProgram) {
  return match(p)
    .returnType<LineupItem | null>()
    .with({ type: 'content', id: P.when(isNonEmptyString) }, (program) => ({
      type: 'content',
      id: program.id,
      durationMs: program.duration,
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
    }))
    .otherwise(() => null);
}
