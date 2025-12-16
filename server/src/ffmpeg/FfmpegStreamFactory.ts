import type {
  ISettingsDB,
  ReadableFfmpegSettings,
} from '@/db/interfaces/ISettingsDB.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.js';
import type { AudioStreamDetails } from '@/stream/types.js';
import { FileStreamSource, HttpStreamSource } from '@/stream/types.js';
import type { Maybe, Nullable } from '@/types/util.js';
import { isDefined, isLinux, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { ChannelStreamModes } from '@tunarr/types';
import dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import { isUndefined } from 'lodash-es';
import type { DeepReadonly, NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { numberToBoolean } from '../util/sqliteUtil.ts';
import { FfmpegPlaybackParamsCalculator } from './FfmpegPlaybackParamsCalculator.ts';
import { FfmpegProcess } from './FfmpegProcess.ts';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.ts';
import { SubtitleStreamPicker } from './SubtitleStreamPicker.ts';
import {
  AudioStream,
  EmbeddedSubtitleStream,
  ExternalSubtitleStream,
  StillImageStream,
  SubtitleMethods,
  VideoStream,
} from './builder/MediaStream.ts';
import type { OutputFormat } from './builder/constants.ts';
import { MpegTsOutputFormat, VideoFormats } from './builder/constants.ts';
import type { PixelFormat } from './builder/format/PixelFormat.ts';
import {
  KnownPixelFormats,
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
import { SubtitlesInputSource } from './builder/input/SubtitlesInputSource.ts';
import { VideoInputSource } from './builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from './builder/input/WatermarkInputSource.ts';
import type { PipelineBuilderFactory } from './builder/pipeline/PipelineBuilderFactory.ts';
import { AudioState } from './builder/state/AudioState.ts';
import type { PipelineOptions } from './builder/state/FfmpegState.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from './builder/state/FfmpegState.ts';
import { FrameState } from './builder/state/FrameState.ts';
import { FrameSize } from './builder/types.ts';
import type {
  ConcatOptions,
  HlsWrapperOptions,
  StreamSessionCreateArgs,
} from './ffmpegBase.ts';
import { IFFMPEG } from './ffmpegBase.ts';
import type { FfmpegInfo } from './ffmpegInfo.ts';

export class FfmpegStreamFactory extends IFFMPEG {
  private logger = LoggerFactory.child({ className: FfmpegStreamFactory.name });

  constructor(
    private ffmpegSettings: ReadableFfmpegSettings,
    private transcodeConfig: TranscodeConfig,
    private channel: Channel,
    private ffmpegInfo: FfmpegInfo,
    private settingsDB: ISettingsDB,
    private pipelineBuilderFactory: PipelineBuilderFactory,
    private channelDB: IChannelDB,
  ) {
    super();
  }

  async createConcatSession(
    streamUrl: string,
    opts: DeepReadonly<ConcatOptions>,
  ): Promise<FfmpegTranscodeSession> {
    if (opts.mode === 'hls_concat') {
      return this.createHlsWrapperSession(streamUrl, {
        mode: 'hls_concat',
        outputFormat: opts.outputFormat,
      });
    }

    const concatInput = new ConcatInputSource(
      new HttpStreamSource(streamUrl),
      FrameSize.create({
        height: this.transcodeConfig.resolution.heightPx,
        width: this.transcodeConfig.resolution.widthPx,
      }),
    );

    if (opts.mode === 'hls_slower_concat') {
      return this.createHlsSlowerConcatSession(concatInput, {
        outputFormat: opts.outputFormat,
        mode: 'hls_slower_concat',
      });
    }

    const pipelineBuilder = await this.pipelineBuilderFactory(
      this.transcodeConfig,
    )
      .setConcatInputSource(concatInput)
      .build();

    const pipeline = pipelineBuilder.concat(
      concatInput,
      FfmpegState.forConcat(
        await this.ffmpegInfo.getVersion(),
        this.channel.name,
      ),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        `channel-${this.channel.number}-concat`,
        pipeline.getCommandArgs(),
        this.settingsDB.systemSettings().logging.logsDirectory,
        pipeline.getCommandEnvironment(),
      ),
      dayjs.duration(-1),
      dayjs(-1),
    );
  }

  async createHlsWrapperSession(
    streamUrl: string,
    opts: HlsWrapperOptions,
  ): Promise<FfmpegTranscodeSession> {
    const concatInput = new ConcatInputSource(
      new HttpStreamSource(streamUrl),
      FrameSize.create({
        height: this.transcodeConfig.resolution.heightPx,
        width: this.transcodeConfig.resolution.widthPx,
      }),
    );

    const pipelineBuilder = await this.pipelineBuilderFactory(
      this.transcodeConfig,
    )
      .setConcatInputSource(concatInput)
      .build();

    const pipeline = pipelineBuilder.hlsWrap(
      concatInput,
      FfmpegState.forConcat(
        await this.ffmpegInfo.getVersion(),
        this.channel.name,
        opts.outputFormat,
      ),
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        `channel-${this.channel.number}-concat`,
        pipeline.getCommandArgs(),
        this.settingsDB.systemSettings().logging.logsDirectory,
        pipeline.getCommandEnvironment(),
      ),
      dayjs.duration(-1),
      dayjs(-1),
    );
  }

  private async createHlsSlowerConcatSession(
    concatInput: ConcatInputSource,
    opts: HlsWrapperOptions,
  ): Promise<FfmpegTranscodeSession> {
    const calculator = new FfmpegPlaybackParamsCalculator(
      this.transcodeConfig,
      this.channel.streamMode,
    );
    const playbackParams = calculator.calculateForHlsConcat();

    const videoStream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Raw,
      pixelFormat: new PixelFormatYuv420P(), // Hard-coded right now
      frameSize: FrameSize.fromResolution(this.transcodeConfig.resolution),
      providedSampleAspectRatio: '1:1',
      displayAspectRatio: '1:1',
      inputKind: 'video',
    });

    const videoInputSource = VideoInputSource.withStream(
      concatInput.source,
      videoStream,
    );

    const audioStream = AudioStream.create({
      index: 1,
      codec: '', // Unknown
      channels: this.transcodeConfig.audioChannels,
    });

    const audioInputSource = new AudioInputSource(
      concatInput.source,
      [audioStream],
      AudioState.create({
        audioBitrate: playbackParams.audioBitrate,
        audioBufferSize: playbackParams.audioBufferSize,
        audioChannels: playbackParams.audioChannels,
        audioDuration: null,
        audioEncoder: playbackParams.audioFormat,
        audioSampleRate: playbackParams.audioSampleRate,
        audioVolume: this.transcodeConfig.audioVolumePercent,
      }),
    );

    const pipelineBuilder = await this.pipelineBuilderFactory(
      this.transcodeConfig,
    )
      .setHardwareAccelerationMode(
        this.transcodeConfig.hardwareAccelerationMode,
      )
      .setVideoInputSource(videoInputSource)
      .setAudioInputSource(audioInputSource)
      .setConcatInputSource(concatInput)
      .build();

    const pipeline = pipelineBuilder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        outputFormat: opts.outputFormat ?? MpegTsOutputFormat,
        metadataServiceProvider: 'Tunarr',
        metadataServiceName: this.channel.name,
        ptsOffset: 0,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.getVaapiDriver(),
        mapMetadata: true,
        threadCount: this.transcodeConfig.threadCount,
      }),
      new FrameState({
        realtime: playbackParams.realtime,
        scaledSize: FrameSize.fromResolution(this.transcodeConfig.resolution),
        paddedSize: FrameSize.fromResolution(this.transcodeConfig.resolution),
        isAnamorphic: false,
        deinterlace: false,
        pixelFormat: new PixelFormatYuv420P(),
        frameRate: playbackParams.frameRate,
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        videoFormat: playbackParams.videoFormat,
        // videoPreset: playbackParams.video
      }),
      DefaultPipelineOptions,
    );

    pipeline.inputs.concatInput?.addOptions(
      ...(pipeline.inputs.videoInput?.inputOptions ?? []),
    );

    pipeline.setInputs({
      ...pipeline.inputs,
      videoInput: null,
      audioInput: null,
    });

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        'Concat Wrapper v2 FFmpeg',
        pipeline.getCommandArgs(),
        this.settingsDB.systemSettings().logging.logsDirectory,
        pipeline.getCommandEnvironment(),
      ),
      dayjs.duration(-1),
      dayjs(-1),
    );
  }

  async createStreamSession({
    // TODO Fix these dumb params
    stream: { source: streamSource, details: streamDetails },
    options: {
      ptsOffset,
      startTime,
      outputFormat,
      duration,
      realtime,
      watermark,
      streamMode,
    },
    lineupItem,
  }: StreamSessionCreateArgs): Promise<Maybe<FfmpegTranscodeSession>> {
    if (streamSource.type !== 'http' && streamSource.type !== 'file') {
      throw new Error('Unsupported stream source format: ' + streamSource.type);
    }

    const calculator = new FfmpegPlaybackParamsCalculator(
      this.transcodeConfig,
      streamMode ?? this.channel.streamMode,
    );
    const playbackParams = calculator.calculateForStream(streamDetails);

    // Get inputs
    // Assume we always have a video stream!!!
    let videoStream: VideoStream;
    let videoInputSource: VideoInputSource;
    if (streamDetails.videoDetails) {
      const [videoStreamDetails] = streamDetails.videoDetails;

      const streamIndex = isUndefined(videoStreamDetails.streamIndex)
        ? 0
        : videoStreamDetails.streamIndex;

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

      videoStream = VideoStream.create({
        codec: videoStreamDetails.codec ?? 'unknown',
        profile: videoStreamDetails.profile,
        index: isNaN(streamIndex) ? 0 : streamIndex,
        inputKind: 'video',
        providedSampleAspectRatio: videoStreamDetails.sampleAspectRatio ?? null,
        displayAspectRatio: videoStreamDetails.displayAspectRatio,
        pixelFormat,
        frameSize: FrameSize.create({
          height: videoStreamDetails.height,
          width: videoStreamDetails.width,
        }),
        frameRate: videoStreamDetails.framerate?.toString(),
      });

      videoInputSource = new VideoInputSource(streamSource, [videoStream]);

      this.logger.debug('Video stream input: %O', videoStream);
    } else if (
      streamDetails.placeholderImage &&
      (streamDetails.placeholderImage.type === 'file' ||
        streamDetails.placeholderImage.type === 'http')
    ) {
      // This is sort of hacky...
      videoStream = StillImageStream.create({
        frameSize: FrameSize.create({ height: 0, width: 0 }),
        index: 0,
      });
      videoInputSource = new VideoInputSource(streamDetails.placeholderImage, [
        videoStream,
      ]);
      videoInputSource.addOption(new InfiniteLoopInputOption());
    } else {
      throw new Error('Streams with no video are not currently supported.');
    }

    const audioState = AudioState.create({
      audioEncoder: playbackParams.audioFormat,
      audioChannels: playbackParams.audioChannels,
      audioBitrate: playbackParams.audioBitrate,
      audioBufferSize: playbackParams.audioBufferSize,
      audioSampleRate: playbackParams.audioSampleRate,
      audioVolume: this.transcodeConfig.audioVolumePercent,
      // Check if audio and video are coming from same location
      audioDuration:
        streamMode === 'hls_direct' ? null : duration.asMilliseconds(),
    });

    let audioInput: AudioInputSource;
    if (isDefined(streamDetails.audioDetails)) {
      // Find the best matching audio stream based on language preferences
      const audioStream = this.findBestAudioStream(streamDetails.audioDetails);

      audioInput = new AudioInputSource(
        streamSource,
        [
          AudioStream.create({
            index: audioStream.index,
            codec: audioStream.codec ?? 'unknown',
            channels: audioStream.channels ?? -2,
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
    if (streamMode !== ChannelStreamModes.HlsDirect && watermark?.enabled) {
      const watermarkUrl = watermark.url ?? makeLocalUrl('/images/tunarr.png');
      watermarkSource = new WatermarkInputSource(
        new HttpStreamSource(watermarkUrl),
        StillImageStream.create({
          frameSize: FrameSize.fromResolution({
            widthPx: watermark.width,
            heightPx: -1,
          }),
          index: 0,
        }),
        { ...watermark, url: watermarkUrl },
      );
    }

    let subtitleSource: Nullable<SubtitlesInputSource> = null;
    if (
      isDefined(streamDetails.subtitleDetails) &&
      this.channel.subtitlesEnabled
    ) {
      const subtitlePreferences =
        await this.channelDB.getChannelSubtitlePreferences(this.channel.uuid);
      const pickedSubtitleStream = await SubtitleStreamPicker.pickSubtitles(
        subtitlePreferences,
        lineupItem,
        streamDetails.subtitleDetails,
      );

      if (pickedSubtitleStream) {
        this.logger.trace('Using subtitle stream: %O', pickedSubtitleStream);

        const source = match(pickedSubtitleStream.path)
          .with(
            P.string.startsWith('http'),
            (path) => new HttpStreamSource(path),
          )
          .with(P.string, (path) => new FileStreamSource(path))
          .otherwise(() => streamSource);

        const stream = match(pickedSubtitleStream.type)
          .with(
            'embedded',
            () =>
              new EmbeddedSubtitleStream(
                pickedSubtitleStream.codec,
                pickedSubtitleStream.index ?? 0,
                SubtitleMethods.Burn,
              ),
          )
          .with(
            'external',
            () =>
              new ExternalSubtitleStream(
                pickedSubtitleStream.codec,
                SubtitleMethods.Burn,
              ),
          )
          .otherwise(() => null);

        if (stream) {
          subtitleSource = new SubtitlesInputSource(
            source,
            [stream],
            SubtitleMethods.Burn,
          );
        }
      }
    }

    const builder = await this.pipelineBuilderFactory(this.transcodeConfig)
      .setHardwareAccelerationMode(playbackParams.hwAccel)
      .setVideoInputSource(videoInputSource)
      .setAudioInputSource(audioInput)
      .setWatermarkInputSource(watermarkSource)
      .setSubtitleInputSource(subtitleSource)
      .build();

    const scaledSize = videoStream.squarePixelFrameSize(
      FrameSize.fromResolution(this.transcodeConfig.resolution),
    );

    const paddedSize = FrameSize.fromResolution(
      this.transcodeConfig.resolution,
    );

    const pipelineOptions: PipelineOptions = {
      ...DefaultPipelineOptions,
      decoderThreadCount: this.transcodeConfig.threadCount,
      encoderThreadCount: this.transcodeConfig.threadCount,
      vaapiDevice: this.getVaapiDevice(),
      vaapiDriver: this.getVaapiDriver(),
      disableHardwareDecoding:
        numberToBoolean(this.transcodeConfig.disableHardwareDecoder) ?? false,
      disableHardwareEncoding:
        numberToBoolean(this.transcodeConfig.disableHardwareEncoding) ?? false,
      disableHardwareFilters:
        numberToBoolean(this.transcodeConfig.disableHardwareFilters) ?? false,
    };

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        start: startTime,
        duration,
        ptsOffset,
        threadCount: this.transcodeConfig.threadCount,
        outputFormat,
        softwareDeinterlaceFilter: this.ffmpegSettings.deinterlaceFilter,
        softwareScalingAlgorithm: this.ffmpegSettings.scalingAlgorithm,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.getVaapiDriver(),
        logLevel: this.ffmpegSettings.logLevel,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize,
        paddedSize, // TODO
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        pixelFormat: playbackParams.pixelFormat ?? new PixelFormatYuv420P(), //match(), TODO: Make this customizable...
        bitDepth: 8, // TODO: Make this customizable
        frameRate: playbackParams.frameRate,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        realtime,
        videoFormat: playbackParams.videoFormat,
        videoProfile: null, // 'main', // TODO:
        deinterlace: playbackParams.deinterlace,
        infiniteLoop: lineupItem.infiniteLoop,
      }),
      pipelineOptions,
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        `channel-${this.channel.number}-transcode`,
        pipeline.getCommandArgs(),
        this.settingsDB.systemSettings().logging.logsDirectory,
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
    const calculator = new FfmpegPlaybackParamsCalculator(
      this.transcodeConfig,
      this.channel.streamMode,
    );
    const playbackParams = calculator.calculateForErrorStream(
      outputFormat,
      realtime,
    );

    const frameSize = FrameSize.fromResolution(this.transcodeConfig.resolution);

    let scaledSize: Maybe<FrameSize>;
    let errorInput: VideoInputSource;
    switch (this.transcodeConfig.errorScreen) {
      case 'pic': {
        const stream = StillImageStream.create({
          index: 0,
          frameSize: FrameSize.create({ width: 1920, height: 1080 }),
        });
        scaledSize = stream.squarePixelFrameSize(
          FrameSize.fromResolution(this.transcodeConfig.resolution),
        );
        errorInput = VideoInputSource.withStream(
          new HttpStreamSource(
            makeLocalUrl('/images/generic-error-screen.png'),
          ),
          stream,
        );
        break;
      }
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
      audioVolume: this.transcodeConfig.audioVolumePercent,
      // Check if audio and video are coming from same location
      audioDuration: duration.asMilliseconds(),
    });

    let audioInput: NullAudioInputSource;
    switch (this.transcodeConfig.errorScreenAudio) {
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

    const builder = await this.pipelineBuilderFactory(this.transcodeConfig)
      .setHardwareAccelerationMode(
        this.transcodeConfig.hardwareAccelerationMode,
      )
      .setVideoInputSource(errorInput)
      .setAudioInputSource(audioInput)
      .build();

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        duration,
        ptsOffset,
        threadCount: this.transcodeConfig.threadCount,
        outputFormat,
        softwareDeinterlaceFilter: this.ffmpegSettings.deinterlaceFilter,
        softwareScalingAlgorithm: this.ffmpegSettings.scalingAlgorithm,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.getVaapiDriver(),
        logLevel: this.ffmpegSettings.logLevel,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize:
          scaledSize ??
          FrameSize.fromResolution(this.transcodeConfig.resolution),
        paddedSize: FrameSize.fromResolution(this.transcodeConfig.resolution),
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        pixelFormat: new PixelFormatYuv420P(),
        frameRate: playbackParams.frameRate,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        realtime,
        videoFormat: playbackParams.videoFormat,
        videoProfile: null, // TODO:
        deinterlace: false,
      }),
      DefaultPipelineOptions,
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        `channel-${this.channel.number}-error`,
        pipeline.getCommandArgs(),
        this.settingsDB.systemSettings().logging.logsDirectory,
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
        providedSampleAspectRatio: '1:1',
        displayAspectRatio: '1:1',
        pixelFormat: PixelFormatUnknown(),
      }),
    );

    const calculator = new FfmpegPlaybackParamsCalculator(
      this.transcodeConfig,
      this.channel.streamMode,
    );
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
      audioVolume: this.transcodeConfig.audioVolumePercent,
      // Check if audio and video are coming from same location
      audioDuration: duration.asMilliseconds(),
    });

    let audioInput: NullAudioInputSource;
    switch (this.transcodeConfig.errorScreenAudio) {
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

    const builder = await this.pipelineBuilderFactory(this.transcodeConfig)
      .setHardwareAccelerationMode(
        this.transcodeConfig.hardwareAccelerationMode,
      )
      .setVideoInputSource(offlineInput)
      .setAudioInputSource(audioInput)
      .build();

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        duration,
        ptsOffset,
        threadCount: this.transcodeConfig.threadCount,
        outputFormat,
        // softwareDeinterlaceFilter: this.transcodeConfig.deinterlaceFilter,
        // softwareScalingAlgorithm: this.transcodeConfig.scalingAlgorithm,
        vaapiDevice: this.getVaapiDevice(),
        vaapiDriver: this.getVaapiDriver(),
        logLevel: this.ffmpegSettings.logLevel,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.fromResolution(this.transcodeConfig.resolution),
        paddedSize: FrameSize.fromResolution(this.transcodeConfig.resolution),
        videoBitrate: playbackParams.videoBitrate,
        videoBufferSize: playbackParams.videoBufferSize,
        pixelFormat: new PixelFormatYuv420P(),
        frameRate: playbackParams.frameRate,
        videoTrackTimescale: playbackParams.videoTrackTimeScale,
        realtime,
        videoFormat: playbackParams.videoFormat,
        videoProfile: null, // TODO:
        deinterlace: false,
      }),
      DefaultPipelineOptions,
    );

    return new FfmpegTranscodeSession(
      new FfmpegProcess(
        this.ffmpegSettings,
        `channel-${this.channel.number}-transcode`,
        pipeline.getCommandArgs(),
        this.settingsDB.systemSettings().logging.logsDirectory,
        pipeline.getCommandEnvironment(),
      ),
      duration,
      dayjs().add(duration),
    );
  }

  private getVaapiDevice() {
    return isNonEmptyString(this.transcodeConfig.vaapiDevice)
      ? this.transcodeConfig.vaapiDevice
      : isLinux()
        ? '/dev/dri/renderD128'
        : null;
  }

  private getVaapiDriver() {
    return this.transcodeConfig.vaapiDriver !== 'system'
      ? this.transcodeConfig.vaapiDriver
      : null;
  }

  private findBestAudioStream(
    audioDetails: NonEmptyArray<AudioStreamDetails>,
  ): AudioStreamDetails {
    // First try to find a stream matching our language preferences in order
    for (const pref of this.ffmpegSettings.languagePreferences.preferences) {
      const matchingStream = audioDetails.find((stream) => {
        return (
          stream.languageCodeISO6392?.toLowerCase() === pref.iso6392 ||
          stream.languageCodeISO6391 === pref.iso6391 ||
          stream.language?.toLowerCase() === pref.displayName.toLowerCase()
        );
      });
      if (matchingStream) {
        return matchingStream;
      }
    }

    // If no language match, fallback to default/selected stream
    const fallbackStream =
      audioDetails.find((stream) => stream.selected) ??
      audioDetails.find((stream) => stream.default) ??
      audioDetails[0];
    return fallbackStream;
  }
}
