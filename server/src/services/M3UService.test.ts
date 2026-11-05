import { describe, expect, test } from 'vitest';
import { buildChannelsM3U } from './M3UService.ts';

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
      streamLines(buildChannelsM3U([], {
          placeholderWhenEmpty: true,
          includeStealth: false,
        })),
    ).toEqual(['{{host}}/setup']);
    expect(
      streamLines(buildChannelsM3U([], {
          placeholderWhenEmpty: false,
          includeStealth: false,
        })),
    ).toEqual([]);
  });
});
