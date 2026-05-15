import type {
  ISettingsDB,
  ReadableFfmpegSettings,
} from '@/db/interfaces/ISettingsDB.js';
import type { ChannelOrm } from '@/db/schema/Channel.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.js';
import type {
  AudioRenditionInfo,
  StreamRenditions,
  SubtitleRenditionInfo,
} from '@/stream/types.js';
import { FileStreamSource, HttpStreamSource } from '@/stream/types.js';
import type { Maybe, Nullable } from '@/types/util.js';
import { isDefined, isLinux, isNonEmptyString } from '@/util/index.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { ChannelStreamModes } from '@tunarr/types';
import dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import { injectable } from 'inversify';
import { isUndefined } from 'lodash-es';
import type { DeepReadonly } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { FeatureFlagService } from '../services/FeatureFlagService.ts';
import { isImageBasedSubtitle } from '../stream/util.ts';
import { KEYS } from '../types/inject.ts';
import { assisted, injected } from '../util/assistedInject.ts';
import { InjectLogger } from '../util/inject.ts';
import { loggingDef } from '../util/logging/loggingDef.ts';
import { FfmpegPlaybackParamsCalculator } from './FfmpegPlaybackParamsCalculator.ts';
import { FfmpegProcess } from './FfmpegProcess.ts';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.ts';
import { StreamSelector } from './StreamSelector.ts';
import {
  AudioStream,
  EmbeddedSubtitleStream,
  ExternalSubtitleStream,
  StillImageStream,
  SubtitleMethods,
  VideoStream,
} from './builder/MediaStream.ts';
import type { OutputFormat } from './builder/constants.ts';
import {
  AudioFormats,
  MpegTsOutputFormat,
  OutputFormatTypes,
  VideoFormats,
} from './builder/constants.ts';
import { ColorFormat } from './builder/format/ColorFormat.ts';
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
import type {
  AudioCodecOverride,
  PipelineOptions,
} from './builder/state/FfmpegState.ts';
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
  TranscodeSessionResult,
} from './ffmpegBase.ts';
import { IFFMPEG } from './ffmpegBase.ts';
import { FfmpegInfo } from './ffmpegInfo.ts';

@injectable()
@loggingDef({ category: 'streaming' })
export class FfmpegStreamFactory extends IFFMPEG {
  @InjectLogger() declare private readonly logger: Logger;

  private readonly ffmpegSettings: ReadableFfmpegSettings;

  constructor(
    @injected(FfmpegInfo) private ffmpegInfo: FfmpegInfo,
    @injected(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @injected(KEYS.PipelineBuilderFactory)
    private pipelineBuilderFactory: PipelineBuilderFactory,
    @injected(FeatureFlagService)
    private featureFlagService: FeatureFlagService,
    @injected(StreamSelector) private streamSelector: StreamSelector,
    @assisted private transcodeConfig: TranscodeConfigOrm,
    @assisted private channel: ChannelOrm,
  ) {
    super();
    this.ffmpegSettings = this.settingsDB.ffmpegSettings();
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
      colorFormat: ColorFormat.bt709,
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
      encoding,
      isFirstTranscode,
      emitEndList,
    },
    lineupItem,
  }: StreamSessionCreateArgs): Promise<Maybe<TranscodeSessionResult>> {
    if (streamSource.type !== 'http' && streamSource.type !== 'file') {
      throw new Error('Unsupported stream source format: ' + streamSource.type);
    }

    const isRemux = encoding?.mode === 'remux';
    // Passthrough mode: copy all video/audio streams from the source without
    // re-encoding. Incompatible audio codecs get per-stream overrides.
    // Subtitles are still processed as WebVTT sidecar when available.
    const isPassthrough =
      isRemux || outputFormat.type === OutputFormatTypes.HlsDirectV2;
    const playbackParams = isPassthrough
      ? null
      : new FfmpegPlaybackParamsCalculator(
          this.transcodeConfig,
          streamMode ?? this.channel.streamMode,
        ).calculateForStream(streamDetails);

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
        colorFormat: new ColorFormat({
          colorRange: videoStreamDetails.colorRange ?? null,
          colorSpace: videoStreamDetails.colorSpace ?? null,
          colorTransfer: videoStreamDetails.colorTransfer ?? null,
          colorPrimaries: videoStreamDetails.colorPrimaries ?? null,
        }),
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

    // In copy-all mode, audio is handled by `-map 0:a` with per-stream codec
    // overrides — no AudioInputSource needed. Watermark is also skipped since
    // we're not re-encoding video.
    let audioInput: Nullable<AudioInputSource> = null;
    let watermarkSource: Nullable<WatermarkInputSource> = null;
    let subtitleSource: Nullable<SubtitlesInputSource> = null;
    let subtitleRendition: SubtitleRenditionInfo | undefined;

    if (!isPassthrough) {
      const audioState = AudioState.create({
        audioEncoder: playbackParams!.audioFormat,
        audioChannels: playbackParams!.audioChannels,
        audioBitrate: playbackParams!.audioBitrate,
        audioBufferSize: playbackParams!.audioBufferSize,
        audioSampleRate: playbackParams!.audioSampleRate,
        audioVolume: this.transcodeConfig.audioVolumePercent,
        audioDuration:
          streamMode === ChannelStreamModes.HlsDirect
            ? null
            : duration.asMilliseconds(),
        loudnormConfig: this.transcodeConfig.audioLoudnormConfig,
      });

      // Stream selection via profiles (handles both audio and subtitles)

      if (isDefined(streamDetails.audioDetails)) {
        const { audioStream, subtitleStream } =
          await this.streamSelector.selectAudioAndSubtitleStreams({
            channel: this.channel,
            lineupItem,
            audioStreams: streamDetails.audioDetails,
            subtitleStreams: streamDetails.subtitleDetails ?? [],
            hints: { preferTextBased: true },
          });

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

        if (subtitleStream) {
          this.logger.trace('Using subtitle stream: %O', subtitleStream);

          const source = match(subtitleStream.path)
            .with(
              P.string.startsWith('http'),
              (path) => new HttpStreamSource(path),
            )
            .with(P.string, (path) => new FileStreamSource(path))
            .otherwise(() => streamSource);

          const stream = match(subtitleStream.type)
            .with(
              'embedded',
              () =>
                new EmbeddedSubtitleStream(
                  subtitleStream.codec,
                  subtitleStream.index ?? 0,
                  SubtitleMethods.Burn,
                ),
            )
            .with(
              'external',
              () =>
                new ExternalSubtitleStream(
                  subtitleStream.codec,
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
      } else {
        audioInput = new NullAudioInputSource({
          ...audioState,
          audioDuration: duration.asMilliseconds(),
        });
      }

      if (watermark?.enabled) {
        const watermarkUrl =
          watermark.url ?? makeLocalUrl('/images/tunarr.png');
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
    } else {
      // Passthrough: subtitle processing via sidecar. In copy-all mode, only
      // sidecar (Convert) is available since we're not re-encoding video for
      // burn-in.
      if (
        isDefined(streamDetails.audioDetails) &&
        isDefined(streamDetails.subtitleDetails)
      ) {
        const sidecarEnabled = this.featureFlagService.get(
          'webvttSidecarEnabled',
        );

        const { subtitleStream: pickedSubtitleStream } =
          await this.streamSelector.selectAudioAndSubtitleStreams({
            channel: this.channel,
            lineupItem,
            audioStreams: streamDetails.audioDetails,
            subtitleStreams: streamDetails.subtitleDetails,
            hints: sidecarEnabled ? { preferTextBased: true } : undefined,
          });

        if (pickedSubtitleStream) {
          this.logger.trace('Using subtitle stream: %O', pickedSubtitleStream);

          // In copy-all mode, force Convert (sidecar) since burn-in is
          // not possible without re-encoding. For image-based subtitles
          // that can't be converted to WebVTT, skip them entirely.
          const canUseSidecar = !isImageBasedSubtitle(
            pickedSubtitleStream.codec,
          );
          const useSidecar = isPassthrough || (sidecarEnabled && canUseSidecar);
          const method = useSidecar
            ? SubtitleMethods.Convert
            : SubtitleMethods.Burn;

          // Skip image-based subtitles in copy-all mode since they can't
          // be burned in or converted to WebVTT.
          if (!isPassthrough || canUseSidecar) {
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
                    method,
                  ),
              )
              .with(
                'external',
                () =>
                  new ExternalSubtitleStream(
                    pickedSubtitleStream.codec,
                    method,
                  ),
              )
              .otherwise(() => null);

            if (stream) {
              subtitleSource = new SubtitlesInputSource(
                source,
                [stream],
                method,
              );

              if (useSidecar) {
                subtitleRendition = {
                  language: pickedSubtitleStream.languageCodeISO6392 ?? 'und',
                  languageName: pickedSubtitleStream.language,
                  default: pickedSubtitleStream.default,
                  forced: pickedSubtitleStream.forced,
                  title: pickedSubtitleStream.title,
                };
              }
            }
          }
        }
      }
    }

    // For copy-all, use the source video's actual dimensions so no scaling or
    // padding filters are injected. For normal transcode, use the transcode
    // config's target resolution.
    const sourceFrameSize =
      isPassthrough && streamDetails.videoDetails
        ? FrameSize.create({
            height: streamDetails.videoDetails[0].height,
            width: streamDetails.videoDetails[0].width,
          })
        : null;

    const scaledSize =
      sourceFrameSize ??
      videoStream.squarePixelFrameSize(
        FrameSize.fromResolution(this.transcodeConfig.resolution),
      );

    const paddedSize =
      sourceFrameSize ??
      FrameSize.fromResolution(this.transcodeConfig.resolution);

    // Build per-stream audio codec overrides for copy-all mode.
    // DTS and TrueHD cannot be muxed into MPEG-TS and are unsupported
    // by AVPlayer on Apple devices — transcode those to AC-3.
    const audioCodecOverrides: AudioCodecOverride[] = [];
    if (isPassthrough && streamDetails.audioDetails) {
      for (let i = 0; i < streamDetails.audioDetails.length; i++) {
        const codec = streamDetails.audioDetails[i]!.codec;
        if (codec === AudioFormats.Dca || codec === AudioFormats.TrueHd) {
          audioCodecOverrides.push({
            outputIndex: i,
            codec: AudioFormats.Ac3,
          });
        }
      }
    }

    const effectiveHwAccel = isPassthrough
      ? HardwareAccelerationMode.None
      : playbackParams!.hwAccel;

    const builder = await this.pipelineBuilderFactory(this.transcodeConfig)
      .setHardwareAccelerationMode(effectiveHwAccel)
      .setVideoInputSource(videoInputSource)
      .setAudioInputSource(audioInput)
      .setWatermarkInputSource(watermarkSource)
      .setSubtitleInputSource(subtitleSource)
      .build();

    const pipelineOptions: PipelineOptions = isPassthrough
      ? DefaultPipelineOptions
      : {
          ...DefaultPipelineOptions,
          decoderThreadCount: this.transcodeConfig.threadCount,
          encoderThreadCount: this.transcodeConfig.threadCount,
          vaapiDevice: this.getVaapiDevice(),
          vaapiDriver: this.getVaapiDriver(),
          disableHardwareDecoding:
            this.transcodeConfig.disableHardwareDecoder ?? false,
          disableHardwareEncoding:
            this.transcodeConfig.disableHardwareEncoding ?? false,
          disableHardwareFilters:
            this.transcodeConfig.disableHardwareFilters ?? false,
        };

    const pipeline = builder.build(
      FfmpegState.create({
        version: await this.ffmpegInfo.getVersion(),
        start: startTime,
        duration,
        ptsOffset,
        isFirstTranscode,
        emitEndList: emitEndList ?? false,
        threadCount: isPassthrough ? 0 : this.transcodeConfig.threadCount,
        copyAllStreams: isPassthrough,
        audioCodecOverrides,
        outputFormat,
        softwareDeinterlaceFilter: isPassthrough
          ? undefined
          : this.ffmpegSettings.deinterlaceFilter,
        softwareScalingAlgorithm: isPassthrough
          ? undefined
          : this.ffmpegSettings.scalingAlgorithm,
        vaapiDevice: isPassthrough ? null : this.getVaapiDevice(),
        vaapiDriver: isPassthrough ? null : this.getVaapiDriver(),
        logLevel: this.ffmpegSettings.logLevel,
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize,
        paddedSize,
        videoBitrate: isPassthrough ? undefined : playbackParams!.videoBitrate,
        videoBufferSize: isPassthrough
          ? undefined
          : playbackParams!.videoBufferSize,
        pixelFormat: isPassthrough
          ? new PixelFormatYuv420P()
          : (playbackParams!.pixelFormat ?? new PixelFormatYuv420P()),
        bitDepth: 8,
        frameRate: isPassthrough ? undefined : playbackParams!.frameRate,
        videoTrackTimescale: isPassthrough
          ? 90000
          : playbackParams!.videoTrackTimeScale,
        realtime,
        videoFormat: isPassthrough
          ? VideoFormats.Copy
          : playbackParams!.videoFormat,
        videoProfile: null,
        deinterlace: isPassthrough ? false : playbackParams!.deinterlace,
        infiniteLoop: lineupItem.infiniteLoop,
      }),
      pipelineOptions,
    );

    const transcodeSession = new FfmpegTranscodeSession(
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

    // Build audio rendition metadata from the source audio streams.
    const audioRenditions: AudioRenditionInfo[] = [];
    if (streamDetails.audioDetails) {
      for (let i = 0; i < streamDetails.audioDetails.length; i++) {
        const audio = streamDetails.audioDetails[i]!;
        audioRenditions.push({
          language: audio.languageCodeISO6392 ?? audio.language ?? 'und',
          languageName: audio.language,
          title: audio.title,
          channels: audio.channels,
          default: i === 0 || (audio.default ?? false),
        });
      }
    }

    const renditions: StreamRenditions = {
      audio: audioRenditions,
      subtitle: subtitleRendition,
    };

    return { session: transcodeSession, renditions };
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
        colorFormat: ColorFormat.unknown,
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
}
