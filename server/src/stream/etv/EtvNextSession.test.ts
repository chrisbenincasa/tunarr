import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
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

const playoutItem = (startMs: number, finishMs: number): PlayoutItem => ({
  id: 'item-1',
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
}: {
  items?: PlayoutItem[];
  publishesReady?: boolean;

  /** Non-null stands for a worker that died instead of becoming ready. */
  processExitCode?: number | null;
  webvttEnabled?: boolean;
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
  const playoutWriter = {
    materializeWindow: vi.fn(() =>
      Promise.resolve({
        startMs,
        finishMs: startMs + 600_000,
        items: items ?? [playoutItem(startMs, startMs + 600_000)],
        ignored: [],
      }),
    ),
  };

  const killed = vi.fn();
  const childProcessHelper = {
    spawn: vi.fn(async () => {
      if (publishesReady) {
        await fs.writeFile(path.join(outputDirectory, '.ready'), '');
      }
      return {
        kill: killed,
        process: { exitCode: processExitCode },
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
    { transcodeDirectory },
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
    killed,
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
    expect(childProcessHelper.spawn).not.toHaveBeenCalled();
  });

  // Asserted on the error rather than on state, because Session.start()
  // overwrites the 'error' state that a failed readiness wait sets.
  test('errors when the worker dies before publishing ready', async () => {
    const { session } = await makeSession({
      publishesReady: false,
      processExitCode: 1,
    });

    const errors: unknown[] = [];
    session.on('error', (e) => errors.push(e));

    await session.start();

    expect(session.error).toBeDefined();
    expect(errors).toHaveLength(1);
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
