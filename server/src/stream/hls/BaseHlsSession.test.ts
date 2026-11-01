import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { StreamConnectionDetails } from '@tunarr/types/api';
import type { DeepRequired } from 'ts-essentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.ts';
import type { HlsOptions } from '../../ffmpeg/builder/constants.ts';
import type { StopOptions } from '../Session.ts';
import type { BaseHlsSessionOptions } from './BaseHlsSession.ts';
import { BaseHlsSession } from './BaseHlsSession.ts';

// Minimal concrete subclass for testing
class TestHlsSession extends BaseHlsSession {
  public readonly sessionType = 'hls' as const;

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

// Mirrors HlsSession.stopStream: kill, wait for exit, then remove the directory.
class StoppableHlsSession extends TestHlsSession {
  // Counts teardown starts. A directory check alone can't tell "not started"
  // from "fs.rm still in flight".
  cleanupCalls = 0;

  protected override async cleanupDirectory() {
    this.cleanupCalls++;
    await super.cleanupDirectory();
  }

  async setUp() {
    await this.initDirectories();
  }

  async stopTranscode(
    transcode: FfmpegTranscodeSession,
    options: StopOptions = {},
  ) {
    transcode.kill();
    await this.waitForExit(transcode, options);
    await this.cleanupDirectory();
  }
}

function makeTranscode(exited: Promise<void>) {
  return {
    kill: vi.fn(),
    exited,
  } as unknown as FfmpegTranscodeSession;
}

async function exists(p: string) {
  return fs.access(p).then(
    () => true,
    () => false,
  );
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

  describe('session lifecycle', () => {
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

      // Advance to just before staleness cutoff and refresh both heartbeats
      vi.advanceTimersByTime(20_000);
      session.recordHeartbeat('192.168.1.1');
      session.recordHeartbeat('192.168.1.2');

      // Advance again — both still within 30s of their last heartbeat
      vi.advanceTimersByTime(20_000);

      expect(session.removeStaleConnections()).toHaveLength(2);
    });
  });

  describe('stop waits for ffmpeg before removing the working directory', () => {
    let transcodeDirectory: string;
    let stoppable: StoppableHlsSession;

    beforeEach(async () => {
      transcodeDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'tunarr-hls-'),
      );
      stoppable = new StoppableHlsSession(makeChannel(), {
        ...baseOptions,
        transcodeDirectory,
      });
      await stoppable.setUp();
      await fs.writeFile(
        path.join(stoppable.workingDirectory, 'stream.m3u8'),
        '',
      );
    });

    afterEach(async () => {
      await fs.rm(transcodeDirectory, { recursive: true, force: true });
    });

    it('keeps the directory until the killed process exits', async () => {
      const exited = Promise.withResolvers<void>();
      const transcode = makeTranscode(exited.promise);

      const stop = stoppable.stopTranscode(transcode);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(transcode.kill).toHaveBeenCalled();
      expect(stoppable.cleanupCalls).toBe(0);
      expect(await exists(stoppable.workingDirectory)).toBe(true);

      exited.resolve();
      await stop;

      expect(await exists(stoppable.workingDirectory)).toBe(false);
    });

    it('removes the directory after the timeout if the process never exits', async () => {
      const transcode = makeTranscode(new Promise<void>(() => {}));

      const stop = stoppable.stopTranscode(transcode);
      await vi.advanceTimersByTimeAsync(30_000);
      await stop;

      expect(await exists(stoppable.workingDirectory)).toBe(false);
    });

    it('does not wait when waitForExit is false', async () => {
      const transcode = makeTranscode(new Promise<void>(() => {}));

      await stoppable.stopTranscode(transcode, { waitForExit: false });

      expect(await exists(stoppable.workingDirectory)).toBe(false);
    });
  });
});
