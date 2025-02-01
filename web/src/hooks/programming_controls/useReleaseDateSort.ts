import { type ChannelProgram, isContentProgram } from '@tunarr/types';
import { isNil, orderBy } from 'lodash-es';
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
    return p.date ? new Date(p.date).getTime() : 0;
  } else {
    return Number.MAX_VALUE;
  }
}

function seasonEpisodeTiebreaker(p: ChannelProgram) {
  if (isContentProgram(p)) {
    let n = 1;
    if (p.subtype === 'episode') {
      const seasonNumber = p.parent?.index ?? p.seasonNumber;
      if (!isNil(seasonNumber)) {
        n *= seasonNumber * 1e4;
      }

      const episodeNumber = p.index ?? p.episodeNumber;
      if (!isNil(episodeNumber)) {
        n += episodeNumber * 1e2;
      }
    } else if (p.subtype === 'track') {
      if (!isNil(p.parent?.index)) {
        n *= p.parent?.index * 1e4;
      }

      if (!isNil(p.index)) {
        n += p.index * 1e2;
      }
    }

    return n;
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
