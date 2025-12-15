import type { LineupItem } from '@/db/derived_types/Lineup.js';
import type { Channel } from '@/db/schema/Channel.js';
import { scale } from '@/util/index.js';
import type { AddPaddingOperation } from '@tunarr/types/api';
import dayjs from 'dayjs';
import {
  find,
  flatMap,
  forEach,
  isEmpty,
  isNull,
  reject,
  sortBy,
} from 'lodash-es';
import type { LegacyChannelAndLineup } from '../../db/interfaces/IChannelDB.ts';
import { SchedulingOperator } from './SchedulingOperator.ts';

export class PadProgramsSchedulingOperator extends SchedulingOperator<AddPaddingOperation> {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async apply({
    channel,
    lineup,
  }: LegacyChannelAndLineup): Promise<LegacyChannelAndLineup> {
    const { newStartTime, newProgramList } = this.padStartTimes(
      channel,
      lineup.items,
    );

    if (!isNull(newStartTime)) {
      channel.startTime = newStartTime;
    }

    return {
      channel,
      lineup: {
        ...lineup,
        items: newProgramList,
      },
    };
  }

  // TODO: This is some duplicated code from the frontend
  private padStartTimes(channel: Channel, programs: readonly LineupItem[]) {
    const modMins = this.config.mod;
    const mod = modMins * 60 * 1000;
    const startTime = dayjs(channel.startTime).unix() * 1000;
    const newStartTime = this.config.alignChannelStartTime
      ? startTime - (startTime % mod)
      : startTime;
    const filteredPrograms = reject(programs, (p) => p.type === 'offline');

    const manualOffsets = sortBy(
      scale(
        flatMap(this.config.allowedOffsets, (off) => [off, off + modMins]),
        60 * 1000,
      ),
    );

    let lastStartTime = newStartTime;
    const newProgramList: LineupItem[] = [];

    const startPad = newStartTime % mod;
    // If we're not going to realign the start of the channel
    // we will add padding to start programming on the next allowed
    // offset. TODO: This doesn't take manual offsets into account
    if (startPad !== 0) {
      newProgramList.push({
        type: 'offline',
        durationMs: mod - startPad,
      });
      lastStartTime += mod - startPad;
    }

    forEach(filteredPrograms, (program) => {
      newProgramList.push(program);
      const last = dayjs(lastStartTime);

      let nextProgramTime: dayjs.Dayjs;
      if (!isEmpty(manualOffsets)) {
        const thisProgramEnd = last.add(program.durationMs);
        const endMillis = dayjs
          .duration(thisProgramEnd.diff(thisProgramEnd.startOf('h')))
          .asMilliseconds();
        const foundOffset = find(manualOffsets, (off) => off >= endMillis);
        if (!foundOffset) {
          // Increment to the next hour and pick the first offset,
          // which will _always_ be the correct one, since we sorted
          // the offsets above are sure they are non-empty
          nextProgramTime = thisProgramEnd
            .add(1, 'h')
            .startOf('h')
            .add(manualOffsets[0]!, 'm');
        } else {
          // Reset m,s,ms on the end timestamp the rounded offset
          nextProgramTime = thisProgramEnd.startOf('h').add(foundOffset);
        }
      } else {
        // How many "slots" of time does this program take up?
        // We find the next available start time for a program
        nextProgramTime = last.add(
          Math.ceil(program.durationMs / mod) * mod,
          'milliseconds',
        );
      }
      // Advance by the duration of the program
      lastStartTime += program.durationMs;
      // How much padding do we need?
      const paddingDuration = nextProgramTime.diff(lastStartTime);
      if (paddingDuration > 30 * 1000) {
        newProgramList.push({
          type: 'offline',
          durationMs: paddingDuration,
        });
        lastStartTime += paddingDuration;
      }
    });

    return {
      newStartTime: this.config.alignChannelStartTime ? newStartTime : null,
      newProgramList,
    };
  }
}
