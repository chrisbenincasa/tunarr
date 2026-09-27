import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import { ContentProgramBlockShuffle } from './ProgramChunkedShuffle.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';

function makeEpisodes(
  showUuid: string,
  count: number,
  durationMs: number = 60_000,
): SlotSchedulerProgram[] {
  return Array.from(
    { length: count },
    (_, i) =>
      ({
        ...createFakeProgramOrm({
          uuid: `${showUuid}-ep-${i + 1}`,
          title: `Episode ${i + 1}`,
          type: 'episode',
          duration: durationMs,
          episode: i + 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          show: { uuid: showUuid, title: showUuid } as any,
        }),
        parentFillerLists: [],
        parentCustomShows: [],
        parentSmartCollections: [],
      }) satisfies SlotSchedulerProgram,
  );
}

function collect(
  iterator: ContentProgramBlockShuffle,
  count: number,
): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const current = iterator.current();
    ids.push(current!.id);
    iterator.next();
  }
  return ids;
}

// Maps back from a minted content program id to the original fake episode's
// title, to make assertions about "which show/episode played" readable.
function toShowEpisode(id: string): [string, number] {
  const match = /^(.+)-ep-(\d+)$/.exec(id);
  if (!match) {
    throw new Error(`Unexpected id shape: ${id}`);
  }
  return [match[1]!, Number(match[2])];
}

describe('ContentProgramBlockShuffle', () => {
  test('plays blockSize episodes from one show before moving to the next', () => {
    const showA = makeEpisodes('showA', 6);
    const showB = makeEpisodes('showB', 6);
    const iterator = new ContentProgramBlockShuffle(
      [...showA, ...showB],
      3,
      true,
    );

    const ids = collect(iterator, 12);
    const showsPlayed = ids.map((id) => toShowEpisode(id)[0]);

    // Every group of 3 consecutive plays should be from the same show.
    for (let i = 0; i < showsPlayed.length; i += 3) {
      const block = showsPlayed.slice(i, i + 3);
      expect(new Set(block).size).toBe(1);
    }

    // Both shows should have been played across the 12 slots (2 blocks each
    // of 3, for 2 shows = 12 total).
    expect(new Set(showsPlayed)).toEqual(new Set(['showA', 'showB']));
  });

  test('plays episodes within a show in order', () => {
    const showA = makeEpisodes('showA', 6);
    const iterator = new ContentProgramBlockShuffle(showA, 3, true);

    const ids = collect(iterator, 6);
    const episodeNumbers = ids.map((id) => toShowEpisode(id)[1]);

    expect(episodeNumbers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('desc direction reverses in-show episode order', () => {
    const showA = makeEpisodes('showA', 3);
    const iterator = new ContentProgramBlockShuffle(showA, 3, true, false);

    const ids = collect(iterator, 3);
    const episodeNumbers = ids.map((id) => toShowEpisode(id)[1]);

    expect(episodeNumbers).toEqual([3, 2, 1]);
  });

  test('loops a shorter show to match the longer show block-count when loopShortPrograms is true', () => {
    const showA = makeEpisodes('showA', 6); // 2 blocks of 3
    const showB = makeEpisodes('showB', 3); // 1 block of 3, needs to loop once more

    const iterator = new ContentProgramBlockShuffle(
      [...showA, ...showB],
      3,
      true,
    );

    const ids = collect(iterator, 12);
    const showBPlays = ids
      .map(toShowEpisode)
      .filter(([show]) => show === 'showB');

    // showB only has 3 episodes but should appear in both of the 2 blocks
    // (6 total plays), looping back to episode 1 for the second block.
    expect(showBPlays.length).toBe(6);
    expect(showBPlays.map(([, ep]) => ep)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  test('does not loop a shorter show when loopShortPrograms is false', () => {
    const showA = makeEpisodes('showA', 6); // 2 blocks of 3
    const showB = makeEpisodes('showB', 3); // 1 block of 3, no second block

    const iterator = new ContentProgramBlockShuffle(
      [...showA, ...showB],
      3,
      false,
    );

    const ids = collect(iterator, 9);
    const showBPlays = ids
      .map(toShowEpisode)
      .filter(([show]) => show === 'showB');

    // Without looping, showB only ever contributes its original 3 episodes
    // once, even though the full rotation (driven by showA) is longer.
    expect(showBPlays.length).toBe(3);
  });

  test('handles a single group the same as a simple ordered rotation', () => {
    const showA = makeEpisodes('showA', 4);
    const iterator = new ContentProgramBlockShuffle(showA, 2, true);

    const ids = collect(iterator, 4);
    const episodeNumbers = ids.map((id) => toShowEpisode(id)[1]);

    expect(episodeNumbers).toEqual([1, 2, 3, 4]);
  });

  test('returns an empty iterator for an empty program list', () => {
    const iterator = new ContentProgramBlockShuffle([], 3, true);
    expect(iterator.current()).toBeNull();
  });

  test('the iterator wraps around and repeats from the start', () => {
    const showA = makeEpisodes('showA', 2);
    const iterator = new ContentProgramBlockShuffle(showA, 2, true);

    const ids = collect(iterator, 4); // 2 episodes, ask for 4 -> should wrap
    const episodeNumbers = ids.map((id) => toShowEpisode(id)[1]);

    expect(episodeNumbers).toEqual([1, 2, 1, 2]);
  });
});
