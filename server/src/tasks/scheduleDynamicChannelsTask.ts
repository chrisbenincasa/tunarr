import { isUndefined } from 'lodash-es';
import filter from 'lodash-es/filter';
import { ChannelDB } from '../dao/channelDb';
import { Maybe } from '../types';
import { Task, TaskId } from './task';

export class ScheduleDynamiChannelsTask extends Task<void> {
  public static ID: TaskId = 'schedule-dynamic-channels';

  #channelsDb: ChannelDB;

  public ID = ScheduleDynamiChannelsTask.ID;
  public taskName = ScheduleDynamiChannelsTask.name;

  static create(channelsDb: ChannelDB) {
    return new ScheduleDynamiChannelsTask(channelsDb);
  }

  private constructor(channelsDb: ChannelDB) {
    super();
    this.#channelsDb = channelsDb;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<Maybe<void>> {
    const lineups = await this.#channelsDb.loadAllLineups();
    const dynamicLineups = filter(
      lineups,
      (lineup) => !isUndefined(lineup.lineup.dynamicContentConfig),
    );
  }
}
