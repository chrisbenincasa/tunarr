/**
 * End-to-end check against a real ersatztv-channel binary.
 *
 * Writes a workspace with the same code the session uses, spawns the worker,
 * and waits for it to publish `.ready`. Proves the on-disk contract — config
 * shape, playout filename, document version — against the actual parser rather
 * than against the schema.
 *
 * Run: pnpm tsx scripts/etv-smoke.ts [--binary <path>]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toChannelConfig } from '../src/stream/etv/EtvNextChannelConfigMapper.ts';
import { EtvNextWorkspace } from '../src/stream/etv/EtvNextWorkspace.ts';
import type { PlayoutItem } from '../src/stream/etv/generated/playout.ts';

const binary = process.argv.includes('--binary')
  ? process.argv[process.argv.indexOf('--binary') + 1]
  : './bin/ersatztv-channel-linux-x64';

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-smoke-'));
const workspace = new EtvNextWorkspace(base, 'smoke');
await workspace.initialize();

// Only the fields the mapper reads are supplied; the casts keep the fixture
// from restating a whole ORM row for a dev-only script.
const { config, ignored } = toChannelConfig({
  transcodeConfig: {
    resolution: { widthPx: 640, heightPx: 480 },
    videoFormat: 'h264',
    videoBitRate: 2000,
    videoBufferSize: 4000,
    videoBitDepth: null,
    audioFormat: 'aac',
    audioBitRate: 128,
    audioBufferSize: 256,
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
  } as never,
  ffmpegSettings: {
    ffmpegExecutablePath: '/usr/bin/ffmpeg',
    ffprobeExecutablePath: '/usr/bin/ffprobe',
    deinterlaceFilter: 'yadif=1',
    scalingAlgorithm: 'fast_bilinear',
    enableFileLogging: false,
  } as never,
  playoutFolder: workspace.playoutDirectory,
});

await workspace.writeChannelConfig(config);
console.log(`channel.json written; ignored settings: ${ignored.length}`);

const startMs = Date.now();
const finishMs = startMs + 600_000;
const items: PlayoutItem[] = [
  {
    id: 'smoke-1',
    start: new Date(startMs).toISOString(),
    finish: new Date(finishMs).toISOString(),
    tracks: {
      video: {
        source: {
          source_type: 'lavfi',
          params: 'testsrc=size=640x480:rate=30',
        },
      },
      audio: { source: { source_type: 'lavfi', params: 'anullsrc' } },
    },
  },
];

const windowPath = await workspace.writePlayoutWindow(startMs, finishMs, items);
console.log(`playout window written: ${path.basename(windowPath)}`);

const child = spawn(
  binary,
  [
    'run',
    workspace.channelConfigPath,
    '--output-folder',
    workspace.outputDirectory,
    '--number',
    '1',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

let stderr = '';
child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));

let alive = true;
child.on('exit', () => (alive = false));

try {
  await workspace.waitForReady(() => alive);
  const produced = await fs.readdir(workspace.outputDirectory);
  const segments = produced.filter((f) => f.endsWith('.ts'));

  console.log(
    `READY. ${segments.length} segments, files: ${produced.join(', ')}`,
  );
  console.log(
    await fs
      .readFile(workspace.mediaPlaylistPath, 'utf-8')
      .then((s) => s.split('\n').slice(0, 6).join('\n')),
  );
  process.exitCode = 0;
} catch (e) {
  console.error('FAILED:', e);
  console.error(stderr.split('\n').slice(-12).join('\n'));
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await fs.rm(base, { recursive: true, force: true });
}
