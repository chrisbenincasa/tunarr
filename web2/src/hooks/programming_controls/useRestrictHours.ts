import { CondensedChannelProgram, isFlexProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { forEach, inRange, reject } from 'lodash-es';
import { OneDayMillis } from '../../helpers/constants.ts';
import { createFlexProgram } from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
import {
  updateCurrentChannel,
  setCurrentLineup,
} from '../../store/channelEditor/actions.ts';

dayjs.extend(duration);

export const restrictHours = (
  programs: CondensedChannelProgram[],
  from: number,
  to: number,
) => {
  if (!inRange(from, 0, 24) || !inRange(to, 0, 24) || to <= from) {
    return { newStartTime: null, newPrograms: programs };
  }

  const newStartTime = dayjs().hour(from).minute(0).second(0).millisecond(0);
  const startTimeOffset = dayjs.duration(from, 'hours').asMilliseconds();
  const endTimeOffset = dayjs.duration(to, 'hours').asMilliseconds();
  const maxDuration = endTimeOffset - startTimeOffset;
  // Remove all flex and programs that will never fit in the restricted hours slot
  const workingPrograms = reject(
    programs,
    (p) => isFlexProgram(p) || p.duration > maxDuration,
  );

  let currOffset = 0; // Offset from the channel start time
  const newPrograms: CondensedChannelProgram[] = [];

  forEach(workingPrograms, (program) => {
    const timeLeft = maxDuration - currOffset;
    if (program.duration > timeLeft) {
      // Put the program back and try tomorrow.
      // workingPrograms.unshift(program);
      // Flex until the following day's start time
      newPrograms.push(
        createFlexProgram(timeLeft + OneDayMillis - maxDuration),
      );
      currOffset = 0;
    }

    newPrograms.push(program);
    currOffset += program.duration;
  });

  return { newStartTime, newPrograms };
};

export const useRestrictHours = () => {
  const programs = useStore((s) => s.channelEditor.programList);

  return (from: number, to: number) => {
    const { newStartTime, newPrograms } = restrictHours(programs, from, to);

    if (newStartTime) {
      updateCurrentChannel({ startTime: newStartTime.unix() * 1000 });
    }
    setCurrentLineup(newPrograms, true);
  };
};
