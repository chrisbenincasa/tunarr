import { type ChannelProgram, isContentProgram } from '@tunarr/types';
import { orderBy } from 'lodash-es';
import { getCanonicalOrderIndex } from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  materializedProgramListSelector,
  useCustomShowEditor,
} from '../../store/selectors.ts';
import { type SortOrder } from '../../types/index.ts';

function releaseDateOrderer(p: ChannelProgram) {
  if (isContentProgram(p)) {
    return p.program.releaseDate ?? 0;
  } else {
    return Number.MAX_VALUE;
  }
}

function seasonEpisodeTiebreaker(p: ChannelProgram) {
  if (isContentProgram(p)) {
    return getCanonicalOrderIndex(p.program);
  } else {
    return 0;
  }
}

export const sortProgramsByReleaseDate = (
  programs: ChannelProgram[],
  sortOrder: SortOrder,
) => {
  return orderBy(
    programs,
    [releaseDateOrderer, seasonEpisodeTiebreaker],
    [sortOrder, sortOrder],
  );
};

export function useReleaseDateSort() {
  const programs = useStore(materializedProgramListSelector);

  return (sortOrder: SortOrder) => {
    const sortedPrograms = sortProgramsByReleaseDate(programs, sortOrder);

    setCurrentLineup(sortedPrograms, true);
  };
}

export function useCustomShowReleaseDateSort() {
  const { programList } = useCustomShowEditor();
  return (sortOrder: SortOrder) => {
    const programs = sortProgramsByReleaseDate(programList, sortOrder).filter(
      isContentProgram,
    );
    setCurrentCustomShowProgramming(programs);
  };
}
