import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { SessionManager } from '@/stream/SessionManager.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { Tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { every, values } from 'lodash-es';
import { SimpleTask, TaskId } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

/**
 * Checks all on-demand channels for whether there are active watchers.
 * If there are no active watchers, a cleanup is scheduled to deactive the channel.
 */
@injectable()
@simpleTaskDef()
export class OnDemandChannelStateTask extends SimpleTask {
  static KEY = Symbol.for(OnDemandChannelStateTask.name);

  public ID: string | Tag<TaskId, unknown> = 'on-demand-channel-state';
  static ID: TaskId = 'on-demand-channel-state';

  constructor(
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(OnDemandChannelService)
    private onDemandService: OnDemandChannelService,
    @inject(SessionManager) private sessionManager: SessionManager,
    @inject(KEYS.Logger) logger: Logger,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<void> {
    const configs = await this.channelDB.loadAllLineupConfigs();
    // TODO filter down to on-demand only...
    const stopTime = +dayjs();
    for (const { channel } of values(configs)) {
      const allChannelSessions = this.sessionManager.getAllSessionsForChannel(
        channel.uuid,
      );
      if (
        every(allChannelSessions, (session) => session.numConnections() === 0)
      ) {
        this.onDemandService.pauseChannel(channel.uuid, stopTime).catch((e) => {
          this.logger.warn(e, 'Error pausing channel %s', channel.uuid);
        });
      }
    }

    return;
  }
}
