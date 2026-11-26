import { Result } from '@/types/result.js';
import type { EmbyItem, EmbyMediaStream } from '@tunarr/types/emby';
import { describe, expect, it, vi } from 'vitest';
import type { MediaStream } from '../../types/Media.ts';
import { EmbyApiClient } from './EmbyApiClient.js';

vi.mock('@/util/version.js', () => ({
  getTunarrVersion: () => '1.0.0-test',
}));

const ITEM_ID = 'emby-movie-1';

function makeMinimalEmbyClient() {
  const canonicalizer = {
    getCanonicalId: (item: EmbyItem) => `emby://movie/${item.Id}`,
  };

  return new EmbyApiClient(canonicalizer, {
    mediaSource: {
      uuid: 'media-source-1',
      name: 'Test Emby' as never,
      type: 'emby',
      uri: 'http://localhost:8096',
      accessToken: 'test-token',
      libraries: [],
    } as never,
  });
}

function movieWithStreams(streams: EmbyMediaStream[]): EmbyItem {
  return {
    Id: ITEM_ID,
    Name: 'Rain Man',
    Type: 'Movie',
    RunTimeTicks: 80_000_000_000,
    MediaSources: [
      {
        Id: 'source-1',
        Protocol: 'File',
        Path: '/movies/Rain Man (1988).mkv',
        RunTimeTicks: 80_000_000_000,
        MediaStreams: [
          {
            Type: 'Video',
            Index: 0,
            Codec: 'h264',
            Width: 1920,
            Height: 1080,
          },
          ...streams,
        ],
      },
    ],
  };
}

async function canonicalizedStreams(
  streams: EmbyMediaStream[],
): Promise<MediaStream[]> {
  const client = makeMinimalEmbyClient();
  vi.spyOn(client, 'getItem').mockResolvedValue(
    Result.success(movieWithStreams(streams)),
  );

  const result = await client.getMovie(ITEM_ID);
  if (!result.isSuccess()) {
    throw new Error('expected a success');
  }
  return result.get().mediaItem?.streams ?? [];
}

describe('EmbyApiClient stream titles', () => {
  it("stores the file's track title for audio and subtitles", async () => {
    const streams = await canonicalizedStreams([
      {
        Type: 'Audio',
        Index: 1,
        Codec: 'aac',
        Channels: 2,
        Language: 'eng',
        Title: 'Commentary by director Barry Levinson',
        DisplayTitle: 'English AAC stereo',
      },
      {
        Type: 'Subtitle',
        Index: 2,
        Codec: 'srt',
        Language: 'eng',
        Title: 'English SDH',
        DisplayTitle: 'English (SRT)',
      },
    ]);

    expect(streams.find((s) => s.streamType === 'audio')?.title).toBe(
      'Commentary by director Barry Levinson',
    );
    expect(streams.find((s) => s.streamType === 'subtitles')?.title).toBe(
      'English SDH',
    );
  });

  it('falls back to the display title when the track has no title', async () => {
    const streams = await canonicalizedStreams([
      {
        Type: 'Audio',
        Index: 1,
        Codec: 'ac3',
        Channels: 6,
        DisplayTitle: 'English AC3 5.1',
      },
      {
        Type: 'Subtitle',
        Index: 2,
        Codec: 'srt',
        DisplayTitle: 'English (SRT)',
      },
    ]);

    expect(streams.find((s) => s.streamType === 'audio')?.title).toBe(
      'English AC3 5.1',
    );
    expect(streams.find((s) => s.streamType === 'subtitles')?.title).toBe(
      'English (SRT)',
    );
  });
});
