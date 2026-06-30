import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { StreamConnectionDetails } from '@tunarr/types/api';
import type { DeepRequired } from 'ts-essentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HlsOptions } from '../../ffmpeg/builder/constants.ts';
import type { BaseHlsSessionOptions } from './BaseHlsSession.ts';
import { BaseHlsSession } from './BaseHlsSession.ts';

// Minimal concrete subclass for testing
class TestHlsSession extends BaseHlsSession {
  public readonly sessionType = 'hls' as const;

  get minByIp() {
    return new Map(this._minByIp);
  }

  get minSegment() {
    return this.minSegmentRequested;
  }

  protected getHlsOptions(): DeepRequired<HlsOptions> {
    return {
      hlsDeleteThreshold: 3,
      streamNameFormat: 'stream.m3u8',
      segmentNameFormat: 'data%06d.ts',
      segmentBaseDirectory: '/tmp/test-sessions',
      streamBasePath: 'test',
      streamBaseUrl: '/test/',
      hlsTime: 4,
      hlsListSize: 0,
      deleteThreshold: null,
      appendSegments: true,
    };
  }

  protected async startInternal(): Promise<void> {}
  protected async stopInternal(): Promise<void> {}
}

function makeChannel(
  uuid = 'test-channel-uuid',
): ChannelOrmWithTranscodeConfig {
  return { uuid } as unknown as ChannelOrmWithTranscodeConfig;
}

function makeConnection(ip: string): StreamConnectionDetails {
  return { ip };
}

const baseOptions: BaseHlsSessionOptions = {
  initialSegmentCount: 2,
  transcodeDirectory: '/tmp/test-sessions',
  stalenessMs: 30_000,
};

describe('BaseHlsSession', () => {
  let session: TestHlsSession;

  beforeEach(() => {
    vi.useFakeTimers();
    session = new TestHlsSession(makeChannel(), baseOptions);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('_minByIp stale connection cleanup', () => {
    it('tracks segment numbers per IP when onSegmentRequested is called', () => {
      session.onSegmentRequested('192.168.1.1', 'data000010.ts');
      session.onSegmentRequested('192.168.1.2', 'data000020.ts');

      expect(session.minByIp.get('192.168.1.1')).toBe(10);
      expect(session.minByIp.get('192.168.1.2')).toBe(20);
      expect(session.minSegment).toBe(10);
    });

    it('removes IP from _minByIp when removeConnection is called explicitly', () => {
      session.addConnection('192.168.1.1', makeConnection('192.168.1.1'));
      session.addConnection('192.168.1.2', makeConnection('192.168.1.2'));
      session.onSegmentRequested('192.168.1.1', 'data000010.ts');
      session.onSegmentRequested('192.168.1.2', 'data000020.ts');

      session.removeConnection('192.168.1.2');

      expect(session.minByIp.has('192.168.1.2')).toBe(false);
      expect(session.minSegment).toBe(10);
    });

    it('removes stale IP entries from _minByIp after removeStaleConnections', () => {
      session.addConnection('192.168.1.1', makeConnection('192.168.1.1'));
      session.addConnection('192.168.1.2', makeConnection('192.168.1.2'));
      session.onSegmentRequested('192.168.1.1', 'data000010.ts');
      session.onSegmentRequested('192.168.1.2', 'data000050.ts');

      // Advance time so device 2 is stale (>30s without heartbeat)
      vi.advanceTimersByTime(31_000);
      // Keep device 1 alive
      session.recordHeartbeat('192.168.1.1');

      session.removeStaleConnections();

      expect(session.minByIp.has('192.168.1.2')).toBe(false);
      expect(session.minByIp.has('192.168.1.1')).toBe(true);
    });

    it('minSegmentRequested reflects only live connections after stale cleanup — the frozen manifest fix', () => {
      // Scenario from bug report:
      // Device 2 is anchored at a low segment, causing the playlist window to freeze
      session.addConnection('192.168.1.1', makeConnection('192.168.1.1'));
      session.addConnection('192.168.1.2', makeConnection('192.168.1.2'));

      // Both devices request segments; device 2 stops at a low number
      session.onSegmentRequested('192.168.1.1', 'data000100.ts');
      session.onSegmentRequested('192.168.1.2', 'data000010.ts');

      // Before stale cleanup: minimum is device 2's old anchored value
      expect(session.minSegment).toBe(10);

      // Device 2 disconnects (no more heartbeats), device 1 continues
      vi.advanceTimersByTime(31_000);
      session.recordHeartbeat('192.168.1.1');
      session.onSegmentRequested('192.168.1.1', 'data000140.ts');

      session.removeStaleConnections();

      // After cleanup: playlist window is no longer anchored to device 2's old position
      expect(session.minSegment).toBe(140);
    });

    it('_minByIp is empty and minSegmentRequested returns 0 when all connections go stale', () => {
      session.addConnection('192.168.1.1', makeConnection('192.168.1.1'));
      session.onSegmentRequested('192.168.1.1', 'data000010.ts');

      vi.advanceTimersByTime(31_000);
      session.removeStaleConnections();

      expect(session.minByIp.size).toBe(0);
      expect(session.minSegment).toBe(0);
    });

    it('does not affect IPs with no _minByIp entry when connection is removed', () => {
      session.addConnection('192.168.1.1', makeConnection('192.168.1.1'));
      session.addConnection('192.168.1.2', makeConnection('192.168.1.2'));
      session.onSegmentRequested('192.168.1.1', 'data000010.ts');
      // Device 2 connected but never requested a segment (no _minByIp entry)

      session.removeConnection('192.168.1.2');

      // Device 1 is unaffected
      expect(session.minByIp.get('192.168.1.1')).toBe(10);
      expect(session.minSegment).toBe(10);
    });

    it('stop() cancels a pending cleanup timer so it cannot fire on a replacement session', async () => {
      // This test covers the session lifecycle race condition:
      // 1. Session A loses all connections → scheduleCleanup() sets a 15s timer
      // 2. User starts a new stream → endSession() calls stop() on Session A
      // 3. Session B is created at the same cache key
      // 4. Session A's timer fires → would delete Session B from the map
      //
      // Fix: stop() calls connectionTracker.cancelCleanup() before
      // acquiring the lock, so the timer never fires.

      const cleanupHandler = vi.fn();
      session.on('cleanup', cleanupHandler);

      // Schedule cleanup as would happen when all connections go stale
      session.scheduleCleanup(15_000);

      // stop() should cancel the pending timer
      await session.stop();

      // Advance past the scheduled delay
      vi.advanceTimersByTime(20_000);

      // The stale cleanup timer must not have fired
      expect(cleanupHandler).not.toHaveBeenCalled();
    });

    it('keeps a connection alive if heartbeat is refreshed within staleness window', () => {
      session.addConnection('192.168.1.1', makeConnection('192.168.1.1'));
      session.addConnection('192.168.1.2', makeConnection('192.168.1.2'));
      session.onSegmentRequested('192.168.1.1', 'data000100.ts');
      session.onSegmentRequested('192.168.1.2', 'data000050.ts');

      // Advance to just before staleness cutoff and refresh both heartbeats
      vi.advanceTimersByTime(20_000);
      session.recordHeartbeat('192.168.1.1');
      session.recordHeartbeat('192.168.1.2');

      // Advance again — both still within 30s of their last heartbeat
      vi.advanceTimersByTime(20_000);

      session.removeStaleConnections();

      // Neither entry should be removed
      expect(session.minByIp.has('192.168.1.1')).toBe(true);
      expect(session.minByIp.has('192.168.1.2')).toBe(true);
      expect(session.minSegment).toBe(50);
    });
  });
});
