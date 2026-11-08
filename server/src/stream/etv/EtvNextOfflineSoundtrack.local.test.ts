import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import {
  createTempWorkdir,
  startRangelessFileServer,
} from '../../testing/ffmpeg/FfmpegIntegrationHelper.ts';
import { binaries, Fixtures } from '../../testing/ffmpeg/FfmpegTestFixtures.ts';
import { ETV_NEXT_BINARY_NAME } from './EtvNextBinaryResolver.ts';
import { toChannelConfig } from './EtvNextChannelConfigMapper.ts';
import { toPlayoutItem } from './EtvNextPlayoutItemMapper.ts';
import { EtvNextWorkspace } from './EtvNextWorkspace.ts';

// `pnpm download-ersatztv-next` puts the pinned worker here.
const etvBinary = path.resolve('bin', ETV_NEXT_BINARY_NAME);

const transcodeConfig = {
  uuid: 'tc-1',
  name: 'Default',
  threadCount: 0,
  hardwareAccelerationMode: 'none',
  vaapiDriver: 'system',
  vaapiDevice: null,
  resolution: { widthPx: 1280, heightPx: 720 },
  videoFormat: 'h264',
  videoProfile: null,
  videoPreset: null,
  videoBitDepth: 8,
  videoBitRate: 2000,
  videoBufferSize: 4000,
  audioChannels: 2,
  audioFormat: 'aac',
  audioBitRate: 192,
  audioBufferSize: 384,
  audioSampleRate: 48,
  audioVolumePercent: 100,
  audioLoudnormConfig: null,
  normalizeFrameRate: false,
  deinterlaceVideo: false,
  disableChannelOverlay: false,
  errorScreen: 'pic',
  errorScreenAudio: 'silent',
  isDefault: true,
  disableHardwareDecoder: false,
  disableHardwareEncoding: false,
  disableHardwareFilters: false,
} satisfies TranscodeConfigOrm;

describe.skipIf(!binaries || !existsSync(etvBinary))(
  'ErsatzTV next offline soundtrack',
  () => {
    let workdir: string;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      ({ dir: workdir, cleanup } = await createTempWorkdir());
    });

    afterAll(() => cleanup());

    async function runOfflineItem(name: string, soundtrack: string) {
      const workspace = new EtvNextWorkspace(workdir, name);
      await workspace.initialize();

      const { config } = toChannelConfig({
        transcodeConfig,
        ffmpegSettings: {
          ffmpegExecutablePath: binaries!.ffmpeg,
          ffprobeExecutablePath: binaries!.ffprobe,
          scalingAlgorithm: 'bicubic',
          deinterlaceFilter: 'none',
          enableFileLogging: false,
          transcodeDirectory: workdir,
        },
        playoutFolder: workspace.playoutDirectory,
        reportsFolder: workspace.root,
        subtitleMode: 'burn',
      });
      await workspace.writeChannelConfig(config);

      const durationMs = 10_000;
      const startMs = Date.now();
      const { item } = toPlayoutItem({
        id: 'offline',
        startMs,
        lineupItem: {
          type: 'offline',
          programBeginMs: startMs,
          duration: durationMs,
          streamDuration: durationMs,
          startOffset: 0,
        },
        resolution: transcodeConfig.resolution,
        offlinePicture: Fixtures.watermark,
        offlineSoundtrack: soundtrack,
      });
      await workspace.writePlayoutWindow(startMs, startMs + durationMs, [item]);

      const run = spawnSync(
        etvBinary,
        [
          'run',
          workspace.channelConfigPath,
          '--output-folder',
          workspace.outputDirectory,
          '--number',
          '1',
          '--troubleshoot',
        ],
        { encoding: 'utf-8', timeout: 60_000, killSignal: 'SIGKILL' },
      );

      expect(run.status, run.stderr).toBe(0);

      const pipeline = /optimized pipeline:\s*(.+)$/m.exec(run.stderr)?.[1];
      expect(pipeline, run.stderr).toContain(':loop=0');

      // Audio after the soundtrack's first pass ends must be sound, not padding.
      const tail = spawnSync(
        binaries!.ffmpeg,
        [
          '-ss',
          '6',
          '-t',
          '3',
          '-i',
          path.join(workspace.outputDirectory, 'ffmpeg.m3u8'),
          '-af',
          'volumedetect',
          '-f',
          'null',
          '-',
        ],
        { encoding: 'utf-8' },
      );
      const meanVolume = /mean_volume: (-?[\d.]+) dB/.exec(tail.stderr)?.[1];
      expect(meanVolume, tail.stderr).toBeDefined();
      expect(Number(meanVolume)).toBeGreaterThan(-60);
    }

    test('loops a soundtrack shorter than the offline item', async () => {
      // The fixture's audio runs 2.9 s, so it has to loop to fill 10 s. The
      // name holds every character the filter graph treats as syntax.
      const soundtrack = path.join(workdir, "it's: a, [looped] theme.ts");
      await copyFile(Fixtures.video720p, soundtrack);

      await runOfflineItem('local', soundtrack);
    });

    test('loops a soundtrack URL from a server that ignores Range requests', async () => {
      // Rewinding a WAV lands past its header, which needs a Range request.
      const wavPath = path.join(workdir, 'soundtrack.wav');
      const wav = spawnSync(binaries!.ffmpeg, [
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-ac',
        '2',
        '-y',
        wavPath,
      ]);
      expect(wav.status).toBe(0);

      const server = await startRangelessFileServer(wavPath);
      try {
        await runOfflineItem('url', server.url);
      } finally {
        server.close();
      }
    });
  },
);
