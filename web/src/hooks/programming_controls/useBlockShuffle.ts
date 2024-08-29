import {
  chain,
  chunk,
  concat,
  filter,
  forEach,
  map,
  max,
  range,
  shuffle,
  sortBy,
  values,
} from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import {
  UIChannelProgram,
  UIContentProgram,
  UICustomProgram,
} from '../../types/index.ts';

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
    const movieList = sortBy(
      filter(
        programs,
        (program): program is UIContentProgram =>
          program.type === 'content' && program.subtype === 'movie',
      ),
      (program) => {
        const ts = program.date ? new Date(program.date).getTime() : 0;
        return ts;
      },
    );

    const x = filter(
      programs,
      (program) => program.type === 'custom' && program.program?.subtype,
    );

    const nonMovieList = chain(programs)
      .filter((program): program is UIContentProgram | UICustomProgram => {
        if (program.type === 'content') {
          return program.subtype !== 'movie';
        } else if (program.type === 'custom') {
          return program.program?.subtype === 'movie';
        } else {
          return false;
        }
      })
      .thru((list) => {
        if (options?.type === 'Random') {
          return shuffle(list);
        } else {
          return list;
        }
      })
      .value();

    const groupByShow = chain(nonMovieList)
      .groupBy((program) => program.title)
      .mapValues((value) => chunk(value, options?.programCount))
      .value();

    // See which show has the most episodes in the program list
    const maxLength = max(map(values(groupByShow), (a) => a.length)) ?? 0;

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
