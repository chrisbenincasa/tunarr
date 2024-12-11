import { ChannelDB } from '@/db/ChannelDB.ts';
import { Channel } from '@/db/schema/Channel.ts';
import { GlobalScheduler } from '@/services/Scheduler.ts';
import { ContentSourceUpdaterFactory } from '@/services/dynamic_channels/ContentSourceUpdaterFactory.ts';
import { Maybe } from '@/types/util.ts';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { filter } from 'lodash-es';
import { ScheduledTask } from './ScheduledTask.ts';
import { Task, TaskId } from './Task.ts';

export class ScheduleDynamicChannelsTask extends Task<void> {
  public static ID: TaskId = 'schedule-dynamic-channels';

  #channelsDb: ChannelDB;
  #taskFactory: DynamicChannelUpdaterFactory;

  public ID = ScheduleDynamicChannelsTask.ID;

  static create(
    channelsDb: ChannelDB,
    contentSourceUpdaterFactory: ContentSourceUpdaterFactory,
  ) {
    return new ScheduleDynamicChannelsTask(
      channelsDb,
      contentSourceUpdaterFactory,
    );
  }

  private constructor(
    channelsDb: ChannelDB,
    contentSourceUpdaterFactory: ContentSourceUpdaterFactory,
  ) {
    super();
    this.#channelsDb = channelsDb;
    this.#taskFactory = new DynamicChannelUpdaterFactory(
      contentSourceUpdaterFactory,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<Maybe<void>> {
    const lineups = await this.#channelsDb.loadAllLineupConfigs();
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
            () => this.#taskFactory.getTask(channel, source),
          ),
        );
        console.log('scheduling task = ' + scheduled);
      }
    }
  }
}

class DynamicChannelUpdaterFactory {
  constructor(
    private contentSourceUpdaterFactory: ContentSourceUpdaterFactory,
  ) {}

  getTask(
    channel: Channel,
    contentSourceDef: DynamicContentConfigSource,
  ): Task<unknown> {
    const factory = this.contentSourceUpdaterFactory;
    // This won't always be anonymous
    return new (class extends Task<unknown> {
      public ID = contentSourceDef.updater._id;
      // eslint-disable-next-line @typescript-eslint/require-await
      protected async runInternal() {
        return factory
          .getUpdater(contentSourceDef.type)
          .update(channel, contentSourceDef);
      }
    })();
  }
}
