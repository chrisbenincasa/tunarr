import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { CondensedChannelProgram } from '@tunarr/types';

export type SortOrder = 'asc' | 'desc';

export function useReleaseDateSort() {
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

  newProgramSort = programs.sort(function (a, b) {
    // Turn strings into dates, and then subtract them
    // to get a value that is either negative, positive, or zero.
    return new Date(a.date) - new Date(b.date);
  });

  newProgramSort =
    sortOrder === 'asc' ? newProgramSort : newProgramSort.reverse();

  return { newProgramSort };
};
