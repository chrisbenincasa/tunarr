import { Loaded } from '@mikro-orm/core';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import filter from 'lodash-es/filter';
import { ChannelDB } from '../dao/channelDb';
import { Channel } from '../dao/entities/Channel';
import { ScheduledTask } from './ScheduledTask';
import { ContentSourceUpdaterFactory } from '../services/dynamic_channels/ContentSourceUpdaterFactory';
import { GlobalScheduler } from '../services/scheduler';
import { Maybe } from '../types/util';
import { Task, TaskId } from './Task';

export class ScheduleDynamicChannelsTask extends Task<void> {
  public static ID: TaskId = 'schedule-dynamic-channels';

  #channelsDb: ChannelDB;
  #taskFactory: DynamicChannelUpdaterFactory;

  public ID = ScheduleDynamicChannelsTask.ID;

  static create(channelsDb: ChannelDB) {
    return new ScheduleDynamicChannelsTask(channelsDb);
  }

  private constructor(channelsDb: ChannelDB) {
    super();
    this.#channelsDb = channelsDb;
    this.#taskFactory = new DynamicChannelUpdaterFactory();
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
  getTask(
    channel: Loaded<Channel>,
    contentSourceDef: DynamicContentConfigSource,
  ): Task<unknown> {
    // This won't always be anonymous
    return new (class extends Task<unknown> {
      public ID = contentSourceDef.updater._id;
      // eslint-disable-next-line @typescript-eslint/require-await
      protected async runInternal() {
        return ContentSourceUpdaterFactory.getUpdater(
          channel,
          contentSourceDef,
        ).update();
      }
    })();
  }
}
