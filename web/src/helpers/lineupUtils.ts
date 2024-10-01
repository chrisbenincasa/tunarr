import { UIChannelProgram, UIContentProgram, UICustomProgram } from '@/types';
import { filter, forEach, groupBy, mapValues, sortBy } from 'lodash-es';

// Takes an array of programs and sorts them in cyclic order, i.e.
// Season 1: [E1, E2, E3]
// Season 2: [E1, E2, E3]
// Season 1: [E1, E2]
// Does not duplicate programs (only uses what is available)
// Any programs whose order cannot be determined put at the end
// Only type = content, subtype = episode | track supported
export const cyclicSort = (programs: UIChannelProgram[]) => {
  const validPrograms = filter(
    programs,
    (p) =>
      p.type === 'content' &&
      (p.subtype === 'episode' || p.subtype === 'track'),
  );

  const grouped = groupBy(validPrograms, groupProgram);
  console.log(grouped);

  forEach(grouped, (programs, key) => {
    if (key.startsWith('show_')) {
      console.log(
        mapValues(
          groupBy(programs as UIContentProgram[], (p) => p.seasonNumber ?? -1),
          (season) =>
            sortBy(season, (p) => p.episodeNumber ?? Number.MAX_VALUE),
        ),
      );
    } else if (key.startsWith('track_')) {
    }
  });
};

function groupProgram(program: UIContentProgram | UICustomProgram) {
  if (program.type === 'content') {
    switch (program.subtype) {
      case 'movie':
        return 'movie';
      case 'episode':
        return `show_${program.title}`;
      case 'track':
        return `track_${program.albumId ?? program.title}`;
    }
  } else {
    return `custom_${program.customShowId}`;
  }
}
