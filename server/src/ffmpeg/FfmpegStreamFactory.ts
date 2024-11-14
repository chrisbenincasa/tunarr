import { FfmpegSettings } from '@tunarr/types';
import dayjs from 'dayjs';
import { Duration } from 'dayjs/plugin/duration.js';
import { isUndefined } from 'lodash-es';
import { DeepReadonly } from 'ts-essentials';
import { Channel } from '../dao/direct/schema/Channel.ts';
import { HttpStreamSource } from '../stream/types.ts';
import { Maybe, Nullable } from '../types/util.ts';
import { isDefined, isLinux, isNonEmptyString } from '../util/index.ts';
import { makeLocalUrl } from '../util/serverUtil.ts';
import { FfmpegPlaybackParamsCalculator } from './FfmpegPlaybackParamsCalculator.ts';
import { FfmpegProcess } from './FfmpegProcess.ts';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.ts';
import {
  AudioStream,
  StillImageStream,
  VideoStream,
} from './builder/MediaStream.ts';
import { MpegTsOutputFormat, OutputFormat } from './builder/constants.ts';
import {
  KnownPixelFormats,
  PixelFormat,
  PixelFormatUnknown,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from './builder/format/PixelFormat.ts';
import {
  AudioInputFilterSource,
  AudioInputSource,
  NullAudioInputSource,
} from './builder/input/AudioInputSource.ts';
import { ConcatInputSource } from './builder/input/ConcatInputSource.ts';
import { LavfiVideoInputSource } from './builder/input/LavfiVideoInputSource.ts';
import { VideoInputSource } from './builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from './builder/input/WatermarkInputSource.ts';
import { PipelineBuilderFactory } from './builder/pipeline/PipelineBuilderFactory.ts';
import { AudioState } from './builder/state/AudioState.ts';
import { FfmpegState } from './builder/state/FfmpegState.ts';
import { FrameState } from './builder/state/FrameState.ts';
import { FrameSize } from './builder/types.ts';
import { ConcatOptions, StreamSessionOptions } from './ffmpeg.ts';
import { IFFMPEG } from './ffmpegBase.ts';
import { FFMPEGInfo } from './ffmpegInfo.ts';

export class FfmpegStreamFactory extends IFFMPEG {
  private ffmpegInfo: FFMPEGInfo;
  private pipelineBuilderFactory: PipelineBuilderFactory;

  constructor(
    private ffmpegSettings: DeepReadonly<FfmpegSettings>,
    private channel: Channel,
  ) {
    super();
    this.ffmpegInfo = new FFMPEGInfo(ffmpegSettings);
    this.pipelineBuilderFactory = new PipelineBuilderFactory();
  }

  async createConcatSession(
    streamUrl: string,
    opts: DeepReadonly<Partial<ConcatOptions>>,
  ): Promise<FfmpegTranscodeSession> {
    const concatInput = new ConcatInputSource(
      new HttpStreamSource(streamUrl),
      FrameSize.create({
        height: this.ffmpegSettings.targetResolution.heightPx,
        width: this.ffmpegSettings.targetResolution.widthPx,
      }),
    );
    const pipelineBuilder = await this.pipelineBuilderFactory
      .builder(this.ffmpegSettings)
      .setConcatInputSource(concatInput)
      .build();

    const calculator = new FfmpegPlaybackParamsCalculator(this.ffmpegSettings);

    const pipeline = pipelineBuilder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        outputFormat: opts.outputFormat ?? MpegTsOutputFormat,
        metadataServiceProvider: 'Tunarr',
        metadataServiceName: this.channel.name,
        ptsOffset: 0,
      }),
      new FrameState({
        ...calculator.calculateForHlsConcat(),
        scaledSize: FrameSize.fromResolution(
          this.ffmpegSettings.targetResolution,
        ),
        paddedSize: FrameSize.fromResolution(
          this.ffmpegSettings.targetResolution,
        ),
        isAnamorphic: false,
      }),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        'Concat Wrapper v2 FFmpeg',
        pipeline.getCommandArgs(),
        pipeline.getCommandEnvironment(),
      ),
      dayjs.duration(-1),
      dayjs(-1),
    );
  }

  async createWrapperConcatSession(
    streamUrl: string,
  ): Promise<FfmpegTranscodeSession> {
    const concatInput = new ConcatInputSource(
      new HttpStreamSource(streamUrl),
      FrameSize.create({
        height: this.ffmpegSettings.targetResolution.heightPx,
        width: this.ffmpegSettings.targetResolution.widthPx,
      }),
    );

    const pipelineBuilder = await this.pipelineBuilderFactory
      .builder(this.ffmpegSettings)
      .setConcatInputSource(concatInput)
      .build();

    const pipeline = pipelineBuilder.hlsConcat(
      concatInput,
      FfmpegState.forConcat(
        await this.ffmpegInfo.getVersion(),
        this.channel.name,
      ),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        'Concat Wrapper v2 FFmpeg',
        pipeline.getCommandArgs(),
        pipeline.getCommandEnvironment(),
      ),
      dayjs.duration(-1),
      dayjs(-1),
    );
  }

  async createStreamSession({
    // TODO Fix these dumb params
    streamSource,
    streamDetails,
    ptsOffset,
    startTime,
    outputFormat,
    duration,
    realtime,
    watermark,
  }: StreamSessionOptions): Promise<Maybe<FfmpegTranscodeSession>> {
    if (streamSource.type !== 'http' && streamSource.type !== 'file') {
      throw new Error('');
    }

    const calculator = new FfmpegPlaybackParamsCalculator(this.ffmpegSettings);
    const playbackParams = calculator.calculateForStream(streamDetails);

    // Get inputs
    // Assume we always have a video stream!!!
    if (isUndefined(streamDetails.videoDetails)) {
      throw new Error('no video streams!!');
    }
    const [videoStreamDetails] = streamDetails.videoDetails;

    const streamIndex = isNonEmptyString(videoStreamDetails.streamIndex)
      ? parseInt(videoStreamDetails.streamIndex)
      : 0;

    let pixelFormat: Maybe<PixelFormat>;
    if (videoStreamDetails.pixelFormat) {
      pixelFormat = KnownPixelFormats.forPixelFormat(
        videoStreamDetails.pixelFormat,
      );
    }

    if (isUndefined(pixelFormat)) {
      switch (videoStreamDetails.bitDepth) {
        case 8: {
          pixelFormat = new PixelFormatYuv420P();
          break;
        }
        case 10: {
          pixelFormat = new PixelFormatYuv420P10Le();
          break;
        }
        default:
          pixelFormat = PixelFormatUnknown(videoStreamDetails.bitDepth);
      }
    }

    const videoStream = VideoStream.create({
      codec: videoStreamDetails.codec ?? 'unknown',
      profile: videoStreamDetails.profile,
      index: isNaN(streamIndex) ? 0 : streamIndex,
      isAnamorphic: videoStreamDetails.anamorphic ?? false,
      inputKind: 'video',
      pixelAspectRatio: null,
      pixelFormat,
      frameSize: FrameSize.create({
        height: videoStreamDetails.height,
        width: videoStreamDetails.width,
      }),
      frameRate: videoStreamDetails.framerate?.toString(),
    });

    const videoInput = new VideoInputSource(streamSource, [videoStream]);

    const audioState = AudioState.create({
      audioEncoder: playbackParams.audioFormat,
      audioChannels: playbackParams.audioChannels,
      audioBitrate: playbackParams.audioBitrate,
      audioBufferSize: playbackParams.audioBufferSize,
      audioSampleRate: playbackParams.audioSampleRate,
      audioVolume: this.ffmpegSettings.audioVolumePercent,
      // Check if audio and video are coming from same location
      audioDuration: duration.asMilliseconds(),
    });

    let audioInput: AudioInputSource;
    if (isDefined(streamDetails.audioDetails)) {
      // Just pick the first one for now..
      const [audioStream] = streamDetails.audioDetails;
      const audioStreamIndex = isNonEmptyString(audioStream.index)
        ? parseInt(audioStream.index)
        : 1;

      audioInput = new AudioInputSource(
        streamSource,
        [
          AudioStream.create({
            index: isNaN(audioStreamIndex) ? 1 : audioStreamIndex,
            codec: audioStream.codec ?? 'unknown',
            channels: playbackParams.audioChannels ?? -2,
          }),
        ],
        audioState,
      );
    } else {
      audioInput = new NullAudioInputSource({
        ...audioState,
        audioDuration: duration.asMilliseconds(),
      });
    }

    let watermarkSource: Nullable<WatermarkInputSource> = null;
    if (watermark && isNonEmptyString(watermark.url)) {
      watermarkSource = new WatermarkInputSource(
        new HttpStreamSource(watermark.url),
        StillImageStream.create({
          frameSize: FrameSize.fromResolution({
            widthPx: watermark.width,
            heightPx: -1,
          }),
          index: 0,
        }),
        watermark,
      );
    }

    const builder = await new PipelineBuilderFactory()
      .builder()
      .setHardwareAccelerationMode(this.ffmpegSettings.hardwareAccelerationMode)
      .setVideoInputSource(videoInput)
      .setAudioInputSource(audioInput)
      .setWatermarkInputSource(watermarkSource)
      .build();

    const scaledSize = videoStream.squarePixelFrameSize(
      FrameSize.fromResolution(this.ffmpegSettings.targetResolution),
    );

    const paddedSize = FrameSize.fromResolution(
      this.ffmpegSettings.targetResolution,
    );

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        start: startTime.asSeconds(),
        duration: duration.asMilliseconds(),
        ptsOffset,
        threadCount: this.ffmpegSettings.numThreads,
        outputFormat,
        softwareDeinterlaceFilter: this.ffmpegSettings.deinterlaceFilter,
        softwareScalingAlgorithm: this.ffmpegSettings.scalingAlgorithm,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.ffmpegSettings.vaapiDriver,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize,
        paddedSize, // TODO
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        pixelFormat: playbackParams.pixelFormat, //match(), TODO: Make this customizable...
        bitDepth: 8, // TODO: Make this customizable
        frameRate: playbackParams.frameRate,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        realtime,
        videoFormat: playbackParams.videoFormat,
        videoProfile: null, // 'main', // TODO:
        deinterlaced: playbackParams.deinterlace,
      }),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        'Test',
        pipeline.getCommandArgs(),
        pipeline.getCommandEnvironment(),
      ),
      duration,
      dayjs().add(duration),
    );
  }

  async createErrorSession(
    title: string,
    subtitle: Maybe<string>,
    duration: Duration,
    outputFormat: OutputFormat,
    realtime: boolean,
    ptsOffset?: number,
  ): Promise<Maybe<FfmpegTranscodeSession>> {
    const calculator = new FfmpegPlaybackParamsCalculator(this.ffmpegSettings);
    const playbackParams = calculator.calculateForErrorStream(
      outputFormat,
      realtime,
    );

    const frameSize = FrameSize.fromResolution(
      this.ffmpegSettings.targetResolution,
    );

    let errorInput: VideoInputSource;
    switch (this.ffmpegSettings.errorScreen) {
      case 'pic':
        errorInput = VideoInputSource.withStream(
          new HttpStreamSource(
            makeLocalUrl('/images/generic-error-screen.png'),
          ),
          VideoStream.create({
            inputKind: 'stillimage',
            codec: 'unknown',
            frameSize: FrameSize.create({ width: 1920, height: 1080 }),
            index: 0,
            isAnamorphic: false,
            pixelAspectRatio: null,
            pixelFormat: PixelFormatUnknown(),
          }),
        );
        break;
      case 'blank':
        throw new Error('');
      case 'testsrc':
        errorInput = LavfiVideoInputSource.testSource(frameSize);
        break;
      case 'static':
        errorInput = LavfiVideoInputSource.createStatic();
        break;
      case 'text':
        errorInput = LavfiVideoInputSource.errorText(
          frameSize,
          title,
          subtitle,
        );
        break;
      case 'kill':
        process.kill(process.pid, 'SIGTERM');
        return;
    }

    const audioState = AudioState.create({
      audioEncoder: playbackParams.audioFormat,
      audioChannels: playbackParams.audioChannels,
      audioBitrate: playbackParams.audioBitrate,
      audioBufferSize: playbackParams.audioBufferSize,
      audioSampleRate: playbackParams.audioSampleRate,
      audioVolume: this.ffmpegSettings.audioVolumePercent,
      // Check if audio and video are coming from same location
      audioDuration: duration.asMilliseconds(),
    });

    let audioInput: NullAudioInputSource;
    switch (this.ffmpegSettings.errorAudio) {
      case 'silent':
        audioInput = new NullAudioInputSource(audioState);
        break;
      case 'sine':
        audioInput = AudioInputFilterSource.sine(audioState);
        break;
      case 'whitenoise':
        audioInput = AudioInputFilterSource.noise(audioState);
        break;
    }

    const builder = await new PipelineBuilderFactory()
      .builder()
      .setHardwareAccelerationMode(this.ffmpegSettings.hardwareAccelerationMode)
      .setVideoInputSource(errorInput)
      .setAudioInputSource(audioInput)
      .build();

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        duration: duration.asMilliseconds(),
        ptsOffset,
        threadCount: this.ffmpegSettings.numThreads,
        outputFormat,
        softwareDeinterlaceFilter: this.ffmpegSettings.deinterlaceFilter,
        softwareScalingAlgorithm: this.ffmpegSettings.scalingAlgorithm,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.ffmpegSettings.vaapiDriver,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.fromResolution(
          this.ffmpegSettings.targetResolution,
        ),
        paddedSize: FrameSize.fromResolution(
          this.ffmpegSettings.targetResolution,
        ),
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        pixelFormat: new PixelFormatYuv420P(),
        frameRate: playbackParams.frameRate,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        realtime,
        videoFormat: playbackParams.videoFormat,
        videoProfile: null, // TODO:
        deinterlaced: false,
      }),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        'Error',
        pipeline.getCommandArgs(),
        pipeline.getCommandEnvironment(),
      ),
      duration,
      dayjs().add(duration),
    );
  }

  async createOfflineSession(
    duration: Duration,
    outputFormat: OutputFormat,
    ptsOffset: number = 0,
    realtime: boolean = true,
  ): Promise<Maybe<FfmpegTranscodeSession>> {
    const offlineInput = VideoInputSource.withStream(
      new HttpStreamSource(
        isNonEmptyString(this.channel.offline?.picture)
          ? this.channel.offline?.picture
          : makeLocalUrl('/images/generic-offline-screen.png'),
      ),
      VideoStream.create({
        inputKind: 'stillimage',
        codec: 'unknown',
        frameSize: FrameSize.create({ width: 1920, height: 1080 }),
        index: 0,
        isAnamorphic: false,
        pixelAspectRatio: null,
        pixelFormat: PixelFormatUnknown(),
      }),
    );

    const calculator = new FfmpegPlaybackParamsCalculator(this.ffmpegSettings);
    const playbackParams = calculator.calculateForErrorStream(
      outputFormat,
      true,
    );

    const audioState = AudioState.create({
      audioEncoder: playbackParams.audioFormat,
      audioChannels: playbackParams.audioChannels,
      audioBitrate: playbackParams.audioBitrate,
      audioBufferSize: playbackParams.audioBufferSize,
      audioSampleRate: playbackParams.audioSampleRate,
      audioVolume: this.ffmpegSettings.audioVolumePercent,
      // Check if audio and video are coming from same location
      audioDuration: duration.asMilliseconds(),
    });

    let audioInput: NullAudioInputSource;
    switch (this.ffmpegSettings.errorAudio) {
      case 'silent':
        audioInput = new NullAudioInputSource(audioState);
        break;
      case 'sine':
        audioInput = AudioInputFilterSource.sine(audioState);
        break;
      case 'whitenoise':
        audioInput = AudioInputFilterSource.noise(audioState);
        break;
    }

    const builder = await new PipelineBuilderFactory()
      .builder()
      .setHardwareAccelerationMode(this.ffmpegSettings.hardwareAccelerationMode)
      .setVideoInputSource(offlineInput)
      .setAudioInputSource(audioInput)
      .build();

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        duration: duration.asMilliseconds(),
        ptsOffset,
        threadCount: this.ffmpegSettings.numThreads,
        outputFormat,
        softwareDeinterlaceFilter: this.ffmpegSettings.deinterlaceFilter,
        softwareScalingAlgorithm: this.ffmpegSettings.scalingAlgorithm,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.ffmpegSettings.vaapiDriver,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.fromResolution(
          this.ffmpegSettings.targetResolution,
        ),
        paddedSize: FrameSize.fromResolution(
          this.ffmpegSettings.targetResolution,
        ),
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        pixelFormat: new PixelFormatYuv420P(),
        frameRate: playbackParams.frameRate,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        realtime,
        videoFormat: playbackParams.videoFormat,
        videoProfile: null, // TODO:
        deinterlaced: false,
      }),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        'Offline',
        pipeline.getCommandArgs(),
        pipeline.getCommandEnvironment(),
      ),
      duration,
      dayjs().add(duration),
    );
  }

  private getVaapiDevice() {
    return isNonEmptyString(this.ffmpegSettings.vaapiDevice)
      ? this.ffmpegSettings.vaapiDevice
      : isLinux()
      ? '/dev/dri/renderD128'
      : undefined;
  }
}
