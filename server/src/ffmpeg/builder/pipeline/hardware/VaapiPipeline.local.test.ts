import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStreamSource } from '../../../../stream/types.ts';

dayjs.extend(duration);
import {
  createTempWorkdir,
  probeFile,
  runFfmpegWithPipeline,
} from '../../../../testing/ffmpeg/FfmpegIntegrationHelper.ts';
import {
  binaries,
  vaapiInfo,
  vaapiOpenclSupported,
  vaapiTest,
} from '../../../../testing/ffmpeg/FfmpegTestFixtures.ts';
import {
  EmptyFfmpegCapabilities,
  FfmpegCapabilities,
} from '../../capabilities/FfmpegCapabilities.ts';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from '../../capabilities/VaapiHardwareCapabilities.ts';
import {
  AudioFormats,
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
  FileOutputLocation,
  VideoFormats,
} from '../../constants.ts';
import { ColorFormat } from '../../format/ColorFormat.ts';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import {
  AudioInputFilterSource,
  AudioInputSource,
} from '../../input/AudioInputSource.ts';
import { LavfiVideoInputSource } from '../../input/LavfiVideoInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';
import {
  AudioStream,
  StillImageStream,
  VideoStream,
} from '../../MediaStream.ts';
import { KnownFfmpegFilters } from '../../options/KnownFfmpegOptions.ts';
import { AudioState } from '../../state/AudioState.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { TONEMAP_ENABLED, TUNARR_ENV_VARS } from '../../../../util/env.ts';
import { VaapiPipelineBuilder } from './VaapiPipelineBuilder.ts';

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../testing/ffmpeg/fixtures',
);

const Fixtures = {
  video720p: path.join(fixturesDir, '720p_h264.ts'),
  video1080p: path.join(fixturesDir, '1080p_h264.ts'),
  video480p43: path.join(fixturesDir, '480p_h264.ts'),
  videoHdr720p: path.join(fixturesDir, '720p_hevc_hdr10.ts'),
  watermark: path.join(fixturesDir, 'watermark.png'),
} as const;

// Limit output to 1 second in all integration tests to keep runs fast
const testDuration = dayjs.duration(1, 'second');

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function make43VideoInput(inputPath: string) {
  return VideoInputSource.withStream(
    new FileStreamSource(inputPath),
    VideoStream.create({
      codec: 'h264',
      profile: 'main',
      displayAspectRatio: '4:3',
      frameSize: FrameSize.withDimensions(640, 480),
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
      colorFormat: null,
    }),
  );
}

function makeHdrVideoInput(inputPath: string) {
  return VideoInputSource.withStream(
    new FileStreamSource(inputPath),
    VideoStream.create({
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.withDimensions(1280, 720),
      index: 0,
      pixelFormat: new PixelFormatYuv420P10Le(),
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    }),
  );
}

// ─── Existing basic tests ─────────────────────────────────────────────────────

describe.skipIf(!binaries || !vaapiInfo)(
  'VaapiPipelineBuilder integration',
  () => {
    let workdir: string;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      ({ dir: workdir, cleanup } = await createTempWorkdir());
    });

    afterAll(() => cleanup());

    vaapiTest(
      'basic h264 vaapi transcode',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video720p,
          FrameSize.withDimensions(1280, 720),
        );
        const audio = makeAudioInput(Fixtures.video720p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const frameState = new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.withDimensions(1280, 720),
          paddedSize: FrameSize.withDimensions(1280, 720),
          pixelFormat: new PixelFormatYuv420P(),
        });

        const outputPath = path.join(workdir, 'vaapi_transcode.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
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

    vaapiTest(
      'scale from 1080p to 720p via vaapi',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video1080p,
          FrameSize.withDimensions(1920, 1080),
        );
        const audio = makeAudioInput(Fixtures.video1080p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const frameState = new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.withDimensions(1280, 720),
          paddedSize: FrameSize.withDimensions(1280, 720),
          pixelFormat: new PixelFormatYuv420P(),
        });

        const outputPath = path.join(workdir, 'vaapi_scale.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
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

    vaapiTest(
      'copy mode (vaapi pipeline, no hw transcode needed)',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video720p,
          FrameSize.withDimensions(1280, 720),
        );
        const audio = makeAudioInput(Fixtures.video720p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const frameState = new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.withDimensions(1280, 720),
          paddedSize: FrameSize.withDimensions(1280, 720),
          videoFormat: 'copy',
        });

        const outputPath = path.join(workdir, 'vaapi_copy.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
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
  },
);

// ─── Pipeline Options ─────────────────────────────────────────────────────────

describe.skipIf(!binaries || !vaapiInfo)(
  'VaapiPipelineBuilder pipeline options integration',
  () => {
    let workdir: string;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      ({ dir: workdir, cleanup } = await createTempWorkdir());
    });

    afterAll(() => cleanup());

    vaapiTest(
      'hardware decoding disabled',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video720p,
          FrameSize.withDimensions(1280, 720),
        );
        const audio = makeAudioInput(Fixtures.video720p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'decode_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          new FrameState({
            isAnamorphic: false,
            scaledSize: FrameSize.withDimensions(1280, 720),
            paddedSize: FrameSize.withDimensions(1280, 720),
          }),
          // Also disable encoding: sw-decode + hw-encode without hwupload is a
          // known pipeline bug; this tests graceful sw-only fallback instead.
          {
            ...DefaultPipelineOptions,
            disableHardwareDecoding: true,
            disableHardwareEncoding: true,
          },
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

    vaapiTest(
      'hardware encoding disabled',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video720p,
          FrameSize.withDimensions(1280, 720),
        );
        const audio = makeAudioInput(Fixtures.video720p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'encode_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          new FrameState({
            isAnamorphic: false,
            scaledSize: FrameSize.withDimensions(1280, 720),
            paddedSize: FrameSize.withDimensions(1280, 720),
          }),
          { ...DefaultPipelineOptions, disableHardwareEncoding: true },
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

    vaapiTest(
      'hardware filters disabled',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video720p,
          FrameSize.withDimensions(1280, 720),
        );
        const audio = makeAudioInput(Fixtures.video720p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'filters_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          new FrameState({
            isAnamorphic: false,
            scaledSize: FrameSize.withDimensions(1280, 720),
            paddedSize: FrameSize.withDimensions(1280, 720),
          }),
          // Also disable encoding: sw-decode + hw-encode without hwupload is a
          // known pipeline bug; this tests graceful sw-only fallback instead.
          {
            ...DefaultPipelineOptions,
            disableHardwareFilters: true,
            disableHardwareEncoding: true,
          },
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

    vaapiTest(
      'lavfi error text with noise audio',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const audioState = AudioState.create({
          audioEncoder: AudioFormats.Aac,
          audioChannels: 2,
          audioBitrate: 192,
          audioBufferSize: 384,
        });

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          LavfiVideoInputSource.errorText(FrameSize.FHD, 'Error', 'Test'),
          AudioInputFilterSource.noise(audioState),
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'lavfi_error_text.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          new FrameState({
            isAnamorphic: false,
            scaledSize: FrameSize.FHD,
            paddedSize: FrameSize.FHD,
            videoFormat: VideoFormats.H264,
            pixelFormat: new PixelFormatYuv420P(),
          }),
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
  },
);

// ─── Padding ──────────────────────────────────────────────────────────────────

describe.skipIf(!binaries || !vaapiInfo)(
  'VaapiPipelineBuilder pad integration',
  () => {
    let workdir: string;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      ({ dir: workdir, cleanup } = await createTempWorkdir());
    });

    afterAll(() => cleanup());

    afterEach(() => {
      delete process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD];
    });

    // 4:3 → scaledSize=1440x1080, paddedSize=1920x1080 (needs pillarboxing)
    function makePadFrameState() {
      const videoStream = VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '4:3',
        frameSize: FrameSize.withDimensions(640, 480),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      });
      return new FrameState({
        isAnamorphic: false,
        scaledSize: videoStream.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: VideoFormats.H264,
      });
    }

    vaapiTest(
      '4:3 source padded to 1920x1080 (real capabilities)',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'pad_real_caps.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makePadFrameState(),
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
        const videoStream = probe.streams.find((s) => s.codec_type === 'video');
        expect(videoStream).toBeDefined();
        expect(videoStream!.width).toBe(1920);
        expect(videoStream!.height).toBe(1080);
      },
    );

    vaapiTest(
      '4:3 source padded to 1920x1080 (software pad, EmptyFfmpegCapabilities)',
      async ({ ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          EmptyFfmpegCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'pad_software.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makePadFrameState(),
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
        const videoStream = probe.streams.find((s) => s.codec_type === 'video');
        expect(videoStream).toBeDefined();
        expect(videoStream!.width).toBe(1920);
        expect(videoStream!.height).toBe(1080);
      },
    );

    vaapiTest(
      '4:3 source padded to 1920x1080 (hardware decode disabled)',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'pad_decode_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makePadFrameState(),
          { ...DefaultPipelineOptions, disableHardwareDecoding: true },
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
        const videoStream = probe.streams.find((s) => s.codec_type === 'video');
        expect(videoStream).toBeDefined();
        expect(videoStream!.width).toBe(1920);
        expect(videoStream!.height).toBe(1080);
      },
    );

    vaapiTest(
      'TUNARR_DISABLE_VAAPI_PAD=true forces software pad',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'true';

        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'pad_env_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makePadFrameState(),
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
        const videoStream = probe.streams.find((s) => s.codec_type === 'video');
        expect(videoStream).toBeDefined();
        expect(videoStream!.width).toBe(1920);
        expect(videoStream!.height).toBe(1080);
      },
    );

    vaapiTest(
      '16:9 FHD source needs no padding (1080p fixture)',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video1080p,
          FrameSize.withDimensions(1920, 1080),
        );
        const audio = makeAudioInput(Fixtures.video1080p);

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'pad_fhd_no_pad.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          new FrameState({
            isAnamorphic: false,
            scaledSize: FrameSize.FHD,
            paddedSize: FrameSize.FHD,
            pixelFormat: new PixelFormatYuv420P(),
            videoFormat: VideoFormats.H264,
          }),
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

    vaapiTest(
      '4:3 source with watermark overlay',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);
        const watermark = new WatermarkInputSource(
          new FileStreamSource(Fixtures.watermark),
          StillImageStream.create({
            frameSize: FrameSize.withDimensions(100, 100),
            index: 0,
          }),
          {
            enabled: true,
            position: 'top-left',
            width: 100,
            verticalMargin: 5,
            horizontalMargin: 5,
            duration: 0,
            opacity: 100,
          },
        );

        const builder = new VaapiPipelineBuilder(
          resolvedVaapi.capabilities,
          binaryCapabilities,
          video,
          audio,
          watermark,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'pad_watermark.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makePadFrameState(),
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
  },
);

// ─── Scaling ──────────────────────────────────────────────────────────────────

describe.skipIf(!binaries || !vaapiInfo)(
  'VaapiPipelineBuilder scale integration',
  () => {
    let workdir: string;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      ({ dir: workdir, cleanup } = await createTempWorkdir());
    });

    afterAll(() => cleanup());

    // Capabilities that include both H264 and HEVC decode/encode
    function makeVaapiCapsWithH264AndHevc() {
      return new VaapiHardwareCapabilities([
        new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Decode),
        new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Encode),
        new VaapiProfileEntrypoint(VaapiProfiles.HevcMain10, VaapiEntrypoint.Decode),
        new VaapiProfileEntrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.Encode),
      ]);
    }

    // 4:3 640x480 → scaledSize=1440x1080, paddedSize=1920x1080
    function make43ScaleFrameState() {
      const videoStream = VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '4:3',
        frameSize: FrameSize.withDimensions(640, 480),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      });
      return new FrameState({
        isAnamorphic: false,
        scaledSize: videoStream.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: VideoFormats.H264,
      });
    }

    function assertFhdOutput(probePath: string) {
      const probe = probeFile(binaries!.ffprobe, probePath);
      const videoStream = probe.streams.find((s) => s.codec_type === 'video');
      expect(videoStream).toBeDefined();
      expect(videoStream!.width).toBe(1920);
      expect(videoStream!.height).toBe(1080);
    }

    vaapiTest(
      '4:3 source hardware scale to 1920x1080',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          makeVaapiCapsWithH264AndHevc(),
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'scale_hw_43.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          make43ScaleFrameState(),
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
        assertFhdOutput(outputPath);
      },
    );

    vaapiTest(
      '4:3 source fully software pipeline (hw decode, encode, and filters all disabled)',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          makeVaapiCapsWithH264AndHevc(),
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'scale_sw_both_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          make43ScaleFrameState(),
          {
            ...DefaultPipelineOptions,
            disableHardwareDecoding: true,
            disableHardwareEncoding: true,
            disableHardwareFilters: true,
          },
        );

        const { exitCode, stderr } = runFfmpegWithPipeline(
          binaries!.ffmpeg,
          pipeline.getCommandArgs(),
        );

        expect(
          exitCode,
          `Pipeline command failed: ${pipeline.getCommandArgs().join(' ')}\n${stderr}`,
        ).toBe(0);
        assertFhdOutput(outputPath);
      },
    );

    vaapiTest(
      '4:3 source hardware scale when both hw disabled but deinterlace enabled',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          makeVaapiCapsWithH264AndHevc(),
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'scale_hw_deinterlace.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          new FrameState({
            isAnamorphic: false,
            scaledSize: VideoStream.create({
              codec: 'h264',
              profile: 'main',
              displayAspectRatio: '4:3',
              frameSize: FrameSize.withDimensions(640, 480),
              index: 0,
              pixelFormat: new PixelFormatYuv420P(),
              providedSampleAspectRatio: null,
              colorFormat: null,
            }).squarePixelFrameSize(FrameSize.FHD),
            paddedSize: FrameSize.FHD,
            pixelFormat: new PixelFormatYuv420P(),
            videoFormat: VideoFormats.H264,
            deinterlace: true,
          }),
          {
            ...DefaultPipelineOptions,
            disableHardwareDecoding: true,
            disableHardwareEncoding: true,
          },
        );

        const { exitCode, stderr } = runFfmpegWithPipeline(
          binaries!.ffmpeg,
          pipeline.getCommandArgs(),
        );

        expect(
          exitCode,
          `Pipeline command failed: ${pipeline.getCommandArgs().join(' ')}\n${stderr}`,
        ).toBe(0);
        assertFhdOutput(outputPath);
      },
    );

    vaapiTest(
      '16:9 720p source hardware scale to 1920x1080 (no padding needed)',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = makeVideoInput(
          Fixtures.video720p,
          FrameSize.withDimensions(1280, 720),
        );
        const audio = makeAudioInput(Fixtures.video720p);

        const builder = new VaapiPipelineBuilder(
          makeVaapiCapsWithH264AndHevc(),
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'scale_sw_169_no_pad.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          // 16:9 → scaledSize == paddedSize, no padding needed; hw decode → frames on hw → scale_vaapi
          new FrameState({
            isAnamorphic: false,
            scaledSize: FrameSize.FHD,
            paddedSize: FrameSize.FHD,
            pixelFormat: new PixelFormatYuv420P(),
            videoFormat: VideoFormats.H264,
          }),
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
        assertFhdOutput(outputPath);
      },
    );

    vaapiTest(
      '4:3 source software scale when hardware filters disabled',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        const video = make43VideoInput(Fixtures.video480p43);
        const audio = makeAudioInput(Fixtures.video480p43);

        const builder = new VaapiPipelineBuilder(
          makeVaapiCapsWithH264AndHevc(),
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'scale_sw_filters_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          make43ScaleFrameState(),
          { ...DefaultPipelineOptions, disableHardwareFilters: true },
        );

        const { exitCode, stderr } = runFfmpegWithPipeline(
          binaries!.ffmpeg,
          pipeline.getCommandArgs(),
        );

        expect(
          exitCode,
          `Pipeline command failed: ${pipeline.getCommandArgs().join(' ')}\n${stderr}`,
        ).toBe(0);
        assertFhdOutput(outputPath);
      },
    );
  },
);

// ─── Tonemapping ─────────────────────────────────────────────────────────────

const canDecodeHdr =
  vaapiInfo?.capabilities.canDecode(
    VideoFormats.Hevc,
    'main 10',
    new PixelFormatYuv420P10Le(),
  ) ?? false;

describe.skipIf(!binaries || !vaapiInfo || !canDecodeHdr)(
  'VaapiPipelineBuilder tonemap integration',
  () => {
    let workdir: string;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      ({ dir: workdir, cleanup } = await createTempWorkdir());
    });

    afterAll(() => cleanup());

    afterEach(() => {
      delete process.env[TONEMAP_ENABLED];
    });

    function makeHdrVaapiCapabilities() {
      return new VaapiHardwareCapabilities([
        new VaapiProfileEntrypoint(VaapiProfiles.HevcMain10, VaapiEntrypoint.Decode),
        new VaapiProfileEntrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.Encode),
        new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Encode),
      ]);
    }

    function makeHdrFrameState() {
      return new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: VideoFormats.H264,
      });
    }

    vaapiTest.skipIf(!vaapiOpenclSupported)(
      'HDR10 content tonemapped via opencl',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        process.env[TONEMAP_ENABLED] = 'true';

        const video = makeHdrVideoInput(Fixtures.videoHdr720p);
        const audio = makeAudioInput(Fixtures.videoHdr720p);

        // Merge TonemapOpencl into real capabilities so this path is available
        const capsWithOpencl = new FfmpegCapabilities(
          binaryCapabilities.allOptions(),
          binaryCapabilities.allVideoEncoders(),
          new Set([...binaryCapabilities.allFilters(), KnownFfmpegFilters.TonemapOpencl]),
          new Set(),
        );

        const builder = new VaapiPipelineBuilder(
          makeHdrVaapiCapabilities(),
          capsWithOpencl,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'tonemap_opencl.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makeHdrFrameState(),
          {
            ...DefaultPipelineOptions,
            vaapiPipelineOptions: { tonemapPreference: 'opencl' },
          },
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

    vaapiTest(
      'TONEMAP_ENABLED=false skips tonemapping',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        // No TONEMAP_ENABLED set (defaults to off)
        const video = makeHdrVideoInput(Fixtures.videoHdr720p);
        const audio = makeAudioInput(Fixtures.videoHdr720p);

        const builder = new VaapiPipelineBuilder(
          makeHdrVaapiCapabilities(),
          binaryCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'tonemap_disabled.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makeHdrFrameState(),
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

    vaapiTest(
      'software tonemap fallback (no hardware tonemap capability)',
      async ({ ffmpegVersion, resolvedVaapi }) => {
        process.env[TONEMAP_ENABLED] = 'true';

        const video = makeHdrVideoInput(Fixtures.videoHdr720p);
        const audio = makeAudioInput(Fixtures.videoHdr720p);

        const builder = new VaapiPipelineBuilder(
          makeHdrVaapiCapabilities(),
          EmptyFfmpegCapabilities,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'tonemap_software.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makeHdrFrameState(),
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

    vaapiTest(
      'tonemap_vaapi preference',
      async ({ binaryCapabilities, ffmpegVersion, resolvedVaapi }) => {
        process.env[TONEMAP_ENABLED] = 'true';

        const video = makeHdrVideoInput(Fixtures.videoHdr720p);
        const audio = makeAudioInput(Fixtures.videoHdr720p);

        // Force only tonemap_vaapi to be available
        const capsWithVaapiTonemap = new FfmpegCapabilities(
          binaryCapabilities.allOptions(),
          binaryCapabilities.allVideoEncoders(),
          new Set([...binaryCapabilities.allFilters(), KnownFfmpegFilters.TonemapVaapi]),
          new Set(),
        );

        const builder = new VaapiPipelineBuilder(
          makeHdrVaapiCapabilities(),
          capsWithVaapiTonemap,
          video,
          audio,
          null,
          null,
          null,
        );

        const outputPath = path.join(workdir, 'tonemap_vaapi.ts');
        const pipeline = builder.build(
          FfmpegState.create({
            duration: testDuration,
            version: ffmpegVersion,
            outputLocation: FileOutputLocation(outputPath, true),
            vaapiDevice: resolvedVaapi.device,
          }),
          makeHdrFrameState(),
          {
            ...DefaultPipelineOptions,
            vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
          },
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
  },
);
