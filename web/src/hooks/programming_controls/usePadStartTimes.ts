import type { Channel, CondensedChannelProgram } from '@tunarr/types';
import { isFlexProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { find, flatMap, forEach, isEmpty, sortBy } from 'lodash-es';
import filter from 'lodash-es/filter';
import negate from 'lodash-es/negate';
import { scale } from '../../helpers/util.ts';
import {
  setCurrentLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export type StartTimePadding = {
  key: number;
  mod: number;
  description: string;
  allowedOffsets?: number[];
};

/**
 * The 'key' value here should be unique and used for React keys, Select menu values
 * etc.
 *
 * There are two ways to configure padding:
 *  1. Simple way - just define a modulo. This will just incrementally round off
 *     programs to the nearest mod mins
 *  2. Less simple - define a modulo and an 'allowed offsets'. Allowed offsets are
 *     minute offsets within an hour that we can start shows. These are combined
 *     with the modulo to create sets of restricted start times. For instance,
 *     allowedOffsets = [0, 30] will allow programs to only start on minutes
 *     [0, 5, 30, 35].
 */
export const StartTimePaddingOptions: readonly StartTimePadding[] = [
  { key: -1, mod: -1, description: 'None' },
  { key: 5, mod: 5, description: ':05, :10, ..., :55' },
  { key: 10, mod: 10, description: ':10, :20, ..., :50' },
  { key: 15, mod: 15, description: ':00, :15, :30, :45' },
  { key: 30, mod: 30, description: ':00, :30' },
  { key: 60, mod: 60, description: ':00' },
  { key: 20, mod: 20, description: ':20, :40, :00' },
  {
    key: 5.1,
    mod: 5,
    description: ':00, :05, :30, :35',
    allowedOffsets: [0, 30],
  },
] as const;

export function usePadStartTimes() {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const programs = useStore(materializedProgramListSelector);

  return (padding: StartTimePadding | null) => {
    const { newStartTime, newProgramList } = padStartTimes(
      channel,
      programs,
      padding,
    );
    updateCurrentChannel({ startTime: newStartTime });
    setCurrentLineup(newProgramList, true);
  };
}

export function padStartTimes(
  channel: Channel | undefined,
  programs: CondensedChannelProgram[],
  padding: StartTimePadding | null,
) {
  const modMins = !padding || padding.mod <= 0 ? 1 : padding.mod;
  const mod = modMins * 60 * 1000;
  const startTime = +dayjs(channel?.startTime);
  const newStartTime = startTime - (startTime % mod);
  const filteredPrograms = filter(programs, negate(isFlexProgram));

  const manualOffsets = sortBy(
    scale(
      flatMap(padding?.allowedOffsets, (off) => [off, off + modMins]),
      60 * 1000,
    ),
  );

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
      nextProgramTime = last.add(Math.ceil(program.duration / mod) * mod);
    }
    // Advance by the duration of the program
    lastStartTime += program.duration;
    // How much padding do we need?
    let paddingDuration = nextProgramTime.diff(lastStartTime);
    // TODO: Make this configurable.
    if (paddingDuration < 30 * 1000) {
      // We don't want short flex periods, so round to the next padded
      // start time.
      paddingDuration += mod;
    }
    newProgramList.push({
      type: 'flex',
      duration: paddingDuration,
      persisted: false,
    });
    lastStartTime += paddingDuration;
  });

  return { newStartTime, newProgramList };
}
