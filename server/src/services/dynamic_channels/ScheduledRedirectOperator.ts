import { ScheduledRedirectOperation } from '@tunarr/types/api';
import { SchedulingOperator } from './SchedulingOperator';
import { ChannelAndLineup } from '../../dao/channelDb';
import dayjs from 'dayjs';
import { LineupItem } from '../../dao/derived_types/Lineup';

export class ScheduledRedirectOperator extends SchedulingOperator<ScheduledRedirectOperation> {
  public apply(channelAndLineup: ChannelAndLineup): Promise<ChannelAndLineup> {
    // Check if the channel length is > 1 day. If not, we will extend the channel
    // with flex time in order to add at least one 'scheduled redirect' into the
    // lineup. Otherwise, this tool really does nothing
    const { channel, lineup } = channelAndLineup;

    const newItems: LineupItem[] = [...lineup.items];
    const channelDuration = dayjs.duration(channel.duration);

    if (channelDuration.asDays() < 1) {
      const diff = dayjs.duration({ days: 1 }).subtract(channelDuration);
      newItems.push({
        type: 'offline',
        durationMs: diff.asMilliseconds(),
      });
    }

    return Promise.resolve({
      channel,
      lineup: {
        ...lineup,
        items: newItems,
      },
    });
  }
}
