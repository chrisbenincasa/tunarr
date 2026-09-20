import { describe, expect, test } from 'vitest';
import {
  bandwidthBps,
  createMultivariantPlaylist,
} from './EtvNextPlaylistCreator.ts';

const options = {
  streamBaseUrl: '/stream/channels/abc-123/etv_next/',
  videoBitrateKbps: 10000,
  audioBitrateKbps: 192,
  includeSubtitles: true,
};

describe('bandwidthBps', () => {
  // Kept identical to upstream's channel_model.rs so a channel advertises the
  // same number under either backend.
  test('sums the bitrates and adds ten percent for container overhead', () => {
    expect(bandwidthBps(4000, 192)).toBe(4611200);
    expect(bandwidthBps(10000, 192)).toBe(11211200);
  });
});

describe('createMultivariantPlaylist', () => {
  test('emits a playlist pointing at the worker media playlist', () => {
    const playlist = createMultivariantPlaylist(options);

    expect(playlist).toBe(
      [
        '#EXTM3U',
        '#EXT-X-VERSION:6',
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",' +
          'DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="en",' +
          'URI="/stream/channels/abc-123/etv_next/live_sub.m3u8"',
        '#EXT-X-STREAM-INF:BANDWIDTH=11211200,SUBTITLES="subs"',
        '/stream/channels/abc-123/etv_next/live.m3u8',
        '',
      ].join('\n'),
    );
  });

  test('omits the subtitle rendition and its reference when the flag is off', () => {
    const playlist = createMultivariantPlaylist({
      ...options,
      includeSubtitles: false,
    });

    expect(playlist).not.toContain('EXT-X-MEDIA');
    expect(playlist).not.toContain('SUBTITLES=');
    expect(playlist).toContain('#EXT-X-STREAM-INF:BANDWIDTH=11211200\n');
    expect(playlist).toContain('/stream/channels/abc-123/etv_next/live.m3u8');
  });

  test('adds the separator when the base URL lacks a trailing slash', () => {
    const playlist = createMultivariantPlaylist({
      ...options,
      streamBaseUrl: '/stream/channels/abc-123/etv_next',
    });

    expect(playlist).toContain('/stream/channels/abc-123/etv_next/live.m3u8');
    expect(playlist).not.toContain('etv_nextlive.m3u8');
  });

  test('ends with a newline, which some clients require', () => {
    expect(createMultivariantPlaylist(options).endsWith('\n')).toBe(true);
  });
});
