import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { filter } from 'lodash-es';
import { DynamicChannelUpdaterFactory } from './DynamicChannelUpdaterFactory.ts';
import { ScheduledTask } from './ScheduledTask.ts';
import { Task, TaskId } from './Task.ts';

@injectable()
export class ScheduleDynamicChannelsTask extends Task {
  public static KEY = Symbol.for(ScheduleDynamicChannelsTask.name);
  public static ID: TaskId = 'schedule-dynamic-channels';

  public ID = ScheduleDynamicChannelsTask.ID;

  constructor(
    @inject(KEYS.ChannelDB) private channelsDb: IChannelDB,
    @inject(KEYS.Logger) logger: Logger,
    @inject(DynamicChannelUpdaterFactory)
    private taskFactory: DynamicChannelUpdaterFactory,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<Maybe<void>> {
    const lineups = await this.channelsDb.loadAllLineupConfigs();
    const dynamicLineups = filter(
      lineups,
      ({ lineup }) => lineup.dynamicContentConfig?.enabled === true,
    );

    for (const { channel, lineup } of dynamicLineups) {
      for (const source of lineup.dynamicContentConfig!.contentSources) {
        if (!source.enabled) {
          continue;
        }
        const scheduled = GlobalScheduler.scheduleTask(
          source.updater._id,
          new ScheduledTask(
            'UpdateDynamicChannel',
            source.updater.schedule,
            () => this.taskFactory.getTask(channel, source),
            [],
          ),
        );
        console.log('scheduling task = ' + scheduled);
      }
    }
  }
}
