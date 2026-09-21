import type { Resolution } from '@tunarr/types';
import dayjs from 'dayjs';
import { describe, expect, test } from 'vitest';
import type {
  CommercialStreamLineupItem,
  ErrorStreamLineupItem,
  FallbackStreamLineupItem,
  OfflineStreamLineupItem,
  ProgramStreamLineupItem,
  RedirectStreamLineupItem,
  StreamLineupProgram,
} from '@/db/derived_types/StreamLineup.js';
import { FileStreamSource, HttpStreamSource } from '../types.ts';
import {
  MissingStreamSourceError,
  StreamTerminationRequestedError,
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
  overrides: Partial<Parameters<typeof toPlayoutItem>[0]> = {},
) =>
  toPlayoutItem({
    id: 'item-1',
    startMs,
    lineupItem,
    stream,
    resolution,
    ...overrides,
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

    const { item } = map(offline, undefined, {
      offlinePicture: '/media/offline.png',
    });

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
      {
        offlinePicture:
          'http://localhost:8000/images/generic-offline-screen.png',
      },
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
      { offlinePicture: '/media/offline.png' },
    );

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
  });

  test('defaults an error item to black and silence, with nothing lost', () => {
    const error: ErrorStreamLineupItem = {
      type: 'error',
      error: 'boom',
      programBeginMs: startMs,
      duration: 30_000,
      streamDuration: 30_000,
      startOffset: 0,
    };

    const { item, ignored } = map(error);

    expect(item.tracks).toEqual({
      video: {
        source: { source_type: 'lavfi', params: 'color=c=black:s=1920x1080' },
      },
      audio: { source: { source_type: 'lavfi', params: 'anullsrc' } },
    });
    expect(ignored).toEqual([]);
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

const offlineItem = (): OfflineStreamLineupItem => ({
  type: 'offline',
  programBeginMs: startMs,
  duration: 60_000,
  streamDuration: 60_000,
  startOffset: 0,
});

const errorItem = (
  error: ErrorStreamLineupItem['error'] = 'boom',
): ErrorStreamLineupItem => ({
  type: 'error',
  error,
  programBeginMs: startMs,
  duration: 30_000,
  streamDuration: 30_000,
  startOffset: 0,
});

const errorVideoParams = (
  overrides: Partial<Parameters<typeof toPlayoutItem>[0]> = {},
  error: ErrorStreamLineupItem['error'] = 'boom',
) => {
  const source = map(errorItem(error), undefined, overrides).item.tracks?.video
    ?.source;

  if (source?.source_type !== 'lavfi') {
    throw new Error(
      `expected a lavfi video source, got ${source?.source_type}`,
    );
  }

  return source.params;
};

describe('error screens', () => {
  test('blank stays black at the channel resolution', () => {
    expect(errorVideoParams({ errorScreen: 'blank' })).toBe(
      'color=c=black:s=1920x1080',
    );
  });

  test('testsrc mirrors the pipeline test pattern', () => {
    expect(errorVideoParams({ errorScreen: 'testsrc' })).toBe(
      'testsrc=size=1920x1080',
    );
  });

  test('static generates noise small, as the pipeline does, and lets it scale', () => {
    expect(errorVideoParams({ errorScreen: 'static' })).toBe(
      'nullsrc=s=480x270,geq=random(1)*255:128:128',
    );
  });

  test('pic plays the configured error picture', () => {
    const { item, ignored } = map(errorItem(), undefined, {
      errorScreen: 'pic',
      errorPicture: 'http://localhost:8000/images/generic-error-screen.png',
    });

    expect(item.tracks?.video?.source).toEqual({
      source_type: 'http',
      uri: 'http://localhost:8000/images/generic-error-screen.png',
    });
    expect(ignored).toEqual([]);
  });

  test('pic takes a local error picture as a file', () => {
    const { item } = map(errorItem(), undefined, {
      errorScreen: 'pic',
      errorPicture: '/media/error.png',
    });

    expect(item.tracks?.video?.source).toEqual({
      source_type: 'local',
      path: '/media/error.png',
    });
  });

  test('pic falls back to black and says so when no picture is configured', () => {
    const { item, ignored } = map(errorItem(), undefined, {
      errorScreen: 'pic',
    });

    expect(item.tracks?.video?.source).toEqual({
      source_type: 'lavfi',
      params: 'color=c=black:s=1920x1080',
    });
    expect(ignored).toEqual([
      'no error picture is configured, so the error item plays as black',
    ]);
  });

  test('text draws the title and message at the sizes TitleTextFilter derives', () => {
    expect(errorVideoParams({ errorScreen: 'text' })).toBe(
      'color=c=black:s=1920x1080,' +
        "drawtext=expansion=none:fontsize=50:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='Error'," +
        "drawtext=expansion=none:fontsize=33:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+66)/2:text='boom'",
    );
  });

  test('text scales its font sizes with the channel height', () => {
    const params = map(errorItem(), undefined, {
      errorScreen: 'text',
      resolution: { widthPx: 640, heightPx: 360 },
    }).item.tracks?.video?.source;

    if (params?.source_type !== 'lavfi') {
      throw new Error('expected a lavfi video source');
    }

    // ceil(360/33) = 11, ceil(11 * 3 / 2) = 17, gap = 22.
    expect(params.params).toContain('fontsize=17');
    expect(params.params).toContain('fontsize=11');
    expect(params.params).toContain('y=(h+text_h+22)/2');
  });

  test('text reads the message off an Error instance', () => {
    expect(
      errorVideoParams({ errorScreen: 'text' }, new Error('it broke')),
    ).toContain("text='it broke'");
  });

  test('text renders an empty subtitle when the item carries no message', () => {
    expect(errorVideoParams({ errorScreen: 'text' }, true)).toContain(
      "text=''",
    );
  });

  test('kill refuses to render and tells the caller to end the stream', () => {
    expect(() =>
      map(errorItem('upstream gone'), undefined, { errorScreen: 'kill' }),
    ).toThrow(StreamTerminationRequestedError);
    expect(() =>
      map(errorItem('upstream gone'), undefined, { errorScreen: 'kill' }),
    ).toThrow(/upstream gone/);
  });

  test('kill applies whatever the audio setting is, because nothing is rendered', () => {
    expect(() =>
      map(errorItem(), undefined, {
        errorScreen: 'kill',
        errorScreenAudio: 'sine',
      }),
    ).toThrow(StreamTerminationRequestedError);
  });
});

describe('error screen audio', () => {
  const audioParams = (
    audio: Parameters<typeof toPlayoutItem>[0]['errorScreenAudio'],
  ) => {
    const source = map(errorItem(), undefined, { errorScreenAudio: audio }).item
      .tracks?.audio?.source;

    if (source?.source_type !== 'lavfi') {
      throw new Error('expected a lavfi audio source');
    }

    return source.params;
  };

  test('silent stays on anullsrc', () => {
    expect(audioParams('silent')).toBe('anullsrc');
  });

  test('sine plays the 400 Hz tone the pipeline uses', () => {
    expect(audioParams('sine')).toBe('sine=f=400');
  });

  test('whitenoise matches the pipeline noise source', () => {
    expect(audioParams('whitenoise')).toBe('anoisesrc=c=white:a=0.7');
  });

  test('audio is chosen independently of the screen type', () => {
    const { item } = map(errorItem(), undefined, {
      errorScreen: 'static',
      errorScreenAudio: 'whitenoise',
    });

    expect(item.tracks?.video?.source).toMatchObject({
      params: 'nullsrc=s=480x270,geq=random(1)*255:128:128',
    });
    expect(item.tracks?.audio?.source).toMatchObject({
      params: 'anoisesrc=c=white:a=0.7',
    });
  });
});

describe('drawtext escaping', () => {
  const textParams = (message: string) =>
    errorVideoParams({ errorScreen: 'text' }, message);

  /**
   * The whole graph has to stay exactly two `drawtext` filters, with the
   * message confined to the last quoted value and no quote inside it. A
   * message that escaped its quoting could not match this.
   */
  const intactGraph =
    /^color=c=black:s=1920x1080,drawtext=expansion=none:fontsize=50:fontcolor=white:x=\(w-text_w\)\/2:y=\(h-text_h\)\/2:text='Error',drawtext=expansion=none:fontsize=33:fontcolor=white:x=\(w-text_w\)\/2:y=\(h\+text_h\+66\)\/2:text='([^']*)'$/;

  test.each([
    ['single quote', "a'b"],
    ['quote then appended filter', "x',hue=s=0,drawtext=text='pwned"],
    ['quote then appended chain', "x';[0:v]negate[v];[v]null"],
    ['quote closing the graph', "x'"],
    ['backslash', 'a\\b'],
    ['escaped quote', "a\\'b"],
    ['colon', 'a:b'],
    ['comma', 'a,b'],
    ['semicolon', 'a;b'],
    ['brackets', 'a[0:v]b'],
    ['percent expansion', 'a%{pts}b'],
    ['newline', 'a\nb'],
    ['carriage return', 'a\rb'],
    ['null byte', 'a\u0000b'],
    ['equals', 'a=b'],
  ])('%s cannot break out of the drawtext value', (_name, message) => {
    const params = textParams(message);
    const match = intactGraph.exec(params);

    expect(match).not.toBeNull();
    expect((params.match(/'/g) ?? []).length).toBe(4);

    // Nothing the message carries may survive as an escape or an expansion.
    const drawn = match?.[1] ?? '';
    expect(drawn).not.toContain("'");
    expect(drawn).not.toContain('\\');
    expect(drawn).not.toContain('%');
  });

  test('drops quotes, backslashes and percent signs from the message', () => {
    expect(textParams("it's 100% a\\b")).toContain("text='its 100 ab'");
  });

  test('keeps colons and commas, which the quoting already makes literal', () => {
    expect(textParams('Error: a, b')).toContain("text='Error: a, b'");
  });

  test('collapses control characters and runs of whitespace into single spaces', () => {
    expect(textParams('a\n\n  b\tc')).toContain("text='a b c'");
  });

  test('truncates a long message so the filter stays sane', () => {
    const params = textParams('x'.repeat(500));

    expect(params).toContain(`text='${'x'.repeat(120)}'`);
    expect(params).not.toContain('x'.repeat(121));
  });

  test('no other screen carries the message at all', () => {
    for (const screen of ['blank', 'testsrc', 'static', 'pic'] as const) {
      expect(
        errorVideoParams({ errorScreen: screen }, "x',hue=s=0"),
      ).not.toContain('hue');
    }
  });
});

describe('offline modes', () => {
  /**
   * These cover a branch no caller reaches.
   *
   * `resolveStream` answers `undefined` for anything not content backed, and
   * an offline item never is, so an offline item carrying a stream is a shape
   * only a test builds. Clip flex really arrives as `type: 'fallback'`, which
   * is content backed and takes the content path asserted below. Kept because
   * the branch is still in the mapper; delete the two together if it goes.
   */
  test('clip mode falls back to the picture and says so when no clip resolved', () => {
    const { item, ignored } = map(offlineItem(), undefined, {
      offlineMode: 'clip',
      offlinePicture: '/media/offline.png',
    });

    expect(item.source).toBeUndefined();
    expect(item.tracks?.video?.source).toEqual({
      source_type: 'local',
      path: '/media/offline.png',
    });
    expect(ignored).toEqual([
      'the channel fills flex with a clip, but none was resolved, so the item plays as a still or black',
    ]);
  });

  // What clip flex actually looks like by the time it reaches the mapper.
  // `StreamProgramCalculator` emits a fallback program rather than an offline
  // item, so the soundtrack override never applies to a clip.
  test('a clip fills flex as a fallback program, taking the content path', () => {
    const { item, ignored } = map(
      {
        type: 'fallback',
        program,
        infiniteLoop: false,
        programBeginMs: startMs,
        duration: 60_000,
        streamDuration: 60_000,
        startOffset: 0,
      } satisfies FallbackStreamLineupItem,
      { source: new FileStreamSource('/media/fallback-clip.mkv') },
      { offlineMode: 'clip', offlineSoundtrack: '/media/theme.mp3' },
    );

    expect(item.source).toMatchObject({
      source_type: 'local',
      path: '/media/fallback-clip.mkv',
      in_point_ms: 0,
      out_point_ms: 60_000,
    });
    expect(item.tracks).toBeUndefined();
    expect(ignored).toEqual([]);
  });

  test('pic mode plays the soundtrack instead of silence', () => {
    const { item } = map(offlineItem(), undefined, {
      offlinePicture: '/media/offline.png',
      offlineSoundtrack: 'http://localhost:8000/media/theme.mp3',
    });

    expect(item.tracks).toEqual({
      video: { source: { source_type: 'local', path: '/media/offline.png' } },
      audio: {
        source: {
          source_type: 'http',
          uri: 'http://localhost:8000/media/theme.mp3',
        },
      },
    });
  });

  test('an empty soundtrack setting stays silent', () => {
    const { item } = map(offlineItem(), undefined, { offlineSoundtrack: '' });

    expect(item.tracks?.audio?.source).toEqual({
      source_type: 'lavfi',
      params: 'anullsrc',
    });
  });
});

describe('schema conformance of the screen variants', () => {
  test('every error screen and audio pairing strict-parses', () => {
    const screens = ['blank', 'pic', 'static', 'testsrc', 'text'] as const;
    const audio = ['silent', 'sine', 'whitenoise'] as const;

    for (const errorScreen of screens) {
      for (const errorScreenAudio of audio) {
        const { item } = map(errorItem("it's : broken, %{pts}"), undefined, {
          errorScreen,
          errorScreenAudio,
          errorPicture: '/media/error.png',
        });

        expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
      }
    }
  });

  test('every offline shape strict-parses', () => {
    const cases = [
      map(offlineItem(), undefined, { offlineMode: 'clip' }),
      map(
        offlineItem(),
        { source: new FileStreamSource('/media/clip.mkv') },
        { offlineMode: 'clip', offlineSoundtrack: '/media/theme.mp3' },
      ),
      map(offlineItem(), undefined, {
        offlinePicture: '/media/offline.png',
        offlineSoundtrack: 'http://localhost:8000/theme.mp3',
      }),
    ];

    for (const { item } of cases) {
      expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
    }
  });
});
