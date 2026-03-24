import { concat, orderBy } from 'lodash-es';
import { getEpisodeShowId } from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import type {
  SortOrder,
  SpecificTypeUIContentProgram,
  UIChannelProgram,
} from '../../types/index.ts';

export function useEpisodeNumberSort() {
  const programs = useStore(materializedProgramListSelector);

  return (sortOrder: SortOrder) => {
    const { newProgramSort } = sortPrograms(programs, sortOrder);

    setCurrentLineup(newProgramSort, true);
  };
}

export const sortPrograms = (
  programs: UIChannelProgram[],
  sortOrder: SortOrder,
) => {
  // Extract movies & tracks since they are appended at the bottom of the list
  const nonShowList = programs.filter(
    (program) =>
      program.type === 'content' && program.program.type !== 'episode',
  );

  // Sort shows by showId so all unique shows are together
  // Then sort by season and episode number so they are in the correct order
  const showList = orderBy(
    programs.filter(
      (p): p is SpecificTypeUIContentProgram<'episode'> =>
        p.type === 'content' && p.program.type === 'episode',
    ),
    [
      ({ program }) => getEpisodeShowId(program),
      ({ program }) => program.season?.index,
      ({ program }) => program.episodeNumber,
    ],
    [sortOrder, sortOrder, sortOrder],
  );

  const newProgramSort = concat(showList, nonShowList); // Append movies to the end of the list

  return { newProgramSort };
};
