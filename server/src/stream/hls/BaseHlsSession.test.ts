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
import { BaseHlsSession, StartWaitCapMs } from './BaseHlsSession.ts';

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
  protected isTranscodeRunning() {
    return true;
  }
}

class StartWaitHlsSession extends TestHlsSession {
  transcodeRunning = true;

  protected override isTranscodeRunning() {
    return this.transcodeRunning;
  }
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

  describe('start wait', () => {
    const readyFiles = ['stream.m3u8', 'data000000.ts', 'data000001.ts'];
    let files: string[];
    let readdir: ReturnType<typeof vi.spyOn>;
    let starting: StartWaitHlsSession;

    beforeEach(() => {
      files = [];
      readdir = vi
        .spyOn(fs, 'readdir')
        .mockImplementation(
          (async () => files) as unknown as typeof fs.readdir,
        );
      starting = new StartWaitHlsSession(makeChannel(), baseOptions);
      // EventEmitter throws an unhandled 'error' event.
      starting.on('error', () => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('starts on the first poll when segments already exist', async () => {
      files = readyFiles;

      void starting.start();
      await vi.advanceTimersByTimeAsync(999);

      expect(starting.started).toBe(true);
      expect(readdir).toHaveBeenCalledTimes(1);
    });

    it('keeps waiting while ffmpeg runs and starts when segments appear after 20s', async () => {
      void starting.start();
      await vi.advanceTimersByTimeAsync(20_000);

      expect(starting.state).toBe('starting');

      files = readyFiles;
      await vi.advanceTimersByTimeAsync(1_000);

      expect(starting.started).toBe(true);
    });

    it('fails within a second when ffmpeg exits before writing segments', async () => {
      void starting.start();
      await vi.advanceTimersByTimeAsync(2_000);

      starting.transcodeRunning = false;
      await vi.advanceTimersByTimeAsync(1_000);

      expect(starting.hasError).toBe(true);
      expect(starting.error).toHaveProperty(
        'cause.message',
        'ffmpeg exited before the stream was ready',
      );
    });

    it('fails at the cap when ffmpeg runs but never writes segments', async () => {
      void starting.start();
      await vi.advanceTimersByTimeAsync(StartWaitCapMs - 1_000);

      expect(starting.state).toBe('starting');

      await vi.advanceTimersByTimeAsync(1_000);

      expect(starting.hasError).toBe(true);
      expect(starting.error).toHaveProperty(
        'cause.message',
        `Stream was not ready after ${StartWaitCapMs}ms`,
      );
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
