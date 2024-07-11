import { Tag } from '@tunarr/types';
import { Task, TaskId } from './Task';
import { ChannelDB } from '../dao/channelDb';
import { values } from 'lodash-es';
import { ActiveChannelManager } from '../stream/ActiveChannelManager';
import { OnDemandChannelService } from '../services/OnDemandChannelService';
import dayjs from 'dayjs';

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
    this.logLevel = 'debug';
  }

  protected async runInternal(): Promise<unknown> {
    const configs = await this.#channelDB.loadAllLineupConfigs();
    // TODO filter down to on-demand only...
    // const onDemandConfigs = filter(configs, ({lineup}) => isDefined(lineup.onDemandConfig));
    const stopTime = dayjs().unix() * 1000;
    for (const { channel } of values(configs)) {
      if (ActiveChannelManager.numConnectionsForChannel(channel.uuid) === 0) {
        ActiveChannelManager.scheduleChannelCleanup(channel.uuid, () => {
          this.#onDemandService
            .pauseChannel(channel.uuid, stopTime)
            .catch((e) => {
              this.logger.warn(e, 'Error pausing channel %s', channel.uuid);
            });
          this.logger.debug('Cleaning up on-demand channel: %s', channel.uuid);
        });
      }
    }

    return;
  }
}
