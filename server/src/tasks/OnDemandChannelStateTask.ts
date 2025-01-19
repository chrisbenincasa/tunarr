import { ChannelDB } from '@/db/ChannelDB.js';
import { serverContext } from '@/serverContext.js';
import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { Tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { every, values } from 'lodash-es';
import { Task, TaskId } from './Task.ts';

/**
 * Checks all on-demand channels for whether there are active watchers.
 * If there are no active watchers, a cleanup is scheduled to deactive the channel.
 */
export class OnDemandChannelStateTask extends Task {
  #channelDB: ChannelDB;
  #onDemandService: OnDemandChannelService;

  public ID: string | Tag<TaskId, unknown> = 'on-demand-channel-state';
  static ID: TaskId = 'on-demand-channel-state';

  constructor(channelDB: ChannelDB = new ChannelDB()) {
    super();
    this.#channelDB = channelDB;
    this.#onDemandService = new OnDemandChannelService(this.#channelDB);
  }

  protected async runInternal(): Promise<unknown> {
    const configs = await this.#channelDB.loadAllLineupConfigs();
    // TODO filter down to on-demand only...
    // const onDemandConfigs = filter(configs, ({lineup}) => isDefined(lineup.onDemandConfig));
    const stopTime = +dayjs();
    for (const { channel } of values(configs)) {
      const allChannelSessions =
        serverContext().sessionManager.getAllSessionsForChannel(channel.uuid);
      if (
        every(allChannelSessions, (session) => session.numConnections() === 0)
      ) {
        this.#onDemandService
          .pauseChannel(channel.uuid, stopTime)
          .catch((e) => {
            this.logger.warn(e, 'Error pausing channel %s', channel.uuid);
          });
      }
    }

    return;
  }
}
