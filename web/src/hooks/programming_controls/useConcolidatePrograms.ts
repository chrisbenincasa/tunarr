import useStore from '@/store';
import { setCurrentLineup } from '@/store/channelEditor/actions';
import { materializedProgramListSelector } from '@/store/selectors';
import type { ChannelProgram } from '@tunarr/types';

export const useConsolidatePrograms = () => {
  const programs = useStore(materializedProgramListSelector);
  return () => {
    setCurrentLineup(consolidatePrograms(programs));
  };
};

const consolidatePrograms = (programs: ChannelProgram[]) => {
  const newPrograms: ChannelProgram[] = [];

  let i = 0;
  while (i < programs.length) {
    const program = programs[i];
    if (program.type === 'content' || program.type === 'custom') {
      newPrograms.push(program);
      i++;
      continue;
    }

    let j = i + 1;
    const newProgram = { ...program };
    while (j < programs.length) {
      const nextProgram = programs[j];
      if (nextProgram.type === newProgram.type) {
        newProgram.duration += nextProgram.duration;
      } else {
        break;
      }
      j++;
    }
    newPrograms.push(newProgram);

    i = j;
  }

  return newPrograms;
};
