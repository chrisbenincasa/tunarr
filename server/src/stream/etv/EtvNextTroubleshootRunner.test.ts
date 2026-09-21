import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { StreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import { EtvNextTroubleshootRunner } from './EtvNextTroubleshootRunner.ts';
import type { PlayoutItem } from './generated/playout.ts';

const channelUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const transcodeConfig = {
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
  errorScreen: 'blank',
};

const makeChannel = (overrides: Record<string, unknown> = {}) =>
  ({
    uuid: channelUuid,
    number: 7,
    offline: { mode: 'pic' },
    transcodeConfig: { ...transcodeConfig, ...overrides },
  }) as unknown as ChannelOrmWithTranscodeConfig;

const lineupItem = {
  type: 'program',
  streamDuration: 20_000,
  startOffset: 0,
  duration: 30_000,
  programBeginMs: Date.now(),
  infiniteLoop: false,
} as unknown as StreamLineupItem;

const playoutItem: PlayoutItem = {
  id: 'probe',
  start: new Date().toISOString(),
  finish: new Date(Date.now() + 20_000).toISOString(),
  source: { source_type: 'local', path: '/media/show.mkv' },
};

const ffmpegSettings = {
  ffmpegExecutablePath: '/usr/bin/ffmpeg',
  ffprobeExecutablePath: '/usr/bin/ffprobe',
  deinterlaceFilter: 'yadif=1',
  scalingAlgorithm: 'fast_bilinear',
  enableFileLogging: false,
  transcodeDirectory: undefined,
};

let tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-troubleshoot-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Builds a runner whose worker is a stand-in.
 *
 * The fake spawn writes whatever a real run would have left behind, then
 * emits the exit the test asked for, so everything after the spawn — the
 * playlist copy, the log scrape, the dossier read — runs for real.
 */
async function makeRunner({
  exitCode = 0,
  stderr = '',
  writesPlaylist = true,
  dossier,
  materialize,
}: {
  exitCode?: number | null;
  stderr?: string;
  writesPlaylist?: boolean;
  dossier?: string;
  materialize?: () => Promise<never>;
} = {}) {
  const baseDirectory = await makeTempDir();
  const root = path.join(baseDirectory, `etv_${channelUuid}`);
  const outputDirectory = path.join(root, 'out');

  const playoutWriter = {
    materializeProgram: vi.fn(
      materialize ??
        ((request: { startMs: number }) =>
          Promise.resolve({
            startMs: request.startMs,
            finishMs: request.startMs + 20_000,
            items: [playoutItem],
            ignored: ['the channel has no filler, so flex plays as black'],
          })),
    ),
  };

  const workerProcess = Object.assign(new EventEmitter(), {
    stderr: new EventEmitter(),
  });

  const killed = vi.fn();
  const spawn = vi.fn(async () => {
    if (writesPlaylist) {
      await fs.writeFile(
        path.join(outputDirectory, 'ffmpeg.m3u8'),
        '#EXTM3U\n#EXT-X-ENDLIST\n',
      );
    }

    if (dossier !== undefined) {
      const probeDir = path.join(root, '7_20260921T000000_probe');
      await fs.mkdir(probeDir, { recursive: true });
      await fs.writeFile(path.join(probeDir, 'ffreport.log'), dossier);
    }

    setImmediate(() => {
      if (stderr.length > 0) {
        workerProcess.stderr.emit('data', Buffer.from(stderr));
      }
      workerProcess.emit('exit', exitCode, null);
    });

    return { kill: killed, process: workerProcess };
  });

  const runner = new EtvNextTroubleshootRunner(
    { resolveChecked: vi.fn(() => Promise.resolve('/opt/ersatztv-channel')) },
    playoutWriter,
    { spawn },
  );

  const run = (channel = makeChannel()) =>
    runner.run({
      channel,
      lineupItem,
      ffmpegSettings: ffmpegSettings as never,
      baseDirectory,
      sessionId: channelUuid,
      timeoutMs: 5_000,
    });

  return { run, spawn, killed, outputDirectory, playoutWriter };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  tempDirs = [];
});

describe('EtvNextTroubleshootRunner', () => {
  test('reports success and publishes the complete playlist', async () => {
    const { run, spawn, outputDirectory } = await makeRunner();

    const result = await run();

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.outputDirectory).toBe(outputDirectory);

    // The page asks for live.m3u8, which a troubleshoot run leaves empty.
    await expect(
      fs.readFile(path.join(outputDirectory, 'live.m3u8'), 'utf-8'),
    ).resolves.toContain('#EXT-X-ENDLIST');

    expect(spawn.mock.calls[0]?.[1]).toContain('--troubleshoot');
  });

  test('reports the failure without a playlist when the worker dies', async () => {
    const { run, outputDirectory } = await makeRunner({
      exitCode: 1,
      writesPlaylist: false,
      stderr: 'ffprobe failed: No such file or directory\n',
    });

    const result = await run();

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No such file or directory');
    await expect(
      fs.access(path.join(outputDirectory, 'live.m3u8')),
    ).rejects.toThrow();
  });

  test('lifts the resolved FFmpeg command out of the worker log', async () => {
    const { run } = await makeRunner({
      stderr:
        'DEBUG channel_session] optimized pipeline: -i /media/show.mkv -f hls out.m3u8\n',
    });

    const result = await run();

    expect(result.ffmpegCommand).toBe('-i /media/show.mkv -f hls out.m3u8');
  });

  test('redacts media server tokens from everything it reports', async () => {
    const { run } = await makeRunner({
      stderr:
        'optimized pipeline: -i http://plex/part?X-Plex-Token=sup3rsecret -f hls out.m3u8\n',
      dossier: 'Command line:\n-i http://plex/part?X-Plex-Token=sup3rsecret\n',
    });

    const result = await run();

    expect(result.ffmpegCommand).toContain('X-Plex-Token=REDACTED');
    expect(result.ffmpegCommand).not.toContain('sup3rsecret');
    expect(result.stderr).not.toContain('sup3rsecret');
    expect(result.report).toContain('X-Plex-Token=REDACTED');
  });

  test('reads the FFmpeg report out of the dossier the worker leaves', async () => {
    const { run } = await makeRunner({ dossier: 'ffmpeg started on 2026\n' });

    const result = await run();

    expect(result.report).toContain('ffmpeg started on 2026');
  });

  test('reports the settings the backend drops', async () => {
    const { run } = await makeRunner();

    const result = await run({ ...makeChannel({ threadCount: 4 }) });

    expect(result.notes).toContain(
      'threadCount is ignored: the backend does not expose a thread count',
    );

    // Whatever the playout mapper had to degrade lands in the same list.
    expect(result.notes).toContain(
      'the channel has no filler, so flex plays as black',
    );
  });

  test('refuses an unsupported config without starting the worker', async () => {
    const { run, spawn } = await makeRunner();

    const result = await run(makeChannel({ audioFormat: 'flac' }));

    expect(result.success).toBe(false);
    expect(result.notes.join(' ')).toContain('audioFormat');
    expect(spawn).not.toHaveBeenCalled();
  });
});
