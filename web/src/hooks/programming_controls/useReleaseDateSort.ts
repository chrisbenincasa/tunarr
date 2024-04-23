import { ChannelProgram, isContentProgram } from '@tunarr/types';
import { sortBy } from 'lodash-es';
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
          if (p.seasonNumber) {
            n *= p.seasonNumber * 1e4;
          }

          if (p.episodeNumber) {
            n += p.episodeNumber * 1e2;
          }
        } else if (p.subtype === 'track') {
          // TODO: Plumb through album index
        }

        return sortOrder === 'asc' ? n : -n;
      } else {
        return 0;
      }
    },
  );
};
