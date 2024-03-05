import _, { chain, chunk, concat, forEach, max, range } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { UIChannelProgram, isUIContentProgram } from '../../types/index.ts';

export type BlockShuffleProgramCount = number;

export type BlockShuffleType = 'Fixed' | 'Random';

export type BlockShuffleOptions = {
  programCount: BlockShuffleProgramCount;
  type: BlockShuffleType;
};

export function useBlockShuffle() {
  const programs = useStore(materializedProgramListSelector);

  // filter out all movies
  // filter just episodes
  // Sort programs
  // sort by release date
  // chunk
  // optional: randomize
  // Alternate through all shows

  return function (options: BlockShuffleOptions | null) {
    const movieList = programs.filter(
      (program) => program.type === 'content' && program.subtype === 'movie',
    );

    let showList = chain(programs)
      .filter(isUIContentProgram)
      .filter((program) => program.subtype === 'episode')
      .value();

    if (options?.type === 'Random') {
      showList = _.shuffle(showList);
    }

    const groupByShow = chain(showList)
      .groupBy((program) => program.title)
      .mapValues((value) => chunk(value, options?.programCount))
      .value();

    // See which show has the most episodes in the program list
    const maxLength = max(Object.values(groupByShow).map((a) => a.length)) || 0;

    const alternatingShows: UIChannelProgram[] = [];

    for (const i of range(maxLength)) {
      forEach(groupByShow, (arr) => {
        if (i < arr.length) {
          alternatingShows.push(...arr[i]);
        }
      });
    }

    const finalProgramList = concat(alternatingShows, movieList); // Append movies to the end of the list

    setCurrentLineup(finalProgramList, true);
  };
}
