import { ChannelProgram, isContentProgram } from '@tunarr/types';
import _ from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export function useRemoveShow() {
  const programs = useStore(materializedProgramListSelector);

  return (showsToRemove: string[]) => {
    const remainingPrograms = removeShows(programs, showsToRemove);
    setCurrentLineup(remainingPrograms, true);
  };
}

export const removeShows = (
  programs: ChannelProgram[],
  showsToRemove: string[],
) => {
  const filteredData = _.filter(programs, (program) => {
    return isContentProgram(program) && !showsToRemove.includes(program.title);
  });

  return filteredData;
};
