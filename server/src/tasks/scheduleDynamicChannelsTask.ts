import { Loaded } from '@mikro-orm/core';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { isUndefined } from 'lodash-es';
import filter from 'lodash-es/filter';
import { ChannelDB } from '../dao/channelDb';
import { Channel } from '../dao/entities/Channel';
import { ScheduledTask } from './ScheduledTask';
import { ContentSourceUpdaterFactory } from '../services/dynamic_channels/ContentSourceUpdaterFactory';
import { GlobalScheduler } from '../services/scheduler';
import { Maybe } from '../types';
import { Task, TaskId } from './Task';

export class ScheduleDynamicChannelsTask extends Task<void> {
  public static ID: TaskId = 'schedule-dynamic-channels';

  #channelsDb: ChannelDB;
  #taskFactory: DynamicChannelUpdaterFactory;

  public ID = ScheduleDynamicChannelsTask.ID;
  public taskName = ScheduleDynamicChannelsTask.name;

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
    const lineups = await this.#channelsDb.loadAllLineups();
    const dynamicLineups = filter(
      lineups,
      ({ lineup }) =>
        !isUndefined(lineup.dynamicContentConfig) &&
        lineup.dynamicContentConfig.enabled,
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
      public taskName = `AnonymousTest_` + contentSourceDef.updater._id;
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
