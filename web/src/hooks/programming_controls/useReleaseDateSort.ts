import { ChannelProgram, isContentProgram } from '@tunarr/types';
import { isNil, sortBy } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { SortOrder } from '../../types/index.ts';

export function useReleaseDateSort() {
  const programs = useStore(materializedProgramListSelector);

  return (sortOrder: SortOrder) => {
    const sortedPrograms = sortProgramsByReleaseDate(programs, sortOrder);

    setCurrentLineup(sortedPrograms, true);
  };
}

export const sortProgramsByReleaseDate = (
  programs: ChannelProgram[],
  sortOrder: SortOrder,
) => {
  return sortBy(
    programs,
    (p) => {
      let n;

      if (isContentProgram(p)) {
        const ts = p.date ? new Date(p.date).getTime() : 0;
        n = sortOrder === 'asc' ? ts : -ts;
      } else {
        n = sortOrder === 'asc' ? Number.MAX_VALUE : Number.MAX_VALUE;
      }

      return n;
    },
    (p) => {
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

        return sortOrder === 'asc' ? n : -n;
      } else {
        return 0;
      }
    },
  );
};
