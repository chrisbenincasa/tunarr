import type { OnDemandChannelConfig } from '@/db/derived_types/Lineup.js';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { MutexMap } from '@/util/mutexMap.js';
import { Container } from 'inversify';
import { setTestGlobalOptions } from '../testing/getFakeSettingsDb.ts';
import { OnDemandChannelService } from './OnDemandChannelService.ts';

beforeAll(async () => {
  await setTestGlobalOptions();
});

// Mirrors the production container: autobind on, no defaultScope. Inversify's
// default scope is Transient, so an @injectable class that is never explicitly
// bound is resolved fresh at every injection site.
function containerLikeProduction() {
  const container = new Container({ autobind: true });
  container.bind<MutexMap>(KEYS.MutexMap).toDynamicValue(() => new MutexMap());
  container.bind<IChannelDB>(KEYS.ChannelDB).toConstantValue({} as IChannelDB);
  return container;
}

// The service guards every read-modify-write of a channel's onDemandConfig with
// a per-channel lock from #locks. That only serializes anything if every
// consumer shares one instance -- otherwise each holds a private MutexMap and
// locks a channel only against itself. It has three injection sites:
// ServerContext, OnDemandChannelStateTask, and the HlsSession factory in
// StreamModule.
test('resolves to one shared instance so its per-channel locks serialize', () => {
  const container = containerLikeProduction();

  const first = container.get(OnDemandChannelService);
  const second = container.get(OnDemandChannelService);

  expect(first).toBe(second);
});

describe('Virtual Live On-Demand', () => {
  const container = containerLikeProduction();
  const service = container.get(OnDemandChannelService);

  describe('getVirtualLiveTimestamp', () => {
    // Channel started at midnight, duration is 1 hour (3600000ms)
    const channelStartTime = new Date('2026-01-01T00:00:00Z').getTime();
    const channelDuration = 3600000; // 1 hour in ms

    test('calculates position based on elapsed time since channel start', () => {
      // Request at 00:30 should be 30 minutes into the schedule
      const requestTime = new Date('2026-01-01T00:30:00Z').getTime();

      const result = service.getVirtualLiveTimestamp(
        channelStartTime,
        channelDuration,
        requestTime,
      );

      // Should return the "live" position: startTime + 30 minutes
      expect(result).toBe(channelStartTime + 1800000);
    });

    test('wraps around when elapsed time exceeds channel duration', () => {
      // Request at 01:30 (90 minutes after start) should wrap to 30 minutes
      const requestTime = new Date('2026-01-01T01:30:00Z').getTime();

      const result = service.getVirtualLiveTimestamp(
        channelStartTime,
        channelDuration,
        requestTime,
      );

      // Should wrap: (90 mins % 60 mins) = 30 mins into schedule
      expect(result).toBe(channelStartTime + 1800000);
    });

    test('handles multiple wrap-arounds correctly', () => {
      // Request at 05:15 (315 minutes after start)
      // 315 % 60 = 15 minutes into the schedule
      const requestTime = new Date('2026-01-01T05:15:00Z').getTime();

      const result = service.getVirtualLiveTimestamp(
        channelStartTime,
        channelDuration,
        requestTime,
      );

      expect(result).toBe(channelStartTime + 900000); // 15 minutes
    });

    test('returns start time when request is exactly at channel start', () => {
      const requestTime = channelStartTime;

      const result = service.getVirtualLiveTimestamp(
        channelStartTime,
        channelDuration,
        requestTime,
      );

      expect(result).toBe(channelStartTime);
    });
  });

  describe('getLiveTimestampForConfig with virtualLive', () => {
    const channelStartTime = new Date('2026-01-01T00:00:00Z').getTime();
    const channelDuration = 3600000; // 1 hour

    test('uses virtual live calculation when virtualLive is true', () => {
      const config: OnDemandChannelConfig = {
        state: 'paused',
        cursor: 0,
        virtualLive: true, // This field needs to be added to the schema
      };

      const requestTime = new Date('2026-01-01T00:30:00Z').getTime();

      const result = service.getLiveTimestampForConfig(
        config,
        channelStartTime,
        requestTime,
        channelDuration,
      );

      // Should calculate based on elapsed time, ignoring cursor/state
      expect(result).toBe(channelStartTime + 1800000);
    });

    test('ignores cursor and lastResumed when virtualLive is true', () => {
      const config: OnDemandChannelConfig = {
        state: 'playing',
        cursor: 600000, // Cursor at 10 minutes
        lastResumed: new Date('2026-01-01T00:20:00Z').getTime(),
        virtualLive: true,
      };

      const requestTime = new Date('2026-01-01T00:30:00Z').getTime();

      const result = service.getLiveTimestampForConfig(
        config,
        channelStartTime,
        requestTime,
        channelDuration,
      );

      // Should still calculate based on elapsed time from channel start,
      // ignoring cursor and lastResumed
      expect(result).toBe(channelStartTime + 1800000);
    });

    test('uses cursor-based calculation when virtualLive is false', () => {
      const lastResumed = new Date('2026-01-01T00:20:00Z').getTime();
      const config: OnDemandChannelConfig = {
        state: 'playing',
        cursor: 600000, // Cursor at 10 minutes
        lastResumed,
        virtualLive: false,
      };

      const requestTime = new Date('2026-01-01T00:30:00Z').getTime();

      const result = service.getLiveTimestampForConfig(
        config,
        channelStartTime,
        requestTime,
        channelDuration,
      );

      // Should use existing logic: startTime + cursor + (requestTime - lastResumed)
      // = 0 + 600000 + (30min - 20min) = 600000 + 600000 = 1200000 (20 minutes)
      expect(result).toBe(channelStartTime + 600000 + 600000);
    });
  });
});
