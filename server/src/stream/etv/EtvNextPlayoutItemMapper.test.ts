import type { Resolution } from '@tunarr/types';
import dayjs from 'dayjs';
import { describe, expect, test } from 'vitest';
import type {
  CommercialStreamLineupItem,
  ErrorStreamLineupItem,
  OfflineStreamLineupItem,
  ProgramStreamLineupItem,
  RedirectStreamLineupItem,
  StreamLineupProgram,
} from '@/db/derived_types/StreamLineup.js';
import { FileStreamSource, HttpStreamSource } from '../types.ts';
import {
  MissingStreamSourceError,
  UnresolvedRedirectError,
  toPlayoutItem,
} from './EtvNextPlayoutItemMapper.ts';
import { PlayoutItemSchema } from './generated/playout.ts';

const resolution: Resolution = { widthPx: 1920, heightPx: 1080 };
const startMs = dayjs('2026-02-23T20:00:00.000-05:00').valueOf();

// The mapper only reads the timing fields off a program, so a stub is enough.
const program = {} as StreamLineupProgram;

const programItem = (
  overrides: Partial<ProgramStreamLineupItem> = {},
): ProgramStreamLineupItem => ({
  type: 'program',
  program,
  infiniteLoop: false,
  programBeginMs: startMs,
  duration: 1_800_000,
  streamDuration: 1_800_000,
  startOffset: 0,
  ...overrides,
});

const map = (
  lineupItem: Parameters<typeof toPlayoutItem>[0]['lineupItem'],
  stream?: Parameters<typeof toPlayoutItem>[0]['stream'],
  offlinePicture?: string,
) =>
  toPlayoutItem({
    id: 'item-1',
    startMs,
    lineupItem,
    stream,
    resolution,
    offlinePicture,
  });

describe('timing', () => {
  test('emits RFC3339 bounds with an explicit offset and millisecond precision', () => {
    const { item } = map(programItem(), {
      source: new FileStreamSource('/media/a.mkv'),
    });

    expect(item.start).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
    expect(dayjs(item.finish).valueOf() - dayjs(item.start).valueOf()).toBe(
      1_800_000,
    );
  });

  test('seeks to startOffset and ends a streamDuration later', () => {
    const { item } = map(
      programItem({ startOffset: 300_000, streamDuration: 900_000 }),
      { source: new FileStreamSource('/media/a.mkv') },
    );

    expect(item.source).toMatchObject({
      source_type: 'local',
      in_point_ms: 300_000,
      out_point_ms: 1_200_000,
    });
  });

  test('treats a missing startOffset as playing from the top', () => {
    const { item } = map(programItem({ startOffset: undefined }), {
      source: new FileStreamSource('/media/a.mkv'),
    });

    expect(item.source).toMatchObject({
      in_point_ms: 0,
      out_point_ms: 1_800_000,
    });
  });

  test('keeps the wall-clock span and the media span equal', () => {
    const { item } = map(
      programItem({ startOffset: 120_000, streamDuration: 600_000 }),
      { source: new FileStreamSource('/media/a.mkv') },
    );
    const wallClock =
      dayjs(item.finish).valueOf() - dayjs(item.start).valueOf();
    const source = item.source;

    expect(source?.source_type).toBe('local');
    if (source?.source_type !== 'local') {
      throw new Error('expected a local source');
    }
    expect((source.out_point_ms ?? 0) - (source.in_point_ms ?? 0)).toBe(
      wallClock,
    );
  });
});

describe('stream sources', () => {
  test('maps a file source to local', () => {
    const { item } = map(programItem(), {
      source: new FileStreamSource('/media/Big Buck Bunny.mkv'),
    });

    expect(item.source).toMatchObject({
      source_type: 'local',
      path: '/media/Big Buck Bunny.mkv',
    });
  });

  test('maps an http source to http and flattens its headers', () => {
    const { item } = map(programItem(), {
      source: new HttpStreamSource('http://plex.local/stream', {
        'X-Plex-Token': 'abc123',
        Accept: '*/*',
      }),
    });

    expect(item.source).toMatchObject({
      source_type: 'http',
      uri: 'http://plex.local/stream',
      headers: ['X-Plex-Token: abc123', 'Accept: */*'],
    });
  });

  test('omits headers entirely when there are none', () => {
    const { item } = map(programItem(), {
      source: new HttpStreamSource('http://plex.local/stream'),
    });

    expect(item.source).toMatchObject({ source_type: 'http' });
    expect(item.source && 'headers' in item.source).toBe(false);
  });
});

describe('lineup item variants', () => {
  test('maps a commercial the same way as a program', () => {
    const commercial: CommercialStreamLineupItem = {
      type: 'commercial',
      program,
      infiniteLoop: false,
      fillerListId: 'filler-1',
      programBeginMs: startMs,
      duration: 30_000,
      streamDuration: 30_000,
      startOffset: 0,
    };

    const { item } = map(commercial, {
      source: new FileStreamSource('/media/ad.mkv'),
    });

    expect(item.source).toMatchObject({
      source_type: 'local',
      path: '/media/ad.mkv',
    });
  });

  test('maps a fallback item as content', () => {
    const { item } = map(
      {
        type: 'fallback',
        program,
        infiniteLoop: false,
        programBeginMs: startMs,
        duration: 60_000,
        streamDuration: 60_000,
        startOffset: 0,
      },
      { source: new FileStreamSource('/media/fallback.mkv') },
    );

    expect(item.source).toMatchObject({ source_type: 'local' });
  });

  test('gives an offline item black video and silence on separate tracks', () => {
    const offline: OfflineStreamLineupItem = {
      type: 'offline',
      programBeginMs: startMs,
      duration: 60_000,
      streamDuration: 60_000,
      startOffset: 0,
    };

    const { item } = map(offline);

    expect(item.source).toBeUndefined();
    expect(item.tracks).toEqual({
      video: {
        source: { source_type: 'lavfi', params: 'color=c=black:s=1920x1080' },
      },
      audio: { source: { source_type: 'lavfi', params: 'anullsrc' } },
    });
  });

  test("uses the channel's offline picture when it is set", () => {
    const offline: OfflineStreamLineupItem = {
      type: 'offline',
      programBeginMs: startMs,
      duration: 60_000,
      streamDuration: 60_000,
      startOffset: 0,
    };

    const { item } = map(offline, undefined, '/media/offline.png');

    expect(item.tracks?.video?.source).toEqual({
      source_type: 'local',
      path: '/media/offline.png',
    });
    expect(item.tracks?.audio?.source).toEqual({
      source_type: 'lavfi',
      params: 'anullsrc',
    });
  });

  test("sources Tunarr's own generic offline screen over http", () => {
    const { item } = map(
      {
        type: 'offline',
        programBeginMs: startMs,
        duration: 60_000,
        streamDuration: 60_000,
        startOffset: 0,
      },
      undefined,
      'http://localhost:8000/images/generic-offline-screen.png',
    );

    expect(item.tracks?.video?.source).toEqual({
      source_type: 'http',
      uri: 'http://localhost:8000/images/generic-offline-screen.png',
    });
  });

  test('ignores an offline picture on an error item, which has no picture setting', () => {
    const { item } = map(
      {
        type: 'error',
        error: 'boom',
        programBeginMs: startMs,
        duration: 30_000,
        streamDuration: 30_000,
        startOffset: 0,
      },
      undefined,
      '/media/offline.png',
    );

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
  });

  test('maps an error item to black and silence, and says what was lost', () => {
    const error: ErrorStreamLineupItem = {
      type: 'error',
      error: 'boom',
      programBeginMs: startMs,
      duration: 30_000,
      streamDuration: 30_000,
      startOffset: 0,
    };

    const { item, ignored } = map(error);

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
    expect(ignored).toHaveLength(1);
    expect(ignored[0]).toContain('error screen');
  });

  test('refuses a redirect, naming the channel the resolver must follow', () => {
    const redirect: RedirectStreamLineupItem = {
      type: 'redirect',
      channel: 'channel-7',
      programBeginMs: startMs,
      duration: 60_000,
      streamDuration: 60_000,
      startOffset: 0,
    };

    expect(() => map(redirect)).toThrow(UnresolvedRedirectError);
    expect(() => map(redirect)).toThrow(/channel-7/);
  });

  test('refuses a content item that arrived without a stream', () => {
    expect(() => map(programItem())).toThrow(MissingStreamSourceError);
  });
});

describe('schema conformance', () => {
  test('every mapped item strict-parses before it could be written', () => {
    const cases = [
      map(programItem(), { source: new FileStreamSource('/media/a.mkv') }),
      map(programItem(), {
        source: new HttpStreamSource('http://x/y', { A: 'b' }),
      }),
      map({
        type: 'offline',
        programBeginMs: startMs,
        duration: 1000,
        streamDuration: 1000,
        startOffset: 0,
      }),
      map({
        type: 'error',
        error: true,
        programBeginMs: startMs,
        duration: 1000,
        streamDuration: 1000,
        startOffset: 0,
      }),
    ];

    for (const { item } of cases) {
      expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
    }
  });
});
