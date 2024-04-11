import { isContentProgram } from '@tunarr/types';
import _, { chain } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { UIChannelProgram } from '../../types/index.ts';

export function useCyclicShuffle() {
  const programs = useStore(materializedProgramListSelector);

  return function () {
    // sort each chunk by show, season, & episode number
    // chunk by show in new obkect
    // randomly grab from each chunk until nothing remains

    // Group shows by showId
    const sortedPrograms = chain(programs)
      .filter(isContentProgram)
      .orderBy(['showId', 'seasonNumber', 'episodeNumber'])
      .value();

    const groupedContent = _.groupBy(sortedPrograms, (program) => {
      if (program.type === 'content' && program.subtype === 'episode') {
        return program.showId; //Groups unique shows
      } else if (program.type === 'content' && program.subtype === 'movie') {
        return 'movie'; // Group all movies together, this way they are more evenly distributed throughout the timeline since they have less chance of being randomly selected
      } else if (program.type === 'content') {
        return program.id;
      } else {
        // to do: handle non content programming, for now we can ignore since we are filtering it out above
      }
    });

    const cycledShows: UIChannelProgram[] = [];

    // Loop until all chunks are empty
    while (_.some(groupedContent, (chunk) => chunk.length > 0)) {
      // Get a random chunk of shows based on showId
      const randomChunkKey = _.sample(_.keys(groupedContent));

      if (randomChunkKey) {
        const randomChunk = groupedContent[randomChunkKey];

        // Pick the first show from the random chunk
        const selectedShow = randomChunk.shift();

        if (selectedShow) {
          // Add the selected show to the results
          cycledShows.push(selectedShow);

          // Remove the emptied chunk from the grouped shows
          if (randomChunk.length === 0) {
            delete groupedContent[randomChunkKey];
          }
        }
      }
    }

    setCurrentLineup(cycledShows, true);
  };
}
