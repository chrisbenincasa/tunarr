import { ChannelProgram, isFlexProgram, programUniqueId } from '@tunarr/types';
import { chain, filter, isNull } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export const useRemoveDuplicates = () => {
  const programs = useStore(materializedProgramListSelector);
  return () => {
    if (programs.length > 0) {
      const newPrograms = removeDuplicatePrograms(programs);
      setCurrentLineup(newPrograms);
    }
  };
};

export const removeDuplicatePrograms = (programs: ChannelProgram[]) => {
  const seenCount = chain(programs)
    .map(programUniqueId)
    .reject(isNull)
    .reduce((acc, id) => ({ ...acc, [id!]: 0 }), {} as Record<string, number>)
    .value();
  return filter(programs, (p) => {
    const uniqueId = programUniqueId(p);
    if (!uniqueId) {
      return false;
    }

    if (isFlexProgram(p)) {
      return false;
    }

    return seenCount[uniqueId]++ === 1;
  });
};
