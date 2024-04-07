import { ChannelProgram, isContentProgram } from '@tunarr/types';
import { isNil, reject } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export function useRemoveShow() {
  const programs = useStore(materializedProgramListSelector);

  return (showsToRemove: string[]) => {
    setCurrentLineup(removeShows(programs, showsToRemove), true);
  };
}

export const removeShows = (
  programs: ChannelProgram[],
  showsToRemove: string[],
) => {
  const showsSet = new Set([...showsToRemove]);
  return reject(programs, (program) => {
    return (
      isContentProgram(program) &&
      (showsSet.has(program.title) ||
        (!isNil(program.showId) && showsSet.has(program.showId)))
    );
  });
};
