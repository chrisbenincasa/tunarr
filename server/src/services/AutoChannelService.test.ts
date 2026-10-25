import type { ChannelDB } from '@/db/ChannelDB.js';
import type { SmartCollectionsDB } from '@/db/SmartCollectionsDB.js';
import type { TranscodeConfigDB } from '@/db/TranscodeConfigDB.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { Result } from '@/types/result.js';
import { describe, expect, test, vi } from 'vitest';
import { AutoChannelService } from './AutoChannelService.ts';
import type { MeilisearchService } from './MeilisearchService.ts';

vi.mock('@/services/Scheduler.js', () => ({
  GlobalScheduler: {
    getScheduledJob: () => ({ runNow: () => Promise.resolve() }),
  },
}));

const DefaultConfigId = '5f0e7c2a-3b1d-4e8f-9a6c-1d2b3c4d5e6f';

function makeService(defaultConfig: Partial<TranscodeConfigOrm> | undefined) {
  const smartCollectionsDB = {
    insert: vi.fn(() =>
      Promise.resolve(
        Result.success({ uuid: '9c1b2a3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d' }),
      ),
    ),
    materializeSmartCollection: vi.fn(() => Promise.resolve([])),
  };
  const channelDB = {
    getAllChannels: vi.fn(() => Promise.resolve([])),
    saveChannel: vi.fn(() =>
      Promise.resolve({
        channel: { uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
      }),
    ),
    updateLineup: vi.fn(() => Promise.resolve()),

    // Stops createChannel right after the channel is saved.
    loadChannelAndLineupOrm: vi.fn(() => Promise.resolve(undefined)),
  };
  const transcodeConfigDB = {
    getDefaultConfig: vi.fn(() => Promise.resolve(defaultConfig)),
  };

  const service = new AutoChannelService(
    {} as MeilisearchService,
    smartCollectionsDB as unknown as SmartCollectionsDB,
    channelDB as unknown as ChannelDB,
    transcodeConfigDB as unknown as TranscodeConfigDB,
  );

  return { service, smartCollectionsDB, channelDB };
}

const shuffleRequest = {
  presetId: '24-7-shuffle',
  contentAssignments: { all: { query: {} } },
  channelNumber: 7,
};

describe('AutoChannelService.createChannel', () => {
  test('saves the channel with the default transcode config', async () => {
    const { service, channelDB } = makeService({ uuid: DefaultConfigId });

    await expect(service.createChannel(shuffleRequest)).rejects.toThrow(
      'could not be retrieved',
    );

    expect(channelDB.saveChannel).toHaveBeenCalledWith(
      expect.objectContaining({ transcodeConfigId: DefaultConfigId }),
    );
  });

  test('fails before writing anything when no default config exists', async () => {
    const { service, smartCollectionsDB, channelDB } = makeService(undefined);

    await expect(service.createChannel(shuffleRequest)).rejects.toThrow(
      'No default transcode config exists',
    );

    expect(smartCollectionsDB.insert).not.toHaveBeenCalled();
    expect(channelDB.saveChannel).not.toHaveBeenCalled();
  });
});
