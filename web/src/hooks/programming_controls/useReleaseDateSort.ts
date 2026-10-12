import { type ChannelProgram, isContentProgram } from '@tunarr/types';
import { isNil, orderBy } from 'lodash-es';
import { getCanonicalOrderIndex } from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  materializedProgramListSelector,
  useCustomShowEditor,
} from '../../store/selectors.ts';
import { type SortOrder } from '../../types/index.ts';

// Programs without a release date (and non-content items like flex) go to the
// bottom in either direction, so they are grouped ahead of the date itself.
function missingReleaseDate(p: ChannelProgram) {
  return isContentProgram(p) && !isNil(p.program.releaseDate) ? 0 : 1;
}

function releaseDateOrderer(p: ChannelProgram) {
  return isContentProgram(p) ? (p.program.releaseDate ?? 0) : 0;
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
    [missingReleaseDate, releaseDateOrderer, seasonEpisodeTiebreaker],
    ['asc', sortOrder, sortOrder],
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
