import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import _, { chain, forEach, maxBy, range, shuffle } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { UIChannelProgram } from '../../types/index.ts';
import { ContentProgram, isContentProgram } from '@tunarr/types';

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
      // .filter(isContentProgram)
      .filter(
        (program) =>
          program.type === 'content' && program.subtype === 'episode',
      )
      .value();

    if (options?.type === 'Random') {
      showList = _.shuffle(showList);
    }

    const groupByShow = chain(showList)
      .groupBy((program: ContentProgram) => program.title!)
      .forOwn((value, key, obj) => {
        obj[key] = _.chunk(obj[key], options?.programCount);
      })
      .value();

    // See which show has the most episodes in the program list
    const maxLength =
      _.max(Object.values(groupByShow).map((a) => a.length)) || 0;

    // const alternatingPrograms:UIChannelProgram[] = [];
    const alternatingShows: UIChannelProgram[] = [];

    for (const i of range(maxLength)) {
      forEach(groupByShow, (arr) => {
        if (i < arr.length) {
          alternatingShows.push(arr[i]);
        }
      });
    }

    const finalProgramList = chain(alternatingShows)
      .flatMap()
      .flatMap()
      .value()
      .concat(movieList); // Append movies to the end of the list
    console.log(finalProgramList);

    setCurrentLineup(finalProgramList, true);
  };
}
