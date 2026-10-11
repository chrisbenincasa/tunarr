import { countBy, groupBy, map, mapValues, range } from 'lodash-es';
import { describe, expect, test } from 'vitest';
import {
  makeContentProgram,
  makeEpisode,
  makeSeasonGrouping,
  makeShowGrouping,
} from '../../test/programFixtures.ts';
import type { UIChannelProgram } from '../../types/index.ts';
import {
  type BlockShuffleConfig,
  CyclicShuffleConfig,
  blockShuffle,
} from './useBlockShuffle.ts';

function makeShow(showId: string, episodeCount: number): UIChannelProgram[] {
  return range(1, episodeCount + 1).map((episodeNumber) => ({
    ...makeContentProgram(
      makeEpisode({
        uuid: `${showId}-e${episodeNumber}`,
        episodeNumber,
        season: makeSeasonGrouping(1),
        show: makeShowGrouping(showId),
      }),
      1000,
      `${showId}-e${episodeNumber}`,
    ),
    uiIndex: 0,
    originalIndex: 0,
  }));
}

function shuffleIds(
  programs: UIChannelProgram[],
  config: BlockShuffleConfig,
): string[] {
  return map(blockShuffle(programs, config), (p) =>
    p.type === 'content' ? p.id : '',
  );
}

function episodesByShow(ids: string[]): Record<string, string[]> {
  return groupBy(ids, (id) => id.split('-')[0]);
}

function rotateToFirst(ids: string[]): string[] {
  const first = ids.findIndex((id) => id.endsWith('-e1'));
  return [...ids.slice(first), ...ids.slice(0, first)];
}

const lineup = [...makeShow('a', 6), ...makeShow('b', 3), ...makeShow('c', 1)];

describe('blockShuffle', () => {
  test('rotate show order takes turns between shows', () => {
    const ids = shuffleIds(lineup, {
      ...CyclicShuffleConfig,
      showOrder: 'rotate',
      startEpisode: 'first',
      loopBlocks: true,
    });

    expect(ids.slice(0, 6)).toEqual([
      'a-e1',
      'b-e1',
      'c-e1',
      'a-e2',
      'b-e2',
      'c-e1',
    ]);
  });

  test.each(range(20))(
    'cyclic preset plays each episode once, in sequence from a random start (run %i)',
    () => {
      const ids = shuffleIds(lineup, CyclicShuffleConfig);

      expect(countBy(ids, (id) => id.split('-')[0])).toEqual({
        a: 6,
        b: 3,
        c: 1,
      });

      const byShow = episodesByShow(ids);
      expect(rotateToFirst(byShow.a)).toEqual(
        map(range(1, 7), (n) => `a-e${n}`),
      );
      expect(rotateToFirst(byShow.b)).toEqual(['b-e1', 'b-e2', 'b-e3']);
    },
  );

  test.each(range(20))(
    'random show order with first-episode start begins every show at episode 1 (run %i)',
    () => {
      const ids = shuffleIds(lineup, {
        ...CyclicShuffleConfig,
        startEpisode: 'first',
      });

      const byShow = episodesByShow(ids);
      expect(byShow.a).toEqual(map(range(1, 7), (n) => `a-e${n}`));
      expect(byShow.b).toEqual(['b-e1', 'b-e2', 'b-e3']);
      expect(byShow.c).toEqual(['c-e1']);
    },
  );

  test('random show order with looping plays every show equally often', () => {
    const ids = shuffleIds(lineup, {
      ...CyclicShuffleConfig,
      startEpisode: 'first',
      loopBlocks: true,
    });

    const byShow = episodesByShow(ids);
    expect(mapValues(byShow, (eps) => eps.length)).toEqual({
      a: 6,
      b: 6,
      c: 6,
    });
    expect(byShow.b).toEqual(['b-e1', 'b-e2', 'b-e3', 'b-e1', 'b-e2', 'b-e3']);
  });

  test('random show order keeps blocks of the configured size together', () => {
    const ids = shuffleIds(lineup, {
      ...CyclicShuffleConfig,
      blockSize: 2,
      startEpisode: 'first',
      loopBlocks: true,
    });

    for (let i = 0; i < ids.length; i += 2) {
      expect(ids[i].split('-')[0]).toEqual(ids[i + 1].split('-')[0]);
    }
  });
});
