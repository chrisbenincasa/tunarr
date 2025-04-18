import type { CondensedChannelProgram } from '@tunarr/types';
import { isFlexProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { inRange, reject } from 'lodash-es';
import { OneDayMillis } from '../../helpers/constants.ts';
import { createFlexProgram } from '../../helpers/util.ts';
import {
  setCurrentLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';

dayjs.extend(duration);

export const restrictHours = (
  programs: CondensedChannelProgram[],
  startOffset: number,
  toOffset: number,
) => {
  if (
    !inRange(startOffset, 0, OneDayMillis + 1) ||
    !inRange(toOffset, startOffset + 1, startOffset + OneDayMillis + 1) ||
    toOffset <= startOffset
  ) {
    return { newStartTime: null, newPrograms: programs };
  }

  const newStartTime = dayjs().startOf('day').add(startOffset);
  const maxDuration = toOffset - startOffset;
  // Remove all flex and programs that will never fit in the restricted hours slot
  const workingPrograms = reject(
    programs,
    (p) => isFlexProgram(p) || p.duration > maxDuration,
  );

  let currOffset = 0; // Offset from the channel start time
  const newPrograms: CondensedChannelProgram[] = [];

  if (workingPrograms.length === 0) {
    return { newStartTime: null, newPrograms };
  }

  let idx = 0;
  // let currOffset = dayjs(channelStartTime).mod({days: 1}).asMilliseconds();
  while (idx < workingPrograms.length) {
    const program = workingPrograms[idx];
    const timeLeft = maxDuration - currOffset;
    if (program.duration > timeLeft) {
      // Put the program back and try tomorrow.
      // workingPrograms.unshift(program);
      // Flex until the following day's start time
      newPrograms.push(
        createFlexProgram(timeLeft + OneDayMillis - maxDuration),
      );
      currOffset = 0;
      continue;
    }

    newPrograms.push(program);
    currOffset += program.duration;
    idx++;
  }

  return { newStartTime, newPrograms };
};

export const useRestrictHours = () => {
  const programs = useStore((s) => s.channelEditor.programList);

  return (startOffset: number, toOffset: number) => {
    const { newStartTime, newPrograms } = restrictHours(
      programs,
      startOffset,
      toOffset,
    );

    if (newStartTime) {
      updateCurrentChannel({ startTime: +newStartTime });
    }
    setCurrentLineup(newPrograms, true);
  };
};
