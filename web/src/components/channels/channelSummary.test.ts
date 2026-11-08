import type { ChannelSession, TvGuideProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import {
  makeContentProgram,
  makeEpisode,
  makeMovie,
  makeSeasonGrouping,
  makeShowGrouping,
} from '../../test/programFixtures.ts';
import {
  channelStatus,
  channelsM3uUrl,
  currentPrograms,
  failedGuideRetryMs,
  guideRefreshDelay,
  matchesStatusFilter,
  summarizeNowPlaying,
} from './channelSummary.ts';

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

  test('requests the episode thumbnail with no fallback param when the show is missing', () => {
    const episode = makeEpisode({ uuid: 'ep-2', title: 'Orphaned' });

    const summary = summarizeNowPlaying(content(episode), start, backend);

    expect(summary.artworkUrl).toBe(
      `${backend}/api/programs/ep-2/artwork/thumbnail`,
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

describe('currentPrograms', () => {
  const at = (offset: number, length: number): TvGuideProgram => ({
    ...content(makeMovie({ uuid: `movie-${offset}` })),
    start: start + offset,
    stop: start + offset + length,
  });

  test('picks the program that spans the instant', () => {
    const earlier = at(0, 30_000);
    const airing = at(30_000, 30_000);

    const programs = currentPrograms(
      [{ id: 'ch-1', programs: [earlier, airing] }],
      start + 45_000,
    );

    expect(programs.get('ch-1')).toBe(airing);
  });

  test("falls back to a lineup's first program", () => {
    const ended = at(0, 30_000);

    const programs = currentPrograms(
      [{ id: 'ch-1', programs: [ended] }],
      start + 60_000,
    );

    expect(programs.get('ch-1')).toBe(ended);
  });

  test('skips a channel with an empty lineup', () => {
    expect(currentPrograms([{ id: 'ch-1', programs: [] }], start).size).toBe(0);
  });
});

describe('guideRefreshDelay', () => {
  test('waits until just after the first program ends', () => {
    expect(
      guideRefreshDelay([start + 90_000, start + 30_000], start, false),
    ).toBe(31_000);
  });

  test('refetches soon when a program has already ended', () => {
    expect(guideRefreshDelay([start - 5_000], start, false)).toBe(1_000);
  });

  test('retries after a failed fetch, even with no programs', () => {
    expect(guideRefreshDelay([], start, true)).toBe(failedGuideRetryMs);
  });

  test('schedules nothing when no channel has a program', () => {
    expect(guideRefreshDelay([], start, false)).toBeUndefined();
  });
});

describe('matchesStatusFilter', () => {
  const watched = { sessions: [session(1)], stealth: false };
  const openButEmpty = { sessions: [session(0)], stealth: false };
  const hidden = { sessions: [], stealth: true };

  test('keeps every channel for all', () => {
    for (const channel of [watched, openButEmpty, hidden]) {
      expect(matchesStatusFilter(channel, 'all')).toBe(true);
    }
  });

  test('keeps only watched channels for streaming', () => {
    expect(matchesStatusFilter(watched, 'streaming')).toBe(true);
    expect(matchesStatusFilter(openButEmpty, 'streaming')).toBe(false);
    expect(matchesStatusFilter(hidden, 'streaming')).toBe(false);
  });

  test('keeps only stealth channels for stealth', () => {
    expect(matchesStatusFilter(hidden, 'stealth')).toBe(true);
    expect(matchesStatusFilter(watched, 'stealth')).toBe(false);
  });
});

describe('channelsM3uUrl', () => {
  test('adds the sorted channel numbers to an absolute URL', () => {
    expect(
      channelsM3uUrl('http://tunarr.test/api/channels.m3u', [12, 3, 7]),
    ).toBe(
      'http://tunarr.test/api/channels.m3u?channels=3%2C7%2C12&download=true',
    );
  });

  test('resolves a relative URL against the page', () => {
    expect(channelsM3uUrl('/api/channels.m3u', [1])).toBe(
      `${window.location.origin}/api/channels.m3u?channels=1&download=true`,
    );
  });

  test('asks for the full playlist as a download without numbers', () => {
    expect(channelsM3uUrl('http://tunarr.test/api/channels.m3u')).toBe(
      'http://tunarr.test/api/channels.m3u?download=true',
    );
  });
});
