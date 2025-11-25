import { bootstrapTunarr } from '@/bootstrap.js';
import { globalOptions, setGlobalOptions } from '@/globals.js';
import tmp from 'tmp';
import { container } from '../../container.ts';
import { TranscodeConfig } from '../../db/schema/TranscodeConfig.ts';
import { HttpStreamSource } from '../../stream/types.ts';
import { KEYS } from '../../types/inject.ts';
import { FfmpegVersionResult } from '../ffmpegInfo.ts';
import { FfmpegCommandGenerator } from './FfmpegCommandGenerator.ts';
import { AudioStream, StillImageStream, VideoStream } from './MediaStream.ts';
import { VideoFormats } from './constants.ts';
import {
  PixelFormat,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from './format/PixelFormat.ts';
import { AudioInputSource } from './input/AudioInputSource.ts';
import { VideoInputSource } from './input/VideoInputSource.ts';
import { WatermarkInputSource } from './input/WatermarkInputSource.ts';
import { PipelineBuilderFactory } from './pipeline/PipelineBuilderFactory.ts';
import { AudioState } from './state/AudioState.ts';
import { FfmpegState } from './state/FfmpegState.ts';
import { FrameState } from './state/FrameState.ts';
import { FrameSize } from './types.ts';

let dbDir: tmp.DirResult;
beforeAll(async () => {
  // const dir =  path.join(os.tmpdir(),
  dbDir = tmp.dirSync({ unsafeCleanup: true });
  setGlobalOptions({
    // databaseDirectory: dbDir.name,
    database: dbDir.name,
    verbose: 0,
    force_migration: false,
    log_level: 'debug',
  });
  await bootstrapTunarr(globalOptions(), {
    system: {
      logging: {
        logLevel: 'debug',
      },
    },
    settings: {
      ffmpeg: {
        ffmpegExecutablePath: '/usr/local/bin/ffmpeg7',
        ffprobeExecutablePath: '/usr/local/bin/ffprobe7',
      },
    },
  });
});

afterAll(() => {
  // dbDir?.removeCallback();
});

describe('FfmpegCommandGenerator', () => {
  test('args', async () => {
    const pixelFormat: PixelFormat = new PixelFormatYuv420P();

    const videoStream = VideoStream.create({
      index: 0,
      codec: VideoFormats.H264,
      profile: 'main',
      pixelFormat,
      frameSize: FrameSize.create({ width: 640, height: 480 }),
      providedSampleAspectRatio: null,
      displayAspectRatio: '4/3',
    });

    const audioState = AudioState.create({
      audioEncoder: 'ac3',
      audioChannels: 2,
      audioBitrate: 192,
      audioSampleRate: 48,
      audioBufferSize: 50,
      audioDuration: 11_000,
    });

    const target = FrameSize.withDimensions(1280, 720);

    const desiredState = new FrameState({
      scaledSize: videoStream.squarePixelFrameSize(target),
      paddedSize: FrameSize.withDimensions(1280, 720),
      isAnamorphic: false,
      realtime: true,
      videoFormat: VideoFormats.H264,
      frameRate: 20,
      videoBitrate: 30_000,
      deinterlace: true,
      pixelFormat: new PixelFormatYuv420P10Le(),
    });

    const generator = new FfmpegCommandGenerator();

    const videoInputFile = new VideoInputSource(
      new HttpStreamSource('http://fakesource.com/video'),
      [videoStream],
    );

    const audioInputFile = new AudioInputSource(
      videoInputFile.source,
      [AudioStream.create({ index: 1, codec: 'flac', channels: 6 })],
      audioState,
    );

    const watermarkInputFile = new WatermarkInputSource(
      new HttpStreamSource('http://localhost:8000/images/tunarr.png'),
      StillImageStream.create({
        index: 0,
        frameSize: FrameSize.create({ width: 19, height: -1 }),
      }),
      {
        duration: 0,
        enabled: true,
        horizontalMargin: 10,
        verticalMargin: 10,
        position: 'bottom-right',
        width: 19,
        opacity: 1.0,
      },
    );

    const config: TranscodeConfig = {};
    const builder = await container
      .get<PipelineBuilderFactory>(KEYS.PipelineBuilderFactory)(config)
      .setHardwareAccelerationMode('vaapi')
      .setVideoInputSource(videoInputFile)
      .setAudioInputSource(audioInputFile)
      .setWatermarkInputSource(watermarkInputFile)
      .build();

    const pipeline = builder.build(
      FfmpegState.create({
        version: {
          versionString: '7.0.1',
          isUnknown: false,
        } satisfies FfmpegVersionResult,
        vaapiDevice: '/dev/dri/renderD128',
      }),
      desiredState,
    );

    const result = generator.generateArgs(
      videoInputFile,
      audioInputFile,
      watermarkInputFile,
      null,
      pipeline.steps,
    );

    console.log(result.join(' '));
  });
});
