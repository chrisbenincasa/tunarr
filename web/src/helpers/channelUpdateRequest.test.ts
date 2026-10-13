import type { SaveableChannel } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { toChannelUpdateRequest } from './channelUpdateRequest.ts';

const loadedStartTime = 1_700_000_012_345;

const channel: SaveableChannel = {
  disableFillerOverlay: false,
  duration: 60000,
  groupTitle: 'test',
  guideMinimumDuration: 30000,
  icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Test',
  number: 1,
  offline: { mode: 'pic' },
  startTime: loadedStartTime,
  stealth: false,
  streamMode: 'hls',
  transcodeConfigId: '00000000-0000-0000-0000-000000000000',
  subtitlesEnabled: false,
};

describe('toChannelUpdateRequest', () => {
  test('omits startTime when the user left it unchanged', () => {
    const request = toChannelUpdateRequest(channel, loadedStartTime);

    expect(request).not.toHaveProperty('startTime');
    expect(request.name).toBe('Test');
  });

  test('sends startTime when the user changed it', () => {
    const request = toChannelUpdateRequest(
      { ...channel, startTime: 1_800_000_000_000 },
      loadedStartTime,
    );

    expect(request.startTime).toBe(1_800_000_000_000);
  });
});
