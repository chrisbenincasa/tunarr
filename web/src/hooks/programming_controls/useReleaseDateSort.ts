import { ChannelProgram, isContentProgram } from '@tunarr/types';
import { sortBy } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export type SortOrder = 'asc' | 'desc';

export function useReleaseDateSort() {
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
  const newProgramSort = sortBy(programs, (p) => {
    let n;
    if (isContentProgram(p)) {
      const ts = p.date ? new Date(p.date).getTime() : 0;
      n = sortOrder === 'asc' ? ts : -ts;
    } else {
      n = sortOrder === 'asc' ? Number.MAX_VALUE : Number.MAX_VALUE;
    }
    return n;
  });

  return { newProgramSort };
};
