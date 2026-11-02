import type { ChannelSession, TvGuideProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import {
  makeContentProgram,
  makeEpisode,
  makeMovie,
  makeSeasonGrouping,
  makeShowGrouping,
} from '../../test/programFixtures.ts';
import { channelStatus, summarizeNowPlaying } from './channelSummary.ts';

const backend = 'http://tunarr.test';
const start = 1_000_000;
const stop = start + 60_000;

const content = (
  program: Parameters<typeof makeContentProgram>[0],
): TvGuideProgram => ({
  ...makeContentProgram(program, stop - start),
  start,
  stop,
  isPaused: false,
});

const session = (numConnections: number): ChannelSession => ({
  type: 'hls',
  state: 'started',
  numConnections,
  connections: [],
});

describe('summarizeNowPlaying', () => {
  test('names the show and the episode code for an episode', () => {
    const episode = makeEpisode({
      uuid: 'ep-1',
      title: 'Nothing to Fear',
      episodeNumber: 3,
      season: makeSeasonGrouping(1),
      show: makeShowGrouping('show-1', { title: 'Batman' }),
    });

    const summary = summarizeNowPlaying(
      content(episode),
      start + 15_000,
      backend,
    );

    expect(summary).toMatchObject({
      kind: 'content',
      title: 'Batman',
      detail: 'S01E03 · Nothing to Fear',
      code: 'S01E03',
      progress: 0.25,
    });
    expect(summary.artworkUrl).toBe(
      `${backend}/api/programs/show-1/artwork/fanart?fallbackArtworkTypes=poster`,
    );
  });

  test('uses the program title for a movie', () => {
    const movie = makeMovie({ uuid: 'movie-1', title: 'Back to the Future' });

    const summary = summarizeNowPlaying(content(movie), start, backend);

    expect(summary).toMatchObject({ title: 'Back to the Future', progress: 0 });
    expect(summary.detail).toBeUndefined();
    expect(summary.artworkUrl).toBe(
      `${backend}/api/programs/movie-1/artwork/banner?fallbackArtworkTypes=fanart,poster`,
    );
  });

  test('clamps progress to the program bounds', () => {
    const movie = makeMovie();
    expect(
      summarizeNowPlaying(content(movie), stop + 5_000, backend).progress,
    ).toBe(1);
    expect(
      summarizeNowPlaying(content(movie), start - 5_000, backend).progress,
    ).toBe(0);
  });

  test('reports flex by its guide title and redirects by channel', () => {
    expect(
      summarizeNowPlaying(
        {
          type: 'flex',
          duration: 1,
          start,
          stop,
          isPaused: false,
          title: 'Flex',
        },
        start,
        backend,
      ),
    ).toMatchObject({ kind: 'flex', title: 'Flex' });

    const redirect = summarizeNowPlaying(
      {
        type: 'redirect',
        duration: 1,
        channel: 'c2',
        channelNumber: 2,
        channelName: 'Two',
        start,
        stop,
        isPaused: false,
      },
      start,
      backend,
    );
    expect(redirect).toMatchObject({ kind: 'redirect', redirectChannel: 2 });
    expect(redirect.title).toBeUndefined();
  });
});

describe('channelStatus', () => {
  test('is idle with no sessions', () => {
    expect(channelStatus(undefined)).toEqual({
      status: 'idle',
      connections: 0,
      sessions: 0,
    });
  });

  test('is live when any session has a connection', () => {
    expect(channelStatus([session(2), session(0)])).toEqual({
      status: 'live',
      connections: 2,
      sessions: 2,
    });
  });

  test('warns when sessions stay open with nobody connected', () => {
    expect(channelStatus([session(0)]).status).toBe('warning');
  });
});
