import { describe, expect, test, vi } from 'vitest';
import type * as Globals from '@/globals.js';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import {
  buildChannelsM3U,
  ChannelNumbersParamPattern,
  M3uService,
  parseChannelNumbersParam,
} from './M3UService.ts';

// FileCacheService reads the data directory when constructed.
vi.mock('@/globals.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Globals>()),
  globalOptions: () => ({ databaseDirectory: '/nonexistent' }),
}));

const channel = (number: number, name: string, stealth = false) => ({
  uuid: `uuid-${number}`,
  number,
  name,
  icon: { path: '', width: 0, duration: 0, position: 'bottom-right' as const },
  groupTitle: 'tunarr',
  stealth,
  streamMode: 'hls' as const,
});

const streamLines = (m3u: string) =>
  m3u.split('\n').filter((line) => line.startsWith('{{host}}/'));

describe('buildChannelsM3U', () => {
  test('lists channels by number and skips stealth channels', () => {
    const m3u = buildChannelsM3U(
      [channel(4, 'Four'), channel(1, 'One'), channel(2, 'Hidden', true)],
      { placeholderWhenEmpty: true, includeStealth: false },
    );
    expect(streamLines(m3u)).toEqual([
      '{{host}}/stream/channels/uuid-1?streamMode=hls',
      '{{host}}/stream/channels/uuid-4?streamMode=hls',
    ]);
    expect(m3u).toContain('tvg-chno="1" tvg-name="One"');
  });

  test('keeps stealth channels when asked', () => {
    const m3u = buildChannelsM3U(
      [channel(1, 'One'), channel(2, 'Hidden', true)],
      { placeholderWhenEmpty: false, includeStealth: true },
    );
    expect(streamLines(m3u)).toEqual([
      '{{host}}/stream/channels/uuid-1?streamMode=hls',
      '{{host}}/stream/channels/uuid-2?streamMode=hls',
    ]);
  });

  test('adds the setup entry only when asked and there are no channels', () => {
    expect(
      streamLines(
        buildChannelsM3U([], {
          placeholderWhenEmpty: true,
          includeStealth: false,
        }),
      ),
    ).toEqual(['{{host}}/setup']);
    expect(
      streamLines(
        buildChannelsM3U([], {
          placeholderWhenEmpty: false,
          includeStealth: false,
        }),
      ),
    ).toEqual([]);
  });
});

describe('M3uService.getChannelsM3UFor', () => {
  const service = (channels: ReturnType<typeof channel>[]) =>
    new M3uService({
      getAllChannels: () => Promise.resolve(channels as ChannelOrm[]),
    } as Partial<IChannelDB> as IChannelDB);

  test('lists only the requested numbers, with the host filled in', async () => {
    const m3u = await service([
      channel(1, 'One'),
      channel(4, 'Four'),
      channel(7, 'Seven', true),
    ]).getChannelsM3UFor('http://tunarr.test', [7, 1], true);

    expect(
      m3u.split('\n').filter((line) => line.startsWith('http://')),
    ).toEqual([
      'http://tunarr.test/stream/channels/uuid-1?streamMode=hls',
      'http://tunarr.test/stream/channels/uuid-7?streamMode=hls',
    ]);
    expect(m3u).not.toContain('{{host}}');
  });

  test('drops a requested stealth channel without includeStealth', async () => {
    const m3u = await service([
      channel(1, 'One'),
      channel(7, 'Seven', true),
    ]).getChannelsM3UFor('http://tunarr.test', [7, 1], false);

    expect(m3u).toContain('uuid-1');
    expect(m3u).not.toContain('uuid-7');
  });

  test('returns only the header when no number matches', async () => {
    const m3u = await service([channel(1, 'One')]).getChannelsM3UFor(
      'http://tunarr.test',
      [99],
      true,
    );
    expect(m3u.trim().split('\n')).toHaveLength(1);
  });
});

describe('channels query param', () => {
  test('accepts comma-separated numbers', () => {
    expect(ChannelNumbersParamPattern.test('1,4,17')).toBe(true);
    expect(parseChannelNumbersParam('1,4,17')).toEqual([1, 4, 17]);
  });

  test.each(['', '1,', ',1', '1,,4', '1.5', '-1', 'a', '1, 4'])(
    'rejects %j',
    (param) => {
      expect(ChannelNumbersParamPattern.test(param)).toBe(false);
    },
  );
});
