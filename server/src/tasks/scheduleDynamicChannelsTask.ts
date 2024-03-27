import { isNull, isUndefined } from 'lodash-es';
import filter from 'lodash-es/filter';
import { ChannelDB } from '../dao/channelDb';
import { withDb } from '../dao/dataSource';
import { DynamicContentConfigSource } from '../dao/derived_types/Lineup';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings';
import { Plex } from '../plex';
import { ScheduledTask } from '../services/ScheduledTask';
import { GlobalScheduler } from '../services/scheduler';
import { Maybe } from '../types';
import { Task, TaskId } from './task';

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
      (lineup) => !isUndefined(lineup.lineup.dynamicContentConfig),
    );

    for (const { channel, lineup } of dynamicLineups) {
      for (const source of lineup.dynamicContentConfig!.contentSources) {
        const scheduled = GlobalScheduler.scheduleTask(
          source.updater._id,
          new ScheduledTask(
            'UpdateDynamicChannel',
            source.updater.schedule,
            () => this.#taskFactory.getTask(source),
          ),
        );
        console.log('scheduling task = ' + scheduled);
      }
    }
  }
}

class DynamicChannelUpdaterFactory {
  getTask(contentSourceDef: DynamicContentConfigSource): Task<unknown> {
    // This won't always be anonymous
    return new (class extends Task<unknown> {
      public ID = contentSourceDef.updater._id;
      public taskName = `AnonymousTest_` + contentSourceDef.updater._id;
      // eslint-disable-next-line @typescript-eslint/require-await
      protected async runInternal() {
        switch (contentSourceDef.type) {
          case 'plex': {
            const result = await withDb((em) => {
              return em.repo(PlexServerSettings).findOne({
                $or: [
                  { name: contentSourceDef.plexServerId },
                  { clientIdentifier: contentSourceDef.plexServerId },
                ],
              });
            });

            if (isNull(result)) {
              console.error('Couldnt find Plex server oooooo');
              return;
            }

            const plex = new Plex(result);
            const plexResult = await plex.doGet(
              `/library/sections/${contentSourceDef.query?.libraryKey ?? ''}`,
            );
            console.log(plexResult);
          }
        }
      }
    })();
  }
}
