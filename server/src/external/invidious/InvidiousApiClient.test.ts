import { describe, expect, test } from 'vitest';
import { InvidiousApiClient, pickStreamPair } from './InvidiousApiClient.ts';

const fmt = (
  type: string,
  extra: Record<string, unknown> = {},
): Parameters<typeof pickStreamPair>[0][number] => ({
  url: `https://example.invalid/${type}/${JSON.stringify(extra)}`,
  type,
  ...extra,
});

describe('pickStreamPair', () => {
  test('takes the best H.264 track at or below 1080p and the best AAC track', () => {
    const pair = pickStreamPair([
      fmt('video/webm; codecs="vp9"', { resolution: '2160p', bitrate: '9' }),
      fmt('video/mp4; codecs="av01.0.09M.08"', { resolution: '1080p' }),
      fmt('video/mp4; codecs="avc1.4D401F"', {
        resolution: '720p',
        size: '1280x720',
        fps: 30,
      }),
      fmt('video/mp4; codecs="avc1.64002A"', {
        resolution: '1080p',
        size: '1920x1080',
        fps: 60,
      }),
      fmt('audio/webm; codecs="opus"', { bitrate: '160000' }),
      fmt('audio/mp4; codecs="mp4a.40.2"', {
        bitrate: '131384',
        audioChannels: 2,
      }),
    ]);

    expect(pair).toBeDefined();
    expect(pair!.videoUrl).toContain('avc1.64002A');
    expect(pair!.audioUrl).toContain('mp4a');
    expect(pair!.width).toBe(1920);
    expect(pair!.height).toBe(1080);
    expect(pair!.frameRate).toBe(60);
  });

  test('keeps the real frame size of non-16:9 videos', () => {
    const pair = pickStreamPair([
      fmt('video/mp4; codecs="avc1.4D401F"', {
        resolution: '1080p',
        size: '1440x1080',
      }),
      fmt('audio/mp4; codecs="mp4a.40.2"'),
    ]);
    expect(pair!.width).toBe(1440);
  });

  test('prefers the original-language audio track over dubs', () => {
    const pair = pickStreamPair([
      fmt('video/mp4; codecs="avc1.4D401F"', { resolution: '720p' }),
      {
        url: 'https://example.invalid/a?xtags=acont%3Ddubbed%3Alang%3Des',
        type: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: '200000',
      },
      {
        url: 'https://example.invalid/a?xtags=acont%3Doriginal%3Alang%3Den',
        type: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: '128000',
      },
    ]);
    expect(pair!.audioUrl).toContain('original');
  });

  test('returns nothing without an H.264 video track', () => {
    expect(
      pickStreamPair([
        fmt('video/webm; codecs="vp9"', { resolution: '1080p' }),
        fmt('audio/mp4; codecs="mp4a.40.2"'),
      ]),
    ).toBeUndefined();
  });
});

describe('InvidiousApiClient.isChannelId', () => {
  test('accepts UC ids and rejects handles', () => {
    expect(InvidiousApiClient.isChannelId('UCLx053rWZxCiYWsBETgdKrQ')).toBe(
      true,
    );
    expect(InvidiousApiClient.isChannelId('@LGR')).toBe(false);
  });
});
