import type { ChannelProgram } from '@tunarr/types';
import { isContentProgram } from '@tunarr/types';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import type { SortOrder } from '../../types/index.ts';

export function useAlphaSort() {
  const programs = useStore(materializedProgramListSelector);

  return (sortOrder: SortOrder) => {
    const { newProgramSort } = sortPrograms(programs, sortOrder);

    setCurrentLineup(newProgramSort, true);
  };
}

export const sortPrograms = (
  programs: ChannelProgram[],
  sortOrder: SortOrder,
) => {
  let newProgramSort: ChannelProgram[] = [];
  newProgramSort = programs.sort((a, b) => {
    if (isContentProgram(a) && isContentProgram(b)) {
      if (a.title < b.title) {
        return -1;
      }
      if (a.title > b.title) {
        return 1;
      }
      return 0;
    } else if (isContentProgram(a)) {
      return -1;
    } else if (isContentProgram(b)) {
      return 1;
    } else {
      return 0;
    }
  });

  newProgramSort =
    sortOrder === 'asc' ? newProgramSort : newProgramSort.reverse();

  return { newProgramSort };
};
