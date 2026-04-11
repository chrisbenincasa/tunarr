import { describe, expect, it, vi } from 'vitest';
import { v4 } from 'uuid';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import type { Lineup } from '../db/derived_types/Lineup.ts';
import type { MaterializedChannelPrograms } from './XmlTvWriter.ts';
import type { ChannelPrograms } from './TvGuideService.ts';
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

  describe('getChannelLineup', () => {
    // Helper: build an offline GuideItem at a given start with a given duration
    function makeGuideItem(startTimeMs: number, durationMs: number) {
      return {
        lineupItem: { type: 'offline' as const, durationMs },
        startTimeMs,
      };
    }

    function makeService() {
      return new TVGuideService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeMockLogger() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { write: vi.fn().mockResolvedValue(undefined) } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { push: vi.fn() } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { loadAllLineups: vi.fn().mockResolvedValue({}) } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { getProgramsByIds: vi.fn().mockResolvedValue([]) } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
      );
    }

    /**
     * Seed the service's private cache directly so we can test
     * getChannelLineup without going through guide generation.
     */
    function seedCache(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service: any,
      channel: ChannelOrm,
      programs: ReturnType<typeof makeGuideItem>[],
      cacheEndMs: number,
    ) {
      const entry: ChannelPrograms = {
        channel,
        programs: programs as ChannelPrograms['programs'],
      };
      service['cachedGuide'] = { [channel.uuid]: entry };
      service['lastEndTime'] = { [channel.uuid]: cacheEndMs };
    }

    // Base timestamp: midnight UTC 2024-01-01
    const BASE = new Date('2024-01-01T00:00:00Z').getTime();
    const MIN = 60_000;
    const HOUR = 60 * MIN;

    // The query range under test: [BASE + 60min, BASE + 120min)
    const rangeStart = new Date(BASE + 60 * MIN);
    const rangeEnd = new Date(BASE + 120 * MIN);

    // Guide cache extends well beyond the query range
    const cacheEnd = BASE + 8 * HOUR;

    it('includes a program that starts before and ends within the range (ends in range)', async () => {
      const channel = makeChannelOrm();
      // Starts 30 min before range, ends 30 min into range
      const program = makeGuideItem(BASE + 30 * MIN, 60 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(1);
      expect(result![0]).toBe(program);
    });

    it('includes a program that starts within the range and ends after (begins in range)', async () => {
      const channel = makeChannelOrm();
      // Starts 90 min into session (30 min into range), ends 30 min past range
      const program = makeGuideItem(BASE + 90 * MIN, 60 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(1);
      expect(result![0]).toBe(program);
    });

    it('includes a program entirely within the range', async () => {
      const channel = makeChannelOrm();
      // Starts 70 min, ends 80 min — entirely within [60, 120)
      const program = makeGuideItem(BASE + 70 * MIN, 10 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(1);
      expect(result![0]).toBe(program);
    });

    it('includes a program that starts exactly at the range start', async () => {
      const channel = makeChannelOrm();
      const program = makeGuideItem(BASE + 60 * MIN, 30 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(1);
    });

    it('includes a program that ends exactly at the range end', async () => {
      const channel = makeChannelOrm();
      // Starts 30 min before range end, ends exactly at range end
      const program = makeGuideItem(BASE + 30 * MIN, 90 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(1);
    });

    it('excludes a program entirely before the range', async () => {
      const channel = makeChannelOrm();
      // Starts 0, ends 30 min — before [60, 120)
      const program = makeGuideItem(BASE, 30 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(0);
    });

    it('excludes a program that ends exactly at the range start', async () => {
      const channel = makeChannelOrm();
      // Ends exactly at rangeStart (BASE + 60 MIN)
      const program = makeGuideItem(BASE, 60 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(0);
    });

    it('excludes a program that spans the entire range (neither begins nor ends in range)', async () => {
      const channel = makeChannelOrm();
      // Starts 30 min before range, ends 30 min after range — spans [60, 120)
      const program = makeGuideItem(BASE + 30 * MIN, 120 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(0);
    });

    it('excludes a program entirely after the range', async () => {
      const channel = makeChannelOrm();
      // Starts at range end or beyond
      const program = makeGuideItem(BASE + 120 * MIN, 30 * MIN);
      const service = makeService();
      seedCache(service, channel, [program], cacheEnd);

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(0);
    });

    it('returns only the programs that begin or end in range from a mixed list', async () => {
      const channel = makeChannelOrm();
      // wholly before range
      const beforeRange = makeGuideItem(BASE, 30 * MIN);
      // ends in range
      const endsInRange = makeGuideItem(BASE + 30 * MIN, 60 * MIN);
      // starts in range, ends after
      const startsInRange = makeGuideItem(BASE + 90 * MIN, 60 * MIN);
      // spans range — excluded
      const spansRange = makeGuideItem(BASE + 30 * MIN, 120 * MIN);
      // wholly after range
      const afterRange = makeGuideItem(BASE + 150 * MIN, 30 * MIN);

      const service = makeService();
      seedCache(
        service,
        channel,
        [beforeRange, endsInRange, startsInRange, spansRange, afterRange],
        cacheEnd,
      );

      const result = await service.getChannelLineup(
        channel.uuid,
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(2);
      expect(result).toContain(endsInRange);
      expect(result).toContain(startsInRange);
    });

    it('returns undefined for an unknown channel', async () => {
      const service = makeService();
      // Seed a different channel so cachedGuide is non-empty
      const channel = makeChannelOrm();
      seedCache(service, channel, [], cacheEnd);

      const result = await service.getChannelLineup(
        'nonexistent-id',
        rangeStart,
        rangeEnd,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('removeCachedChannel', () => {
    it('immediately removes the channel from XMLTV output', async () => {
      const channelA = makeChannelWithLineup({ number: 1, name: 'Channel A' });
      const channelB = makeChannelWithLineup({ number: 2, name: 'Channel B' });

      const mockLoadAllLineups = vi.fn().mockResolvedValue({
        [channelA.channel.uuid]: channelA,
        [channelB.channel.uuid]: channelB,
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
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
      );

      const guideDuration = dayjs.duration({ hours: 4 });

      // Populate the cache with both channels
      await service.buildAllChannels(guideDuration, true);
      expect(mockWrite).toHaveBeenCalledTimes(1);

      // Simulate the delete endpoint: channel B is gone from DB, remove from cache
      await service.removeCachedChannel(channelB.channel.uuid);

      expect(mockWrite).toHaveBeenCalledTimes(2);
      const writeChannelIds = (
        mockWrite.mock.calls[1][0] as MaterializedChannelPrograms[]
      ).map((entry) => entry.channel.uuid);
      expect(writeChannelIds).toContain(channelA.channel.uuid);
      expect(writeChannelIds).not.toContain(channelB.channel.uuid);
    });
  });
});
