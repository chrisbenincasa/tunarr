import { Result } from '@/types/result.js';
import { describe, expect, it, vi } from 'vitest';
import { EmbyApiClient } from './EmbyApiClient.js';

function makeMinimalEmbyClient() {
  const canonicalizer = {
    getCanonicalId: (item: { Id: string }) => `emby://video/${item.Id}`,
  };

  return new EmbyApiClient(canonicalizer as never, {
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

describe('EmbyApiClient other video metadata', () => {
  it('maps Summary to summary', async () => {
    const client = makeMinimalEmbyClient();
    vi.spyOn(client, 'doTypeCheckedGet' as never).mockResolvedValue(
      Result.success({
        Items: [
          {
            Id: 'other-video-1',
            Name: 'Filler Clip',
            Type: 'Video',
            RunTimeTicks: 60_000 * 10_000,
            Summary: 'An Emby overview',
            MediaSources: [
              {
                Protocol: 'File',
                Path: '/media/filler.mkv',
                MediaStreams: [
                  {
                    Type: 'Video',
                    Index: 0,
                    Codec: 'h264',
                    Width: 1920,
                    Height: 1080,
                  },
                ],
              },
            ],
          },
        ],
        TotalRecordCount: 1,
        StartIndex: 0,
      }) as never,
    );

    const result = await client.getVideo('other-video-1');

    expect(result.isSuccess()).toBe(true);
    expect(result.get().summary).toBe('An Emby overview');
  });
});
