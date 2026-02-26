import { describe, expect, it, vi } from 'vitest';
import { v4 } from 'uuid';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import type { Lineup } from '../db/derived_types/Lineup.ts';
import type { MaterializedChannelPrograms } from './XmlTvWriter.ts';
import dayjsBase from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import dayjs from '../util/dayjs.ts';

// humanize() requires the relativeTime plugin
dayjsBase.extend(relativeTime);

// Break the OnDemandChannelService -> Scheduler -> container circular chain
vi.mock('./Scheduler.ts', () => ({ GlobalScheduler: {} }));

import { TVGuideService } from './TvGuideService.ts';

function makeChannelOrm(overrides?: Partial<ChannelOrm>): ChannelOrm {
  return {
    uuid: v4(),
    number: 1,
    name: 'Test Channel',
    duration: 0,
    startTime: dayjs().subtract(1, 'hour').valueOf(),
    createdAt: null,
    updatedAt: null,
    disableFillerOverlay: false,
    fillerRepeatCooldown: null,
    groupTitle: null,
    guideFlexTitle: null,
    guideMinimumDuration: 0,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    offline: { mode: 'pic' },
    stealth: false,
    streamMode: 'hls',
    transcoding: null,
    transcodeConfigId: v4(),
    watermark: null,
    subtitlesEnabled: false,
    ...overrides,
  };
}

function makeEmptyLineup(): Lineup {
  return {
    version: 4,
    lastUpdated: Date.now(),
    items: [],
    startTimeOffsets: [],
  };
}

function makeChannelWithLineup(overrides?: Partial<ChannelOrm>) {
  const channel = makeChannelOrm(overrides);
  return { channel, lineup: makeEmptyLineup() };
}

function makeMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    child: vi.fn().mockReturnThis() as any,
    setBindings: vi.fn(),
    isLevelEnabled: vi.fn().mockReturnValue(false),
  };
}

describe('TVGuideService', () => {
  describe('buildAllChannels', () => {
    it('removes a deleted channel from XMLTV output on the next guide build', async () => {
      const channelA = makeChannelWithLineup({ number: 1, name: 'Channel A' });
      const channelB = makeChannelWithLineup({ number: 2, name: 'Channel B' });

      const mockLoadAllLineups = vi
        .fn()
        // First build: both channels are present
        .mockResolvedValueOnce({
          [channelA.channel.uuid]: channelA,
          [channelB.channel.uuid]: channelB,
        })
        // Second build: channel B has been deleted
        .mockResolvedValueOnce({
          [channelA.channel.uuid]: channelA,
        });

      const mockGetProgramsByIds = vi.fn().mockResolvedValue([]);
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      const service = new TVGuideService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeMockLogger() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { write: mockWrite } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { push: vi.fn() } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { loadAllLineups: mockLoadAllLineups } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { getProgramsByIds: mockGetProgramsByIds } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any, // ProgramConverter (not used in this path)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any, // ISettingsDB (not used in this path)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any, // Kysely<DB> (not used in this path)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any, // OnDemandChannelService (not used in this path)
      );

      const guideDuration = dayjs.duration({ hours: 4 });

      // First build: cachedGuide is populated with both channels
      await service.buildAllChannels(guideDuration, true);

      expect(mockWrite).toHaveBeenCalledTimes(1);
      const firstWriteChannelIds = (
        mockWrite.mock.calls[0][0] as MaterializedChannelPrograms[]
      ).map((entry) => entry.channel.uuid);
      expect(firstWriteChannelIds).toContain(channelA.channel.uuid);
      expect(firstWriteChannelIds).toContain(channelB.channel.uuid);

      // Second build: channel B has been deleted from the DB
      await service.buildAllChannels(guideDuration, true);

      expect(mockWrite).toHaveBeenCalledTimes(2);
      const secondWriteChannelIds = (
        mockWrite.mock.calls[1][0] as MaterializedChannelPrograms[]
      ).map((entry) => entry.channel.uuid);
      expect(secondWriteChannelIds).toContain(channelA.channel.uuid);
      expect(secondWriteChannelIds).not.toContain(channelB.channel.uuid);
    });
  });
});
