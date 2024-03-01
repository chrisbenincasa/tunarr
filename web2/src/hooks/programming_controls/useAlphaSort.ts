import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { CondensedChannelProgram } from '@tunarr/types';

export type SortOrder = 'asc' | 'desc';

export function useAlphaSort() {
  const programs = useStore(materializedProgramListSelector);

  return (sortOrder: SortOrder) => {
    const { newProgramSort } = sortPrograms(programs, sortOrder);

    setCurrentLineup(newProgramSort, true);
  };
}

export const sortPrograms = (
  programs: CondensedChannelProgram[],
  sortOrder: SortOrder,
) => {
  let newProgramSort: CondensedChannelProgram[] = [];
  newProgramSort = programs.sort((a, b) => {
    if (a.title < b.title) {
      return -1;
    }
    if (a.title > b.title) {
      return 1;
    }
    return 0;
  });

  newProgramSort =
    sortOrder === 'asc' ? newProgramSort : newProgramSort.reverse();

  return { newProgramSort };
};
