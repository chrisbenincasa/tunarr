import { ChannelProgram, isContentProgram } from '@tunarr/types';
import _ from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export const useRemoveSpecials = () => {
  const programs = useStore(materializedProgramListSelector);

  return () => {
    if (programs.length > 0) {
      const newPrograms = removeSpecials(programs);
      setCurrentLineup(newPrograms);
    }
  };
};

export const removeSpecials = (programs: ChannelProgram[]) => {
  const filteredData = _.filter(programs, (program) => {
    return !isContentProgram(program) || program.seasonNumber !== 0;
  });

  return filteredData;
};
