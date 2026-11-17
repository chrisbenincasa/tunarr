import dayjs from 'dayjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  FileStreamSource,
  HttpStreamSource,
} from '../../../../stream/types.ts';
import { loopableInputLocation } from '../../../../util/index.ts';
import {
  createTempWorkdir,
  probeFile,
  runFfmpegWithPipeline,
  startRangelessFileServer,
} from '../../../../testing/ffmpeg/FfmpegIntegrationHelper.ts';
import {
  binaries,
  ffmpegTest,
  Fixtures,
} from '../../../../testing/ffmpeg/FfmpegTestFixtures.ts';
import {
  AudioFormats,
  FileOutputLocation,
  VideoPresets,
} from '../../constants.ts';
import { PixelFormatYuv420P } from '../../format/PixelFormat.ts';
import { AudioInputSource } from '../../input/AudioInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import {
  AudioStream,
  StillImageStream,
  VideoStream,
} from '../../MediaStream.ts';
import { AudioState } from '../../state/AudioState.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { SoftwarePipelineBuilder } from './SoftwarePipelineBuilder.ts';

describe.skipIf(!binaries)('SoftwarePipelineBuilder integration', () => {
  let workdir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ dir: workdir, cleanup } = await createTempWorkdir());
  });

  afterAll(() => cleanup());

  function makeVideoInput(inputPath: string, frameSize: FrameSize) {
    return VideoInputSource.withStream(
      new FileStreamSource(inputPath),
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize,
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
    );
  }

  function makeAudioInput(inputPath: string) {
    return AudioInputSource.withStream(
      new FileStreamSource(inputPath),
      AudioStream.create({
        channels: 2,
        codec: 'aac',
        index: 1,
      }),
      AudioState.create({
        audioEncoder: AudioFormats.Aac,
        audioChannels: 2,
        audioBitrate: 192,
        audioBufferSize: 384,
      }),
    );
  }

  ffmpegTest(
    'basic h264 software transcode',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video720p,
        FrameSize.withDimensions(1280, 720),
      );
      const audio = makeAudioInput(Fixtures.video720p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
      });

      const outputPath = path.join(workdir, 'output_transcode.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        pipeline.getCommandArgs(),
      );

      expect(
        exitCode,
        `Pipeline command failed: ${pipeline.getCommandArgs().join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.streams.some((s) => s.codec_type === 'video')).toBe(true);
    },
  );

  ffmpegTest(
    'scale from 1080p to 720p',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video1080p,
        FrameSize.withDimensions(1920, 1080),
      );
      const audio = makeAudioInput(Fixtures.video1080p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
      });

      const outputPath = path.join(workdir, 'output_scale.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        pipeline.getCommandArgs(),
      );

      expect(
        exitCode,
        `Pipeline command failed: ${pipeline.getCommandArgs().join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.streams.some((s) => s.codec_type === 'video')).toBe(true);
    },
  );

  ffmpegTest(
    'scale from 1080p to 720p uses the configured software scaling algorithm',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video1080p,
        FrameSize.withDimensions(1920, 1080),
      );
      const audio = makeAudioInput(Fixtures.video1080p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
      });

      const outputPath = path.join(workdir, 'output_scale_lanczos.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
          // The offline/error session builds honor the configured software
          // scaling algorithm (#2024 style); a non-default value should be
          // carried into the real scale filter flags.
          softwareScalingAlgorithm: 'lanczos',
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const args = pipeline.getCommandArgs();
      expect(args.join(' ')).toContain('flags=lanczos');

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        args,
      );

      expect(
        exitCode,
        `Pipeline command failed: ${args.join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      const videoStream = probe.streams.find((s) => s.codec_type === 'video');
      expect(videoStream).toBeDefined();
      expect(videoStream!.width).toBe(1280);
      expect(videoStream!.height).toBe(720);
    },
  );

  ffmpegTest(
    'software transcode with deinterlace=true applies the configured deinterlace filter',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video720p,
        FrameSize.withDimensions(1280, 720),
      );
      const audio = makeAudioInput(Fixtures.video720p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        deinterlace: true,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
      });

      const outputPath = path.join(workdir, 'output_deinterlace.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
          // Mirror the offline/error session wiring: the configured
          // deinterlace filter replaces the FfmpegState default.
          softwareDeinterlaceFilter: 'yadif=0',
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const args = pipeline.getCommandArgs();
      expect(args.join(' ')).toContain('yadif=0');

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        args,
      );

      expect(
        exitCode,
        `Pipeline command failed: ${args.join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.streams.some((s) => s.codec_type === 'video')).toBe(true);
    },
  );

  ffmpegTest(
    'h264 software transcode includes -preset:v veryfast',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video720p,
        FrameSize.withDimensions(1280, 720),
      );
      const audio = makeAudioInput(Fixtures.video720p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
        videoPreset: VideoPresets.VeryFast,
      });

      const outputPath = path.join(workdir, 'output_preset.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const args = pipeline.getCommandArgs();
      const presetIdx = args.indexOf('-preset:v');

      expect(presetIdx).toBeGreaterThan(-1);
      expect(args[presetIdx + 1]).toBe('veryfast');

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        args,
      );

      expect(
        exitCode,
        `Pipeline command failed: ${args.join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.streams.some((s) => s.codec_type === 'video')).toBe(true);
      expect(
        probe.streams.some(
          (s) => s.codec_type === 'video' && s.codec_name === 'h264',
        ),
      ).toBe(true);
    },
  );

  ffmpegTest(
    'h264 transcode without preset does not include -preset:v',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video720p,
        FrameSize.withDimensions(1280, 720),
      );
      const audio = makeAudioInput(Fixtures.video720p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
        // No videoPreset
      });

      const outputPath = path.join(workdir, 'output_no_preset.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const args = pipeline.getCommandArgs();
      expect(args).not.toContain('-preset:v');

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        args,
      );

      expect(
        exitCode,
        `Pipeline command failed: ${args.join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.streams.some((s) => s.codec_type === 'video')).toBe(true);
    },
  );

  ffmpegTest(
    'copy mode (no transcode)',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const video = makeVideoInput(
        Fixtures.video720p,
        FrameSize.withDimensions(1280, 720),
      );
      const audio = makeAudioInput(Fixtures.video720p);

      const builder = new SoftwarePipelineBuilder(
        video,
        audio,
        null,
        null,
        null,
        binaryCapabilities,
      );

      const frameState = new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(1280, 720),
        paddedSize: FrameSize.withDimensions(1280, 720),
        videoFormat: 'copy',
      });

      const outputPath = path.join(workdir, 'output_copy.ts');
      const pipeline = builder.build(
        FfmpegState.create({
          version: ffmpegVersion,
          outputLocation: FileOutputLocation(outputPath, true),
        }),
        frameState,
        DefaultPipelineOptions,
      );

      const { exitCode, stderr } = runFfmpegWithPipeline(
        binaries!.ffmpeg,
        pipeline.getCommandArgs(),
      );

      expect(
        exitCode,
        `Pipeline command failed: ${pipeline.getCommandArgs().join(' ')}\n${stderr}`,
      ).toBe(0);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.streams.some((s) => s.codec_type === 'video')).toBe(true);
    },
  );

  // Mirrors an offline session. The infinite loop flag loops every input.
  function runSoundtrackLoop(
    ffmpegVersion: FfmpegState['version'],
    binaryCapabilities: ConstructorParameters<
      typeof SoftwarePipelineBuilder
    >[5],
    audio: AudioInputSource,
    outputPath: string,
    durationMs: number,
  ) {
    const video = VideoInputSource.withStream(
      new FileStreamSource(Fixtures.watermark),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(0, 0),
        index: 0,
      }),
    );

    const builder = new SoftwarePipelineBuilder(
      video,
      audio,
      null,
      null,
      null,
      binaryCapabilities,
    );

    const args = builder
      .build(
        FfmpegState.create({
          version: ffmpegVersion,
          duration: dayjs.duration(durationMs),
          outputLocation: FileOutputLocation(outputPath, true),
        }),
        new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.withDimensions(1280, 720),
          paddedSize: FrameSize.withDimensions(1280, 720),
          realtime: false,
          infiniteLoop: true,
        }),
        DefaultPipelineOptions,
      )
      .getCommandArgs();

    // ffmpeg ignores SIGTERM while it retries a failed rewind.
    const run = spawnSync(binaries!.ffmpeg, args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 30_000,
      killSignal: 'SIGKILL',
    });
    return { args, run };
  }

  function tailMeanVolume(outputPath: string) {
    const tail = spawnSync(
      binaries!.ffmpeg,
      [
        '-ss',
        '6',
        '-t',
        '3',
        '-i',
        outputPath,
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
    return Number(meanVolume);
  }

  function makeSoundtrackState(durationMs: number) {
    return AudioState.create({
      audioEncoder: AudioFormats.Aac,
      audioChannels: 2,
      audioBitrate: 192,
      audioBufferSize: 384,
      audioDuration: durationMs,
    });
  }

  ffmpegTest(
    'loops a short soundtrack under a still image for the full duration',
    ({ binaryCapabilities, ffmpegVersion }) => {
      // The fixture's audio runs 2.9 s, so a 10 s output only fills if the
      // input loops.
      const durationMs = 10_000;
      const audio = AudioInputSource.withStream(
        new FileStreamSource(Fixtures.video720p),
        AudioStream.create({ channels: 2, codec: 'aac', index: 1 }),
        makeSoundtrackState(durationMs),
      );

      const outputPath = path.join(workdir, 'output_soundtrack_loop.ts');
      const { args, run } = runSoundtrackLoop(
        ffmpegVersion,
        binaryCapabilities,
        audio,
        outputPath,
        durationMs,
      );
      expect(run.status, `${args.join(' ')}\n${run.stderr}`).toBe(0);
      // The still image loops by its own flag, so only the soundtrack has this.
      expect(args.filter((arg) => arg === '-stream_loop')).toHaveLength(1);

      const probe = probeFile(binaries!.ffprobe, outputPath);
      expect(probe.format.duration).toBeGreaterThan(9.5);
      expect(tailMeanVolume(outputPath)).toBeGreaterThan(-60);
    },
  );

  ffmpegTest(
    'loops a soundtrack URL from a server that ignores Range requests',
    async ({ binaryCapabilities, ffmpegVersion }) => {
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
        const durationMs = 10_000;
        const audio = AudioInputSource.withStream(
          new HttpStreamSource(loopableInputLocation(server.url)),
          AudioStream.create({ channels: 2, codec: 'pcm_s16le', index: 0 }),
          makeSoundtrackState(durationMs),
        );

        const outputPath = path.join(workdir, 'output_soundtrack_url.ts');
        const { args, run } = runSoundtrackLoop(
          ffmpegVersion,
          binaryCapabilities,
          audio,
          outputPath,
          durationMs,
        );
        expect(run.status, `${args.join(' ')}\n${run.stderr}`).toBe(0);
        expect(tailMeanVolume(outputPath)).toBeGreaterThan(-60);
      } finally {
        server.close();
      }
    },
  );
});
