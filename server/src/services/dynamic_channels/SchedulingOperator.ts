import {
  AddPaddingSchedulingOperation,
  SchedulingOperation,
} from '@tunarr/types/api';
import { LineupItem } from '../../dao/derived_types/Lineup';
import { Channel, CondensedChannelProgram, isFlexProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import {
  filter,
  negate,
  sortBy,
  flatMap,
  forEach,
  isEmpty,
  find,
} from 'lodash-es';

// A SchedulingOperator takes a set of lineup items
// and returns a set of lineup items. The operator
// can sort, add, remove, etc, but it must not mutate
// the incoming array.
export abstract class SchedulingOperator<
  ConfigType extends SchedulingOperation,
> {
  protected config: ConfigType;

  constructor(config: ConfigType) {
    this.config = config;
  }

  public abstract apply(items: readonly LineupItem[]): Promise<LineupItem[]>;
}

export class PadProgramsSchedulingOperator extends SchedulingOperator<AddPaddingSchedulingOperation> {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async apply(items: readonly LineupItem[]): Promise<LineupItem[]> {
    return [...items];
  }

  private padStartTimes(
    channel: Channel | undefined,
    programs: CondensedChannelProgram[],
    // padding: StartTimePadding | null,
  ) {
    const modMins = this.config.mod;
    const mod = modMins * 60 * 1000;
    // const startTime = dayjs(channel?.startTime).unix() * 1000;
    // const newStartTime = startTime - (startTime % mod);
    const filteredPrograms = filter(programs, negate(isFlexProgram));

    const manualOffsets = sortBy(
      scale(
        flatMap(this.config.allowedOffsets, (off) => [off, off + modMins]),
        60 * 1000,
      ),
    );
    console.log(manualOffsets);

    let lastStartTime = newStartTime;
    const newProgramList: CondensedChannelProgram[] = [];
    forEach(filteredPrograms, (program) => {
      newProgramList.push(program);
      const last = dayjs(lastStartTime);

      let nextProgramTime: dayjs.Dayjs;
      if (!isEmpty(manualOffsets)) {
        const thisProgramEnd = last.add(program.duration);
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
            .add(manualOffsets[0], 'm');
        } else {
          // Reset m,s,ms on the end timestamp the rounded offset
          nextProgramTime = thisProgramEnd.startOf('h').add(foundOffset);
        }
      } else {
        // How many "slots" of time does this program take up?
        // We find the next available start time for a program
        nextProgramTime = last.add(
          Math.ceil(program.duration / mod) * mod,
          'milliseconds',
        );
      }
      // Advance by the duration of the program
      lastStartTime += program.duration;
      // How much padding do we need?
      const paddingDuration = nextProgramTime.diff(lastStartTime);
      if (paddingDuration > 30 * 1000) {
        newProgramList.push({
          type: 'flex',
          duration: paddingDuration,
          persisted: false,
        });
        lastStartTime += paddingDuration;
      }
    });

    return { newStartTime, newProgramList };
  }
}
