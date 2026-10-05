import useStore from '@/store';
import { setCurrentLineup } from '@/store/channelEditor/actions';
import { materializedProgramListSelector } from '@/store/selectors';
import type { ChannelProgram } from '@tunarr/types';
import { last } from 'lodash-es';

export const useConsolidatePrograms = () => {
  const programs = useStore(materializedProgramListSelector);
  return () => {
    setCurrentLineup(consolidatePrograms(programs));
  };
};

// Filler and content items point at a specific media file whose length is
// fixed, so only flex and same-channel redirects can be merged.
function canMerge(a: ChannelProgram, b: ChannelProgram) {
  if (a.type === 'flex' && b.type === 'flex') {
    return true;
  }

  return (
    a.type === 'redirect' && b.type === 'redirect' && a.channel === b.channel
  );
}

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
