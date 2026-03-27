import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStreamSource } from '../../../../stream/types.ts';
import {
  createTempWorkdir,
  probeFile,
  runFfmpegWithPipeline,
} from '../../../../testing/ffmpeg/FfmpegIntegrationHelper.ts';
import {
  binaries,
  vaapiInfo,
  vaapiTest,
} from '../../../../testing/ffmpeg/FfmpegTestFixtures.ts';
import { AudioFormats, FileOutputLocation } from '../../constants.ts';
import { PixelFormatYuv420P } from '../../format/PixelFormat.ts';
import { AudioInputSource } from '../../input/AudioInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { AudioStream, VideoStream } from '../../MediaStream.ts';
import { AudioState } from '../../state/AudioState.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { VaapiPipelineBuilder } from './VaapiPipelineBuilder.ts';

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../testing/ffmpeg/fixtures',
);

const Fixtures = {
  video720p: path.join(fixturesDir, '720p_h264.ts'),
  video1080p: path.join(fixturesDir, '1080p_h264.ts'),
} as const;

describe.skipIf(!binaries || !vaapiInfo)(
  'VaapiPipelineBuilder integration',
  () => {
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
          profile: 'high',
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
        });

        const outputPath = path.join(workdir, 'vaapi_transcode.ts');
        const pipeline = builder.build(
          FfmpegState.create({
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
        });

        const outputPath = path.join(workdir, 'vaapi_scale.ts');
        const pipeline = builder.build(
          FfmpegState.create({
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
