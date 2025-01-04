import { random } from '@/helpers/random.ts';
import { removeDuplicatePrograms } from '@/hooks/programming_controls/useRemoveDuplicates.ts';
import { chain, keys, some, sortBy } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import {
  UIChannelProgram,
  UIContentProgram,
  UICustomProgram,
} from '../../types/index.ts';

function rotateArray<T>(arr: T[], positions: number): T[] {
  return arr.slice(positions, arr.length).concat(arr.slice(0, positions));
}

export function useCyclicShuffle() {
  const programs = useStore(materializedProgramListSelector);

  return function () {
    // sort each chunk by show, season, & episode number
    // chunk by show in new obkect
    // randomly grab from each chunk until nothing remains
    const groupedContent = chain(programs)
      .thru(removeDuplicatePrograms)
      .filter(
        (program) => program.type === 'content' || program.type === 'custom',
      )
      .groupBy((program) => {
        if (program.type === 'content') {
          switch (program.subtype) {
            case 'movie':
              // Group all movies together, this way they are more evenly distributed throughout the timeline
              // since they have less chance of being randomly selected
              return 'movie';
            case 'episode':
              return program.showId; //Groups unique shows
            case 'track':
              // Group unique albums
              return program.albumId;
          }
        } else if (program.type === 'custom') {
          return program.customShowId;
        }
      })
      .mapValues((programs) => {
        const firstProgram = programs[0];
        if (firstProgram.type === 'content') {
          programs = sortBy(
            programs as UIContentProgram[],
            (p) => p.parentIndex,
            (p) => p.index,
          );
        } else if (firstProgram.type === 'custom') {
          programs = sortBy(
            programs as UICustomProgram[],
            (program) => program.index,
          );
        }

        return rotateArray(programs, random.integer(0, programs.length));
      })
      .value();

    const cycledShows: UIChannelProgram[] = [];

    // Loop until all chunks are empty
    while (some(groupedContent, (chunk) => chunk.length > 0)) {
      // Get a random chunk of shows based on showId
      const randomChunkKey = random.pick(keys(groupedContent));

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

    setCurrentLineup(cycledShows, true);
  };
}
