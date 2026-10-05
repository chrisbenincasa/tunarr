import useStore from '@/store';
import { setCurrentLineup } from '@/store/channelEditor/actions';
import { materializedProgramListSelector } from '@/store/selectors';
import type { ChannelProgram } from '@tunarr/types';
import { isEqual, last } from 'lodash-es';

export const useConsolidatePrograms = () => {
  const programs = useStore(materializedProgramListSelector);
  return () => {
    setCurrentLineup(consolidatePrograms(programs));
  };
};

// Only items that carry nothing but a duration can merge. Content, custom and
// filler items each point at one media item, so merging them would stretch
// that item past its real length and seek past its end at playback.
const canMerge = (a: ChannelProgram, b: ChannelProgram) => {
  if (a.type === 'flex' && b.type === 'flex') {
    return isEqual(a.fillerConfig, b.fillerConfig);
  }

  if (a.type === 'redirect' && b.type === 'redirect') {
    return a.channel === b.channel;
  }

  return false;
};

export const consolidatePrograms = <T extends ChannelProgram>(
  programs: T[],
): T[] => {
  const newPrograms: T[] = [];

  for (const program of programs) {
    const previous = last(newPrograms);
    if (previous !== undefined && canMerge(previous, program)) {
      newPrograms[newPrograms.length - 1] = {
        ...previous,
        duration: previous.duration + program.duration,
      };
    } else {
      newPrograms.push(program);
    }
  }

  return newPrograms;
};
