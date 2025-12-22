import {
  chunk,
  flatMap,
  forEach,
  groupBy,
  isEmpty,
  map,
  mapValues,
  max,
  orderBy,
  range,
  shuffle,
  values,
} from 'lodash-es';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import {
  useChannelEditorLazy,
  useCustomShowEditor,
} from '../../store/selectors.ts';
import {
  type UIChannelProgram,
  type UIContentProgram,
  type UICustomProgram,
  isUIContentProgram,
  isUICustomProgram,
} from '../../types/index.ts';
import { type Maybe } from '../../types/util.ts';
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
      const seasonNumber = p.parent?.index ?? p.seasonNumber ?? 1;
      const episodeNumber = p.index ?? p.episodeNumber ?? 1;
      return seasonNumber * (1e5 + episodeNumber);
    }

    case 'alpha':
      return p.grandparent?.title ?? p.title;
  }
}

export function useBlockShuffle() {
  const { materializeOriginalProgramList } = useChannelEditorLazy();

  return {
    canUsePerfectSync: (blockSize: number) =>
      canUsePerfectSync(materializeOriginalProgramList(), blockSize),
    blockShuffle: (options: BlockShuffleConfig | null) => {
      const alternatingShows = blockShuffle(
        materializeOriginalProgramList(),
        options,
      );
      if (alternatingShows) {
        setCurrentLineup(alternatingShows, true);
      }
    },
  };
}

export function useCustomShowBlockShuffle() {
  const { programList } = useCustomShowEditor();
  return {
    canUsePerfectSync: (blockSize: number) =>
      canUsePerfectSync(programList, blockSize),
    blockShuffle: (options: BlockShuffleConfig | null) => {
      const alternatingShows = blockShuffle(programList, options);
      if (alternatingShows) {
        // We know there shouldn't be any custom programs in here, but we'll unwrap
        // just to appease the typechecker.
        setCurrentCustomShowProgramming(
          alternatingShows.filter(isUIContentProgram),
        );
      }
    },
  };
}

function blockShuffle(
  programs: UIChannelProgram[],
  options: BlockShuffleConfig | null,
): Maybe<Array<UICustomProgram | UIContentProgram>> {
  if (isEmpty(programs)) {
    return;
  }

  const showsAscending = (options?.sortOptions.show.order ?? 'asc') === 'asc';
  const moviesAscending =
    (options?.sortOptions.movies.order ?? 'asc') === 'asc';

  let validPrograms = removeDuplicatePrograms(programs).filter(
    (p): p is UIContentProgram | UICustomProgram =>
      isUIContentProgram(p) || isUICustomProgram(p),
  );
  if (options?.shuffleType === 'Random') {
    validPrograms = shuffle(validPrograms);
  }

  const groupByShow = groupBy(validPrograms, getProgramGroupingKey);

  if (options?.shuffleType === 'Fixed') {
    forEach(groupByShow, (programs, key) => {
      if (key.startsWith('custom')) {
        groupByShow[key] = orderBy(
          programs as UICustomProgram[],
          (p) => p.index,
          [showsAscending ? 'asc' : 'desc'],
        );
      } else if (key.startsWith('show') || key.startsWith('track')) {
        groupByShow[key] = orderBy(
          programs as UIContentProgram[],
          (p) => sortProgram(p, 'index'),
          [showsAscending ? 'asc' : 'desc'],
        );
      } else if (key.startsWith('movie')) {
        groupByShow[key] = orderBy(
          programs as UIContentProgram[],
          (p) =>
            sortProgram(p, options?.sortOptions.movies.sort ?? 'release_date'),
          [moviesAscending ? 'asc' : 'desc'],
        );
      }
    });
  }

  const blockSize = options?.blockSize ?? 3;

  const [chunks, loops] = options?.perfectSync
    ? getPerfectSyncChunks(groupByShow, blockSize)
    : getSimpleChunks(groupByShow, blockSize, options?.loopBlocks ?? true);

  const alternatingShows = flatMap(range(loops), (i) =>
    flatMap(chunks, (chunk) => (i < chunk.length ? [...chunk[i]] : [])),
  );

  return alternatingShows;
}

function getPerfectSyncChunks(
  groupByShow: Record<string, Array<UIContentProgram | UICustomProgram>>,
  blockSize: number,
): [Record<string, Array<UIContentProgram | UICustomProgram>[]>, number] {
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
  groupByShow: Record<string, Array<UIContentProgram | UICustomProgram>>,
  blockSize: number,
  loopBlocks: boolean,
): [Record<string, Array<UIContentProgram | UICustomProgram>[]>, number] {
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
  const groupByShow = groupBy(
    programs.filter(
      (p): p is UIContentProgram | UICustomProgram =>
        isUIContentProgram(p) || isUICustomProgram(p),
    ),
    getProgramGroupingKey,
  );

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
