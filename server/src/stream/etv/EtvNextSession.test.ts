import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import type { PlayoutItem } from './generated/playout.ts';
import {
  DynamicRollThresholdMs,
  DynamicTokenEnvVar,
  DynamicWindowMs,
} from './EtvNextDynamicPlayout.ts';
import { EtvNextDynamicTokenRegistry } from './EtvNextDynamicTokenRegistry.ts';
import type { EtvNextPlayoutMode } from './EtvNextSession.ts';
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

const tunarrPort = 8123;

/**
 * Builds a session whose collaborators are fakes.
 *
 * `spawn` stands in for the worker: by default it publishes `.ready` the way a
 * healthy worker does, so `start()` runs end to end without a binary.
 *
 * The playout mode defaults to the materialized path here, since that is the
 * one whose window arithmetic these tests reason about. Production defaults to
 * the dynamic path, which has its own block below.
 */
async function makeSession({
  items,
  publishesReady = true,
  processExitCode = null,
  webvttEnabled = false,
  windowMs,
  playoutMode = 'materialized',
  spawnFails = false,
}: {
  items?: PlayoutItem[];
  publishesReady?: boolean;
  spawnFails?: boolean;

  /** Non-null stands for a worker that died instead of becoming ready. */
  processExitCode?: number | null;
  webvttEnabled?: boolean;
  windowMs?: number;

  /** `null` leaves the option unset, so the session's own default applies. */
  playoutMode?: EtvNextPlayoutMode | null;
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
    spawn: vi.fn(
      async (
        _executable: string,
        _args: string[],
        _opts: unknown,
        _env?: NodeJS.ProcessEnv,
      ) => {
        if (spawnFails) {
          throw new Error('no binary here');
        }

        if (publishesReady) {
          await fs.writeFile(path.join(outputDirectory, '.ready'), '');
        }
        return {
          kill: killed,
          process: workerProcess,
        };
      },
    ),
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
  const tokenRegistry = new EtvNextDynamicTokenRegistry();

  const session = new EtvNextSession(
    channel,
    {
      transcodeDirectory,
      windowMs,
      tunarrPort,
      ...(playoutMode !== null ? { playoutMode } : {}),
    },
    binaryResolver as never,
    playoutWriter as never,
    childProcessHelper as never,
    settingsDB as never,
    featureFlagService as never,
    tokenRegistry,
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
    tokenRegistry,
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

    const [executable, args] = childProcessHelper.spawn.mock.calls[0] ?? [];
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

describe('the dynamic playout window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function playoutDirectory(transcodeDirectory: string) {
    return path.join(transcodeDirectory, `etv_${channelUuid}`, 'playout');
  }

  async function readWindow(transcodeDirectory: string) {
    const directory = playoutDirectory(transcodeDirectory);
    const names = await fs.readdir(directory);
    const [name] = names;
    if (name === undefined) {
      throw new Error('no playout window on disk');
    }

    const contents = JSON.parse(
      await fs.readFile(path.join(directory, name), 'utf-8'),
    ) as { items: PlayoutItem[] };

    return { names, name, items: contents.items };
  }

  function rollAt(session: EtvNextSession, nowMs: number) {
    vi.setSystemTime(nowMs);
    return (
      session as unknown as { rollDynamicWindow(): Promise<void> }
    ).rollDynamicWindow();
  }

  test('is what a channel gets by default', async () => {
    const { session, transcodeDirectory, playoutWriter } = await makeSession({
      playoutMode: null,
    });

    await session.start();

    const { items } = await readWindow(transcodeDirectory);
    expect(items[0]?.source).toMatchObject({ source_type: 'dynamic' });
    expect(playoutWriter.materializeWindow).not.toHaveBeenCalled();
  });

  test('holds one placeholder covering the next twelve hours', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      playoutMode: 'dynamic',
    });
    vi.setSystemTime(startMs);

    await session.start();

    const { items, names } = await readWindow(transcodeDirectory);
    expect(names).toHaveLength(1);
    expect(items).toHaveLength(1);
    expect(Date.parse(items[0].finish) - Date.parse(items[0].start)).toBe(
      DynamicWindowMs,
    );
  });

  // The secret reaches the worker through its environment, so it is never
  // written to a file the way the rest of the playout is.
  test('hands the worker a token no file carries', async () => {
    const { session, transcodeDirectory, childProcessHelper, tokenRegistry } =
      await makeSession({ playoutMode: 'dynamic' });

    await session.start();

    const env = childProcessHelper.spawn.mock.calls[0]?.[3];
    const token = env?.[DynamicTokenEnvVar];
    expect(token).toBeDefined();
    expect(tokenRegistry.resolve(token)).toEqual({
      channelUuid,
      channelNumber: 7,
    });

    const { items } = await readWindow(transcodeDirectory);
    expect(JSON.stringify(items)).not.toContain(token);
  });

  // The worker clamps every resolved item's finish to the placeholder's, so a
  // window running low starts truncating programs.
  test('rolls once less than the threshold is left', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      playoutMode: 'dynamic',
    });
    vi.setSystemTime(startMs);
    await session.start();
    const before = await readWindow(transcodeDirectory);

    await rollAt(session, startMs + DynamicWindowMs - DynamicRollThresholdMs);
    const after = await readWindow(transcodeDirectory);

    expect(after.name).not.toBe(before.name);
    expect(Date.parse(after.items[0].finish)).toBeGreaterThan(
      Date.parse(before.items[0].finish),
    );
  });

  // Upstream picks the window file by unsorted read_dir first match, so two
  // of them would be chosen between nondeterministically.
  test('leaves exactly one window file behind', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      playoutMode: 'dynamic',
    });
    vi.setSystemTime(startMs);
    await session.start();

    await rollAt(session, startMs + DynamicWindowMs - DynamicRollThresholdMs);
    await rollAt(
      session,
      startMs + 2 * (DynamicWindowMs - DynamicRollThresholdMs),
    );

    expect((await readWindow(transcodeDirectory)).names).toHaveLength(1);
  });

  test('is left alone while it still has depth', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      playoutMode: 'dynamic',
    });
    vi.setSystemTime(startMs);
    await session.start();
    const before = await readWindow(transcodeDirectory);

    await rollAt(session, startMs + 60_000);

    expect((await readWindow(transcodeDirectory)).name).toBe(before.name);
  });

  test('is rolled on a timer', async () => {
    const { session, transcodeDirectory, startMs } = await makeSession({
      playoutMode: 'dynamic',
    });
    vi.setSystemTime(startMs);
    await session.start();
    const before = await readWindow(transcodeDirectory);

    await vi.advanceTimersByTimeAsync(
      DynamicWindowMs - DynamicRollThresholdMs + 60_000,
    );

    // The roll writes to disk after the timer returns, so the file lands a
    // moment later than the tick that asked for it.
    await vi.waitFor(async () => {
      expect((await readWindow(transcodeDirectory)).name).not.toBe(before.name);
    });
  });

  // A token outliving the worker it was minted for would keep granting this
  // channel's programming to nothing.
  test('takes the token back when the worker will not start', async () => {
    const { session, tokenRegistry } = await makeSession({
      playoutMode: 'dynamic',
      spawnFails: true,
    });

    await session.start();

    expect(session.state).toBe('error');
    expect(tokenRegistry.size).toBe(0);
  });

  // Teardown raises `stopping` before it touches the workspace and only sets
  // `state` after, so a roll gated on `state` alone runs into a teardown
  // already under way.
  test('leaves nothing behind when a roll and a stop overlap', async () => {
    const { session, transcodeDirectory, startMs, tokenRegistry } =
      await makeSession({ playoutMode: 'dynamic' });
    vi.setSystemTime(startMs);
    await session.start();

    const stopping = session.stop();

    // Teardown revokes the token before it touches the workspace, so an empty
    // registry means it is under way with `state` still 'started'.
    for (let i = 0; i < 100 && tokenRegistry.size > 0; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(tokenRegistry.size).toBe(0);

    vi.setSystemTime(startMs + DynamicWindowMs - DynamicRollThresholdMs);
    const rolling = (
      session as unknown as { rollDynamicWindow(): Promise<void> }
    ).rollDynamicWindow();
    await Promise.all([rolling, stopping]);

    const root = path.join(transcodeDirectory, `etv_${channelUuid}`);
    await expect(fs.stat(root)).rejects.toThrow();
  });

  test('takes the token with it when the session stops', async () => {
    const { session, tokenRegistry } = await makeSession({
      playoutMode: 'dynamic',
    });
    await session.start();
    expect(tokenRegistry.size).toBe(1);

    await session.stop();

    expect(tokenRegistry.size).toBe(0);
  });
});
