import type { LineupItem } from '@/db/derived_types/Lineup.js';
import { binarySearchRange } from '@/util/binarySearch.js';
import type { ScheduledRedirectOperation } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { isNull } from 'lodash-es';
import type { LegacyChannelAndLineup } from '../../db/interfaces/IChannelDB.ts';
import { SchedulingOperator } from './SchedulingOperator.ts';

export class ScheduledRedirectOperator extends SchedulingOperator<ScheduledRedirectOperation> {
  public apply(
    channelAndLineup: LegacyChannelAndLineup,
  ): Promise<LegacyChannelAndLineup> {
    // Check if the channel length is > 1 day. If not, we will extend the channel
    // with flex time in order to add at least one 'scheduled redirect' into the
    // lineup. Otherwise, this tool really does nothing
    const { channel, lineup } = channelAndLineup;

    const newItems: LineupItem[] = [...lineup.items];
    const newOffsets = [...(lineup.startTimeOffsets ?? [])];
    const channelDuration = dayjs.duration(channel.duration);
    const redirectDuration = dayjs.duration(this.config.duration);

    if (channelDuration.asDays() < 1) {
      const diff = dayjs.duration({ days: 1 }).subtract(channelDuration);
      newItems.push({
        type: 'offline',
        durationMs: diff.asMilliseconds(),
      });
    }

    const channelStart = dayjs(channel.startTime);
    const howFar = dayjs.duration({ hours: this.config.startHour });
    const end = channelStart.add(channel.duration);

    let t0 = channelStart;
    while (t0 < end) {
      // console.log(newItems, newOffsets);
      // Find out how far into the channel we are. This is measured in days essentially
      const since = dayjs.duration(t0.diff(channelStart));
      // Then find how far into the day the redirect would start
      const redirectStart = t0.startOf('d').add(howFar);
      const untilRedirect = dayjs.duration(redirectStart.diff(t0));

      // Find the offset index of the program playing during
      // the time the redirect should start
      let idx = binarySearchRange(
        newOffsets,
        since.add(untilRedirect).asMilliseconds(),
      );

      if (!isNull(idx)) {
        // console.log(idx);
        const programStart = channelStart.add(newOffsets[idx]!);
        const untilRedirect = dayjs.duration(redirectStart.diff(programStart));

        let addedDuration = 0;
        // Add padding time to get an 'even' start for the redirect
        if (untilRedirect.asMilliseconds() > 0) {
          addedDuration += untilRedirect.asMilliseconds();
          newItems.splice(idx, 0, {
            type: 'offline',
            durationMs: untilRedirect.asMilliseconds(),
          });

          newOffsets.splice(
            idx + 1,
            0,
            newOffsets[idx]! + untilRedirect.asMilliseconds(),
          );
          idx++;
        }

        addedDuration += this.config.duration;

        // Now add the redirect
        newItems.splice(idx, 0, {
          type: 'redirect',
          channel: this.config.channelId,
          durationMs: this.config.duration,
        });

        newOffsets.splice(idx + 1, 0, newOffsets[idx]! + this.config.duration);

        // Scale the remaining offsets by the amount of duraiton we added overall
        // to the lineup (optional flex + redirect).
        for (let i = idx + 1; i < newOffsets.length; i++) {
          newOffsets[i]! += addedDuration;
        }
      }

      // Advance the iterator by a day. This only works IFF:
      // the scheduled redirect duration is < 24 hours (it should be validated)
      t0 =
        redirectDuration.asDays() > 1
          ? t0.add(redirectDuration)
          : t0.add(1, 'day');
    }

    // initial(newOffsets)?.forEach((offset, i) =>
    //   console.log(
    //     newItems[i].type,
    //     dayjs(channel.startTime).add(offset).format(),
    //     i,
    //   ),
    // );

    return Promise.resolve({
      channel,
      lineup: {
        ...lineup,
        items: newItems,
        startTimeOffsets: newOffsets,
      },
    });
  }
}
