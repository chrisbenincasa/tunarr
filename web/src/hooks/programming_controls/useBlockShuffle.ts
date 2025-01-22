import {
  chain,
  chunk,
  flatMap,
  forEach,
  isEmpty,
  isUndefined,
  map,
  mapValues,
  max,
  orderBy,
  range,
  shuffle,
  values,
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
import { removeDuplicatePrograms } from './useRemoveDuplicates.ts';

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
  loopBlocks?: boolean;
  perfectSync?: boolean;
}

function sortProgram(
  p: UIContentProgram,
  by: 'release_date' | 'index' | 'alpha',
) {
  switch (by) {
    case 'release_date': {
      const ts = p.date ? new Date(p.date).getTime() : 0;
      return ts;
    }
    case 'index': {
      let n = 1;

      const seasonNumber = p.parent?.index ?? p.seasonNumber;
      if (!isUndefined(seasonNumber)) {
        n += seasonNumber * 1e4;
      }

      const episodeNumber = p.index ?? p.episodeNumber;
      if (!isUndefined(episodeNumber)) {
        n += episodeNumber * 1e2;
      }

      return n;
    }

    case 'alpha':
      return p.grandparent?.title ?? p.title;
  }
}

export function useBlockShuffle() {
  const programs = useStore(materializedProgramListSelector);

  return {
    canUsePerfectSync: (blockSize: number) =>
      canUsePerfectSync(programs, blockSize),
    blockShuffle: (options: BlockShuffleConfig | null) =>
      blockShuffle(programs, options),
  };
}

function groupProgram(program: UIContentProgram | UICustomProgram) {
  if (program.type === 'content') {
    switch (program.subtype) {
      case 'movie':
        return 'movie';
      case 'episode':
        return `show_${program.showId ?? program.grandparent?.title}`;
      case 'track':
        return `track_${program.albumId ?? program.parent?.title}`;
    }
  } else {
    return `custom_${program.customShowId}`;
  }
}

function blockShuffle(
  programs: UIChannelProgram[],
  options: BlockShuffleConfig | null,
) {
  if (isEmpty(programs)) {
    return;
  }

  const showsAscending = (options?.sortOptions.show.order ?? 'asc') === 'asc';
  const moviesAscending =
    (options?.sortOptions.movies.order ?? 'asc') === 'asc';

  const groupByShow = chain(programs)
    .thru(removeDuplicatePrograms)
    .filter(
      (p): p is UIContentProgram | UICustomProgram =>
        isUIContentProgram(p) || isUICustomProgram(p),
    )
    .thru((arr) => {
      return options?.shuffleType === 'Random' ? shuffle(arr) : arr;
    })
    .groupBy(groupProgram)
    .thru((groups) => {
      forEach(groups, (programs, key) => {
        if (key.startsWith('custom_')) {
          groups[key] = orderBy(programs as UICustomProgram[], (p) => p.index, [
            showsAscending ? 'asc' : 'desc',
          ]);
        } else if (key.startsWith('show_') || key.startsWith('track_')) {
          groups[key] = orderBy(
            programs as UIContentProgram[],
            (p) => sortProgram(p, 'index'),
            [showsAscending ? 'asc' : 'desc'],
          );
        } else if (key.startsWith('movie')) {
          groups[key] = orderBy(
            programs as UIContentProgram[],
            (p) =>
              sortProgram(
                p,
                options?.sortOptions.movies.sort ?? 'release_date',
              ),
            [moviesAscending ? 'asc' : 'desc'],
          );
        }
      });
      return groups;
    })
    .value();

  const blockSize = options?.blockSize ?? 3;

  const [chunks, loops] = options?.perfectSync
    ? getPerfectSyncChunks(groupByShow, blockSize)
    : getSimpleChunks(groupByShow, blockSize, options?.loopBlocks ?? true);

  const alternatingShows = flatMap(range(loops), (i) =>
    flatMap(chunks, (chunk) => (i < chunk.length ? [...chunk[i]] : [])),
  );

  setCurrentLineup(alternatingShows, true);
}

function getPerfectSyncChunks(
  groupByShow: Record<string, (UIChannelProgram | UICustomProgram)[]>,
  blockSize: number,
) {
  const programCountArr = map(values(groupByShow), (programs) => {
    if (programs.length % blockSize === 0) {
      return programs.length / blockSize;
    } else {
      return programs.length;
    }
  });
  const minimumNumBlocks = leastCommonMultiple(programCountArr);

  const totalProgramsNeeded = minimumNumBlocks * blockSize;
  return [
    mapValues(groupByShow, (programs) => {
      const extraNeeded = totalProgramsNeeded - programs.length;
      return chunk(
        [
          ...programs,
          ...flatMap(range(0, extraNeeded / programs.length), () => programs),
        ],
        blockSize,
      );
    }),
    minimumNumBlocks,
  ] as const;
}

function getSimpleChunks(
  groupByShow: Record<string, (UIChannelProgram | UICustomProgram)[]>,
  blockSize: number,
  loopBlocks: boolean,
) {
  const maxLength = max(Object.values(groupByShow).map((a) => a.length)) ?? 0;
  return [
    mapValues(groupByShow, (programs) => {
      if (loopBlocks && programs.length < maxLength) {
        const lengthDiff = maxLength - programs.length;
        for (let i = 0; i < lengthDiff; i++) {
          programs.push({ ...programs[i % programs.length] });
        }
      }
      return chunk(programs, blockSize);
    }),
    maxLength,
  ] as const;
}

// Returns true if perfect sync wouldn't create a ridiculously long schedule
function canUsePerfectSync(programs: UIChannelProgram[], blockSize: number) {
  const groupByShow = chain(programs)
    .filter(
      (p): p is UIContentProgram | UICustomProgram =>
        isUIContentProgram(p) || isUICustomProgram(p),
    )
    .groupBy(groupProgram)
    .value();

  const programCountArr = map(values(groupByShow), (programs) => {
    if (programs.length % blockSize === 0) {
      return programs.length / blockSize;
    } else {
      return programs.length;
    }
  });
  const minimumNumBlocks = leastCommonMultiple(programCountArr);

  if (minimumNumBlocks > 10_000) {
    return false;
  }

  if (minimumNumBlocks * blockSize > 30_000) {
    return false;
  }

  return true;
}

function leastCommonMultiple(arr: number[]) {
  if (isEmpty(arr)) {
    return -1;
  }

  let a = Math.abs(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    let b = Math.abs(arr[i]);
    const c = a;
    while (a && b) {
      if (a > b) {
        a %= b;
      } else {
        b %= a;
      }
    }
    a = Math.abs(c * arr[i]) / (a + b);
  }

  return a;
}
