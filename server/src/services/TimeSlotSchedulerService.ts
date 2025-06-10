import { scheduleTimeSlots } from '@tunarr/shared';
import { TimeSlotSchedule } from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { isNumber } from 'lodash-es';
import { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { KEYS } from '../types/inject.ts';

@injectable()
export class TimeSlotSchedulerService {
  constructor(@inject(KEYS.ChannelDB) private channelDB: IChannelDB) {}

  async schedule(channelId: string | number, request: TimeSlotSchedule) {
    if (isNumber(channelId)) {
      channelId = (await this.channelDB.getChannel(channelId, false))!.uuid;
    }
    const channelAndLineup =
      await this.channelDB.loadAndMaterializeLineup(channelId);
    if (!channelAndLineup) {
      throw new Error('');
    }

    const programs = channelAndLineup.programs;

    // TODO: Load other stuff that isn't part of the channel.
    return scheduleTimeSlots(request, programs);
  }
}
