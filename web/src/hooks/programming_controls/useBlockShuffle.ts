import {
  chain,
  chunk,
  forEach,
  isUndefined,
  max,
  range,
  shuffle,
  sortBy,
} from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import {
  UIChannelProgram,
  UIContentProgram,
  UICustomProgram,
  isUIContentProgram,
  isUICustomProgram,
} from '../../types/index.ts';

export type BlockShuffleProgramCount = number;

export type BlockShuffleType = 'Fixed' | 'Random';
export interface BlockShuffleConfig {
  shuffleType: BlockShuffleType;
  blockSize: number;
  sortOptions: {
    movies: {
      sort: 'alpha' | 'release_date';
      order: 'asc' | 'desc';
    };
    show: {
      order: 'asc' | 'desc';
    };
  };
}

function sortProgram(
  p: UIContentProgram,
  by: 'release_date' | 'index' | 'alpha',
  asc: boolean,
) {
  switch (by) {
    case 'release_date': {
      const ts = p.date ? new Date(p.date).getTime() : 0;
      return asc ? ts : -ts;
    }
    case 'index': {
      let n = 1;

      if (!isUndefined(p.parentIndex)) {
        n *= p.parentIndex * 1e4;
      }

      if (!isUndefined(p.index)) {
        n *= p.index * 1e2;
      }
      return asc ? n : -n;
    }

    case 'alpha':
      return asc ? p.title : -p.title;
  }
}

export function useBlockShuffle() {
  const programs = useStore(materializedProgramListSelector);

  return function (options: BlockShuffleConfig | null) {
    let programList = chain(programs)
      .filter(
        (p): p is UIContentProgram | UICustomProgram =>
          isUIContentProgram(p) || isUICustomProgram(p),
      )
      .value();

    if (options?.shuffleType === 'Random') {
      programList = shuffle(programList);
    }

    const showsAscending = (options?.sortOptions.show.order ?? 'asc') === 'asc';
    const moviesAscending =
      (options?.sortOptions.movies.order ?? 'asc') === 'asc';

    const groupByShow = chain(programList)
      .groupBy((program) => {
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
      })
      .thru((groups) => {
        forEach(groups, (programs, key) => {
          if (key.startsWith('custom_')) {
            groups[key] = sortBy(programs as UICustomProgram[], (p) => p.index);
          } else if (key.startsWith('show_') || key.startsWith('track_')) {
            groups[key] = sortBy(programs as UIContentProgram[], (p) =>
              sortProgram(p, 'index', showsAscending),
            );
          } else if (key.startsWith('movie')) {
            groups[key] = sortBy(programs as UIContentProgram[], (p) =>
              sortProgram(
                p,
                options?.sortOptions.movies.sort ?? 'release_date',
                moviesAscending,
              ),
            );
          }
        });
        return groups;
      })
      .mapValues((value) => chunk(value, options?.blockSize ?? 3))
      .value();

    // See which show has the most episodes in the program list
    const maxLength = max(Object.values(groupByShow).map((a) => a.length)) ?? 0;

    const alternatingShows: UIChannelProgram[] = [];

    for (const i of range(maxLength)) {
      forEach(groupByShow, (arr) => {
        if (i < arr.length) {
          alternatingShows.push(...arr[i]);
        }
      });
    }

    setCurrentLineup(alternatingShows, true);
  };
}
