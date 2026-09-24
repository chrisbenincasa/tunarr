/**
 * End-to-end check against a real ersatztv-channel binary, over the paths a
 * lavfi source cannot reach.
 *
 * `etv-smoke.ts` proves the on-disk contract — config shape, playout filename,
 * document version — against the actual parser. This one runs real media
 * through it and asks what the worker did with it: honor a probe hint, seek to
 * an in-point, tonemap HDR10, encode on the GPU.
 *
 * `--trace` is the part that earns the script. Every scenario produces
 * segments whether or not the worker understood the config, so segment count
 * proves nothing on its own. Under `--trace` the channel config points at a
 * shim that records each ffmpeg and ffprobe invocation and then execs the real
 * binary, which is what makes a silent downgrade visible: an accel mode that
 * quietly encodes with libx264 still yields four healthy segments.
 *
 * Run: pnpm tsx scripts/etv-smoke-ext.ts [--binary <path>] [--only <name>] [--trace]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toChannelConfig } from '../src/stream/etv/EtvNextChannelConfigMapper.ts';
import { EtvNextWorkspace } from '../src/stream/etv/EtvNextWorkspace.ts';
import type {
  PlayoutItem,
  ProbeHint,
} from '../src/stream/etv/generated/playout.ts';

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function option(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

const binary = option('--binary') ?? './bin/ersatztv-channel';
const only = option('--only');
const trace = flag('--trace');

const fixtures = path.resolve('src/testing/ffmpeg/fixtures');
const h264 = path.join(fixtures, '1080p_h264.mkv');
const hdr10 = path.join(fixtures, '1080p_hevc_hdr10.mkv');

const H264DurationMs = 3042;
const Hdr10DurationMs = 5034;

/**
 * Matches `ffprobe` on `1080p_h264.mkv` exactly.
 *
 * The point of the hint is that the worker trusts it and skips probing, so a
 * wrong value here would be indistinguishable from the hint being ignored.
 */
const h264Hint: ProbeHint = {
  format_name: 'matroska,webm',
  duration_ms: H264DurationMs,
  video: [
    {
      stream_index: 0,
      codec: 'h264',
      width: 1920,
      height: 1080,
      pix_fmt: 'yuv420p',
      frame_rate: '30',
    },
  ],
  audio: [{ stream_index: 1, codec: 'aac', channels: 1 }],
};

const baseTranscode = {
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
};

type Scenario = {
  name: string;
  what: string;
  transcode: Record<string, unknown>;
  items: (startMs: number, finishMs: number) => PlayoutItem[];
};

/**
 * Repeats one file back to back across the window.
 *
 * The fixtures run three and five seconds, and the worker publishes `.ready`
 * only after four segments, so a single item would never get there.
 */
function repeat(
  file: string,
  itemMs: number,
  extra: Record<string, unknown> = {},
) {
  return (startMs: number, finishMs: number): PlayoutItem[] => {
    const items: PlayoutItem[] = [];
    let cursor = startMs;
    while (cursor < finishMs) {
      const end = Math.min(cursor + itemMs, finishMs);
      items.push({
        id: `item-${items.length}`,
        start: new Date(cursor).toISOString(),
        finish: new Date(end).toISOString(),
        tracks: {
          video: { source: { source_type: 'local', path: file, ...extra } },
          audio: { source: { source_type: 'local', path: file, ...extra } },
        },
      } as PlayoutItem);
      cursor = end;
    }
    return items;
  };
}

const scenarios: Scenario[] = [
  {
    name: 'local-h264',
    what: 'a real file transcodes at all',
    transcode: baseTranscode,
    items: repeat(h264, H264DurationMs),
  },
  {
    name: 'probe-hint-and-seek',
    what: 'a probe hint suppresses ffprobe and an in-point seeks',
    transcode: baseTranscode,
    items: repeat(h264, H264DurationMs - 1000, {
      in_point_ms: 1000,
      out_point_ms: H264DurationMs,
      probe_hint: h264Hint,
    }),
  },
  {
    name: 'hdr10-tonemap',
    what: 'HDR10 HEVC reaches an SDR h264 output',
    transcode: baseTranscode,
    items: repeat(hdr10, Hdr10DurationMs),
  },
  {
    name: 'vaapi',
    what: 'an accel mode actually reaches the GPU',
    transcode: {
      ...baseTranscode,
      hardwareAccelerationMode: 'vaapi',
      vaapiDevice: '/dev/dri/renderD128',
    },
    items: repeat(h264, H264DurationMs),
  },
  {
    // The stock configuration: the device column is nullable and the driver
    // defaults to `system`, so this is what most VAAPI users actually send.
    name: 'vaapi-defaults',
    what: 'accel survives a config that names neither device nor driver',
    transcode: {
      ...baseTranscode,
      hardwareAccelerationMode: 'vaapi',
      vaapiDevice: null,
      vaapiDriver: 'system',
    },
    items: repeat(h264, H264DurationMs),
  },
];

/**
 * Writes an ffmpeg/ffprobe pair that appends its arguments to `ETV_SHIM_LOG`
 * and then execs the real binary.
 */
async function writeShim(directory: string): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const file = path.join(directory, tool);
    await fs.writeFile(
      file,
      `#!/bin/sh\n{ echo "=== ${tool} ==="; for a in "$@"; do echo "$a"; done; } >> "$ETV_SHIM_LOG"\nexec /usr/bin/${tool} "$@"\n`,
      'utf-8',
    );
    await fs.chmod(file, 0o755);
  }
  return directory;
}

type Trace = { ffprobeCalls: number; videoCodec: string; hwaccel: boolean };

/** Reads the last real transcode out of a shim log. */
function readTrace(log: string): Trace {
  const blocks = log.split('=== ');
  const ffprobeCalls = blocks.filter((b) => b.startsWith('ffprobe')).length;
  const transcodes = blocks.filter(
    (b) => b.startsWith('ffmpeg') && b.includes('-hls_segment_filename'),
  );
  const last = transcodes[transcodes.length - 1] ?? '';
  const args = last
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const at = args.indexOf('-vcodec');

  return {
    ffprobeCalls,
    videoCodec: at === -1 ? '(none)' : (args[at + 1] ?? '(none)'),
    hwaccel: args.includes('-hwaccel') || args.includes('-vaapi_device'),
  };
}

async function run(scenario: Scenario): Promise<boolean> {
  const base = await fs.mkdtemp(
    path.join(os.tmpdir(), `etv-${scenario.name}-`),
  );
  const shimLog = path.join(base, 'shim.log');
  const binDir = trace ? await writeShim(path.join(base, 'shim')) : '/usr/bin';
  const workspace = new EtvNextWorkspace(base, scenario.name);
  await workspace.initialize();

  const { config, ignored } = toChannelConfig({
    transcodeConfig: scenario.transcode as never,
    ffmpegSettings: {
      ffmpegExecutablePath: path.join(binDir, 'ffmpeg'),
      ffprobeExecutablePath: path.join(binDir, 'ffprobe'),
      deinterlaceFilter: 'yadif=1',
      scalingAlgorithm: 'fast_bilinear',
      enableFileLogging: false,
    } as never,
    playoutFolder: workspace.playoutDirectory,
  });

  await workspace.writeChannelConfig(config);

  const startMs = Date.now();
  const finishMs = startMs + 60_000;
  const items = scenario.items(startMs, finishMs);
  await workspace.writePlayoutWindow(startMs, finishMs, items);

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
    {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, ETV_SHIM_LOG: shimLog },
    },
  );

  let stderr = '';
  child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));

  let alive = true;
  child.on('exit', () => (alive = false));

  let ok = false;
  try {
    await workspace.waitForReady(() => alive);

    const produced = await fs.readdir(workspace.outputDirectory);
    const segments = produced.filter((f) => f.endsWith('.ts'));
    const sizes = await Promise.all(
      segments.map((s) =>
        fs.stat(path.join(workspace.outputDirectory, s)).then((st) => st.size),
      ),
    );
    const kib = sizes.reduce((a, b) => a + b, 0) / 1024;
    ok = kib > 0;

    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${scenario.name} — ${scenario.what}`,
    );
    console.log(
      `        ${items.length} items, ${segments.length} segments, ${kib.toFixed(0)} KiB, ${ignored.length} ignored settings`,
    );

    if (trace) {
      const t = readTrace(await fs.readFile(shimLog, 'utf-8'));
      console.log(
        `        ffprobe calls: ${t.ffprobeCalls}, video codec: ${t.videoCodec}, hardware: ${t.hwaccel}`,
      );
    }
  } catch (e) {
    console.log(`  FAIL  ${scenario.name}: ${String(e)}`);
    console.log(
      stderr
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .slice(-15)
        .map((l) => `        ${l}`)
        .join('\n'),
    );
  } finally {
    child.kill('SIGTERM');
    await fs.rm(base, { recursive: true, force: true });
  }

  return ok;
}

let failures = 0;
for (const scenario of scenarios) {
  if (only !== undefined && scenario.name !== only) {
    continue;
  }
  if (!(await run(scenario))) {
    failures++;
  }
}

process.exitCode = failures > 0 ? 1 : 0;
