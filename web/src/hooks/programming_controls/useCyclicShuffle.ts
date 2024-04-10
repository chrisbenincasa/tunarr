import _ from 'lodash-es';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export function useCyclicShuffle() {
  const programs = useStore(materializedProgramListSelector);

  return function () {
    console.log(programs);

    function chunkEpisodesByShow(programs) {
      return _.groupBy(programs, (episode) => episode.showId || 'no_show_id');
    }

    // Group episodes by show ID
    const showGroups = chunkEpisodesByShow(programs);

    // Print the grouped episodes
    console.log(showGroups);

    // let showList = chain(programs)
    //   .filter(isUIContentProgram)
    //   .filter((program) => program.subtype === 'episode')
    //   .value();

    // const finalProgramList = concat(alternatingShows, movieList); // Append movies to the end of the list

    // setCurrentLineup(finalProgramList, true);
  };
}
