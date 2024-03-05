import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import _ from 'lodash-es';
import { ChannelProgram } from '@tunarr/types';

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
    return !(_.has(program, 'season') && program.season === '00');
  });

  return filteredData;
};
