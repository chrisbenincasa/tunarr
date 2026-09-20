import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import type { PlayoutItem } from './generated/playout.ts';
import { EtvNextSession } from './EtvNextSession.ts';
import { DefaultStalenessMs } from './EtvNextWorkspace.ts';

const channelUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const channel = {
  uuid: channelUuid,
  number: 7,
  offline: { mode: 'pic', picture: '/media/offline.png' },
  transcodeConfig: {
    resolution: { widthPx: 1920, heightPx: 1080 },
    videoFormat: 'h264',
    videoBitRate: 5000,
    videoBufferSize: 10_000,
    videoBitDepth: 8,
    audioFormat: 'aac',
    audioBitRate: 192,
    audioBufferSize: 384,
    audioChannels: 2,
    audioSampleRate: 48,
    audioVolumePercent: 100,
    audioLoudnormConfig: null,
    threadCount: 0,
    hardwareAccelerationMode: 'none',
    vaapiDriver: 'system',
    vaapiDevice: null,
    videoPreset: null,
    videoProfile: null,
    normalizeFrameRate: false,
    deinterlaceVideo: false,
    errorScreen: 'pic',
  },
} as unknown as ChannelOrmWithTranscodeConfig;

const playoutItem = (
  startMs: number,
  finishMs: number,
  id = 'item-0',
): PlayoutItem => ({
  id,
  start: new Date(startMs).toISOString(),
  finish: new Date(finishMs).toISOString(),
  tracks: {
    video: { source: { source_type: 'lavfi', params: 'color=c=black' } },
    audio: { source: { source_type: 'lavfi', params: 'anullsrc' } },
  },
});

let tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-session-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Builds a session whose five collaborators are fakes.
 *
 * `spawn` stands in for the worker: by default it publishes `.ready` the way a
 * healthy worker does, so `start()` runs end to end without a binary.
 */
async function makeSession({
  items,
  publishesReady = true,
  processExitCode = null,
  webvttEnabled = false,
  windowMs,
}: {
  items?: PlayoutItem[];
  publishesReady?: boolean;

  /** Non-null stands for a worker that died instead of becoming ready. */
  processExitCode?: number | null;
  webvttEnabled?: boolean;
  windowMs?: number;
} = {}) {
  const transcodeDirectory = await makeTempDir();
  const outputDirectory = path.join(
    transcodeDirectory,
    `etv_${channelUuid}`,
    'out',
  );

  const binaryResolver = {
    resolveChecked: vi.fn(() => Promise.resolve('/opt/ersatztv-channel')),
  };

  const startMs = Date.now();

  // One item filling whatever span was asked for, so a window's shape follows
  // from its arguments and a refresh can be told apart from the first write.
  const playoutWriter = {
    materializeWindow: vi.fn(
      (request: { startMs: number; windowMs: number; idSeed?: number }) => {
        const finishMs = request.startMs + request.windowMs;
        return Promise.resolve({
          startMs: request.startMs,
          finishMs,
          items: items ?? [
            playoutItem(
              request.startMs,
              finishMs,
              `item-${request.idSeed ?? 0}`,
            ),
          ],
          ignored: [],
        });
      },
    ),
  };

  const killed = vi.fn();

  // The session listens for 'exit', so the stand-in has to be a real emitter.
  const workerProcess = Object.assign(new EventEmitter(), {
    exitCode: processExitCode,
  });

  const childProcessHelper = {
    spawn: vi.fn(async () => {
      if (publishesReady) {
        await fs.writeFile(path.join(outputDirectory, '.ready'), '');
      }
      return {
        kill: killed,
        process: workerProcess,
      };
    }),
  };

  const settingsDB = {
    ffmpegSettings: vi.fn(() => ({
      ffmpegExecutablePath: '/usr/bin/ffmpeg',
      ffprobeExecutablePath: '/usr/bin/ffprobe',
      deinterlaceFilter: 'yadif=1',
      scalingAlgorithm: 'fast_bilinear',
      enableFileLogging: false,
      transcodeDirectory,
    })),
  };

  const featureFlagService = { get: vi.fn(() => webvttEnabled) };

  const session = new EtvNextSession(
    channel,
    { transcodeDirectory, windowMs },
    binaryResolver as never,
    playoutWriter as never,
    childProcessHelper as never,
    settingsDB as never,
    featureFlagService as never,
  );

  // SessionManager attaches one in production; without a listener an emitted
  // 'error' event throws out of start().
  session.on('error', () => {});

  return {
    session,
    transcodeDirectory,
    outputDirectory,
    binaryResolver,
    playoutWriter,
    childProcessHelper,
    workerProcess,
    killed,
    startMs,
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  tempDirs = [];
});

describe('startup', () => {
  test('writes a channel config and a playout window before spawning', async () => {
    const { session, transcodeDirectory, childProcessHelper } =
      await makeSession();

    await session.start();

    expect(session.state).toBe('started');

    const root = path.join(transcodeDirectory, `etv_${channelUuid}`);
    const config = JSON.parse(
      await fs.readFile(path.join(root, 'channel.json'), 'utf-8'),
    ) as { normalization: { audio: { sample_rate_hz: number } } };
    expect(config.normalization.audio.sample_rate_hz).toBe(48_000);

    const windows = await fs.readdir(path.join(root, 'playout'));
    expect(windows).toHaveLength(1);
    expect(childProcessHelper.spawn).toHaveBeenCalled();
  });

  test('spawns the worker against the workspace it just wrote', async () => {
    const { session, transcodeDirectory, outputDirectory, childProcessHelper } =
      await makeSession();

    await session.start();

    const [executable, args] = childProcessHelper.spawn.mock.calls[0] as [
      string,
      string[],
    ];
    expect(executable).toBe('/opt/ersatztv-channel');
    expect(args).toEqual([
      'run',
      path.join(transcodeDirectory, `etv_${channelUuid}`, 'channel.json'),
      '--output-folder',
      outputDirectory,
      '--number',
      '7',
    ]);
  });

  // The worker reaps itself on a stale heartbeat, so the file has to exist
  // before its clock starts.
  test('creates the heartbeat file before the worker can read it', async () => {
    const { session, outputDirectory } = await makeSession();

    await session.start();

    await expect(
      fs.stat(path.join(outputDirectory, '.heartbeat')),
    ).resolves.toBeDefined();
  });

  test('refuses to start a channel that produced no items', async () => {
    const { session, childProcessHelper } = await makeSession({ items: [] });

    await session.start();

    expect(session.state).toBe('error');
    expect(session.error?.message).toContain('no playable items');
    expect(childProcessHelper.spawn).not.toHaveBeenCalled();
  });

  test('errors when the worker dies before publishing ready', async () => {
    const { session } = await makeSession({
      publishesReady: false,
      processExitCode: 1,
    });

    await session.start();

    expect(session.state).toBe('error');
    expect(session.error).toBeDefined();
  });
});

describe('staleness', () => {
  test('defaults below the worker reap window', async () => {
    const { session } = await makeSession();

    expect(
      (session as unknown as { sessionOptions: { stalenessMs: number } })
        .sessionOptions.stalenessMs,
    ).toBe(DefaultStalenessMs);
  });

  test('an explicit option still wins', async () => {
    const { transcodeDirectory } = { transcodeDirectory: await makeTempDir() };
    const session = new EtvNextSession(
      channel,
      { transcodeDirectory, stalenessMs: 15_000 },
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    expect(
      (session as unknown as { sessionOptions: { stalenessMs: number } })
        .sessionOptions.stalenessMs,
    ).toBe(15_000);
  });
});

describe('heartbeats', () => {
  // Two clocks: Tunarr's tracker decides idleness, the file stops the worker
  // reaping itself underneath a session Tunarr still considers live.
  test('a client heartbeat touches the worker file too', async () => {
    const { session, outputDirectory } = await makeSession();
    await session.start();

    const heartbeatPath = path.join(outputDirectory, '.heartbeat');
    await fs.utimes(heartbeatPath, new Date(0), new Date(0));

    session.recordHeartbeat('127.0.0.1');
    await vi.waitFor(async () => {
      const stat = await fs.stat(heartbeatPath);
      expect(stat.mtimeMs).toBeGreaterThan(0);
    });
  });
});

describe('teardown', () => {
  test('kills the worker and removes its workspace', async () => {
    const { session, transcodeDirectory, killed } = await makeSession();
    await session.start();

    await session.stop();

    expect(killed).toHaveBeenCalled();
    await expect(
      fs.stat(path.join(transcodeDirectory, `etv_${channelUuid}`)),
    ).rejects.toThrow();
  });

  // SessionManager drops the session from its map on 'stop', and reads state
  // to decide whether to serve it.
  test('reaches a terminal state and announces it', async () => {
    const { session } = await makeSession();
    await session.start();
    const stopped = vi.fn();
    session.on('stop', stopped);

    await session.stop();

    expect(session.state).toBe('stopped');
    expect(stopped).toHaveBeenCalledTimes(1);
  });
});

describe('worker lifetime', () => {
  // Without this the output directory keeps its last segments, clients poll a
  // playlist that never advances, and those polls keep the session alive.
  test('ends the session when the worker exits on its own', async () => {
    const { session, workerProcess } = await makeSession();
    await session.start();
    const stopped = vi.fn();
    session.on('stop', stopped);

    workerProcess.exitCode = 1;
    workerProcess.emit('exit', 1, null);

    await vi.waitFor(() => {
      expect(session.state).toBe('stopped');
    });
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  test('a deliberate stop does not end the session twice', async () => {
    const { session, workerProcess } = await makeSession();
    await session.start();
    const stopped = vi.fn();
    session.on('stop', stopped);

    await session.stop();
    workerProcess.emit('exit', 0, 'SIGTERM');

    expect(stopped).toHaveBeenCalledTimes(1);
  });
});

describe('the playout window', () => {
  // Every test here reasons about wall-clock positions inside the window.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function readWindow(transcodeDirectory: string) {
    const playoutDirectory = path.join(
      transcodeDirectory,
      `etv_${channelUuid}`,
      'playout',
    );
    const [name] = await fs.readdir(playoutDirectory);
    if (name === undefined) {
      throw new Error('no playout window on disk');
    }

    return JSON.parse(
      await fs.readFile(path.join(playoutDirectory, name), 'utf-8'),
    ) as { items: { id: string; start: string; finish: string }[] };
  }

  const windowMs = 600_000;

  /**
   * Runs one refresh at a chosen moment.
   *
   * The timer is covered separately; driving the refresh directly keeps the
   * window arithmetic free of the fake clock's interaction with real file I/O.
   */
  function refreshAt(session: EtvNextSession, nowMs: number) {
    vi.setSystemTime(nowMs);
    return (
      session as unknown as { refreshWindow(): Promise<void> }
    ).refreshWindow();
  }

  // The worker plays what the single window file covers and shows black past
  // its finish, so a session outliving one window would go dark.
  test('is rebuilt from the finish of the playing item', async () => {
    const { session, playoutWriter, transcodeDirectory, startMs } =
      await makeSession({ windowMs });
    await session.start();

    await refreshAt(session, startMs + windowMs / 4);

    expect(playoutWriter.materializeWindow.mock.calls[1]?.[0]).toMatchObject({
      startMs: startMs + windowMs,
      idSeed: 1,
    });

    const { items } = await readWindow(transcodeDirectory);
    expect(items.map((i) => i.id)).toEqual(['item-0', 'item-1']);
  });

  test('drops an item once it has finished playing', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      windowMs,
    });
    await session.start();

    await refreshAt(session, startMs + windowMs / 4);
    await refreshAt(session, startMs + windowMs);

    const { items } = await readWindow(transcodeDirectory);
    expect(items.map((i) => i.id)).not.toContain('item-0');
    expect(items.every((i) => Date.parse(i.finish) > startMs + windowMs)).toBe(
      true,
    );
  });

  // Appending could never correct what it had already written, so a
  // programming edit would not reach the worker until the window ran out.
  test('replaces a tail it wrote earlier', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      windowMs,
    });
    await session.start();

    await refreshAt(session, startMs + windowMs / 4);
    const afterFirst = await readWindow(transcodeDirectory);
    expect(afterFirst.items.map((i) => i.id)).toEqual(['item-0', 'item-1']);

    await refreshAt(session, startMs + windowMs / 2);
    const afterSecond = await readWindow(transcodeDirectory);

    expect(afterSecond.items.map((i) => i.id)).toEqual(['item-0', 'item-2']);
  });

  test('is left alone while one long program still covers the lead', async () => {
    const { session, playoutWriter, startMs } = await makeSession({ windowMs });
    playoutWriter.materializeWindow.mockImplementation(
      (request: { startMs: number }) =>
        Promise.resolve({
          startMs: request.startMs,
          finishMs: request.startMs + windowMs * 3,
          items: [playoutItem(request.startMs, request.startMs + windowMs * 3)],
          ignored: [],
        }),
    );
    await session.start();

    await refreshAt(session, startMs + windowMs / 4);

    expect(playoutWriter.materializeWindow).toHaveBeenCalledTimes(1);
  });

  // A changed id makes the worker treat it as a new item and restart it.
  test('carries the playing item over untouched', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      windowMs,
    });
    await session.start();
    const before = await readWindow(transcodeDirectory);

    await refreshAt(session, startMs + windowMs / 4);
    const after = await readWindow(transcodeDirectory);

    expect(after.items[0]).toEqual(before.items[0]);
  });

  test('is topped up on a timer', async () => {
    const { session, playoutWriter } = await makeSession({ windowMs });
    await session.start();

    await vi.advanceTimersByTimeAsync(windowMs / 4);

    expect(playoutWriter.materializeWindow).toHaveBeenCalledTimes(2);
  });

  test('stops being topped up once the session stops', async () => {
    const { session, playoutWriter } = await makeSession({ windowMs });
    await session.start();
    await session.stop();

    await vi.advanceTimersByTimeAsync(windowMs);

    expect(playoutWriter.materializeWindow).toHaveBeenCalledTimes(1);
  });
});

describe('the playlist clients are handed', () => {
  test('points at this channel etv_next path and carries the bitrate', async () => {
    const { session } = await makeSession();

    const playlist = session.getMasterPlaylist();

    expect(playlist).toContain(
      `/stream/channels/${channelUuid}/etv_next/live.m3u8`,
    );
    expect(playlist).toContain(`BANDWIDTH=${(5000 + 192) * 1100}`);
  });

  test('advertises subtitles only when the sidecar flag is on', async () => {
    const off = await makeSession();
    expect(off.session.getMasterPlaylist()).not.toContain('live_sub.m3u8');

    const on = await makeSession({ webvttEnabled: true });
    expect(on.session.getMasterPlaylist()).toContain('live_sub.m3u8');
  });
});
