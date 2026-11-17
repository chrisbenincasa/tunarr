import { describe, expect, test } from 'vitest';
import {
  makeEpisode,
  makeSeasonGrouping,
  makeShowGrouping,
} from '../test/programFixtures.ts';
import { formatTerminalProgramTitle } from './programSearch.ts';

describe('formatTerminalProgramTitle', () => {
  test('names the show, its year, and the episode code', () => {
    const episode = makeEpisode({
      title: 'Nothing to Fear',
      episodeNumber: 3,
      season: makeSeasonGrouping(1),
      show: makeShowGrouping('show-1', { title: 'Batman', year: 1992 }),
    });

    expect(formatTerminalProgramTitle(episode)).toBe(
      'Nothing to Fear - Batman (1992) S01E03',
    );
  });

  test('leaves out the year when the show has none', () => {
    const episode = makeEpisode({
      title: 'Nothing to Fear',
      episodeNumber: 3,
      season: makeSeasonGrouping(1),
      show: makeShowGrouping('show-1', { title: 'Batman', year: null }),
    });

    expect(formatTerminalProgramTitle(episode)).toBe(
      'Nothing to Fear - Batman S01E03',
    );
  });

  test('leaves out the season when the episode has none', () => {
    const episode = makeEpisode({
      title: 'Nothing to Fear',
      episodeNumber: 3,
      show: makeShowGrouping('show-1', { title: 'Batman', year: 1992 }),
    });

    expect(formatTerminalProgramTitle(episode)).toBe(
      'Nothing to Fear - Batman (1992) E03',
    );
  });

  test('uses the episode title alone when the show is missing', () => {
    const episode = makeEpisode({ title: 'Nothing to Fear' });

    expect(formatTerminalProgramTitle(episode)).toBe('Nothing to Fear');
  });
});
