import { AddBreaksConfig } from '@/components/programming_controls/AddBreaksModal';
import { setCurrentLineup } from '@/store/channelEditor/actions';
import { materializedProgramListSelector } from '@/store/selectors';
import { ChannelProgram, isFlexProgram } from '@tunarr/types';
import useStore from '@/store';

export function useAddBreaks() {
  const programs = useStore(materializedProgramListSelector);

  return (config: AddBreaksConfig) => {
    setCurrentLineup(addBreaks(programs, config), true);
  };
}

function addBreaks(
  programs: ChannelProgram[],
  { afterMinutes, minDurationSeconds, maxDurationSeconds }: AddBreaksConfig,
) {
  const afterMillis = afterMinutes * 60 * 1000; // TODO add leeway?
  const newPrograms: ChannelProgram[] = [];

  let durWithoutBreak = 0;
  for (const program of programs) {
    if (isFlexProgram(program)) {
      durWithoutBreak = 0;
    } else {
      if (durWithoutBreak + program.duration >= afterMillis) {
        durWithoutBreak = 0;
        newPrograms.push({
          persisted: false,
          type: 'flex',
          duration:
            1000 *
            (minDurationSeconds +
              Math.floor(maxDurationSeconds - minDurationSeconds) *
                Math.random()),
        });
      } else {
        durWithoutBreak += program.duration;
      }
    }
    newPrograms.push(program);
  }

  return newPrograms;
}
