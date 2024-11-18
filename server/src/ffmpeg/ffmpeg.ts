import {
  ChannelStreamMode,
  FfmpegSettings,
  Resolution,
  Watermark,
} from '@tunarr/types';
import {
  SupportedHardwareAccels,
  SupportedVideoFormats,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { Duration } from 'dayjs/plugin/duration.js';
import { first, isEmpty, isNil, isUndefined, merge, round } from 'lodash-es';
import path from 'path';
import { DeepReadonly, DeepRequired } from 'ts-essentials';
import { Channel } from '../db/schema/Channel.ts';
import { serverOptions } from '../globals.js';
import { ConcatSessionType } from '../stream/Session.js';
import {
  ErrorStreamSource,
  OfflineStreamSource,
  StreamDetails,
  StreamSource,
  getPixelFormatForStream,
} from '../stream/types.js';
import { Maybe, Nullable } from '../types/util.js';
import {
  isDefined,
  isLinux,
  isNonEmptyString,
  isSuccess,
} from '../util/index.js';
import { gcd } from '../util/index.ts';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../util/serverUtil.js';
import { getTunarrVersion } from '../util/version.js';
import { FfmpegProcess } from './FfmpegProcess.js';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.js';
import {
  MpegTsOutputFormat,
  NutOutputFormat,
  OutputFormat,
} from './builder/constants.ts';
import { IFFMPEG } from './ffmpegBase.ts';
import { FFMPEGInfo } from './ffmpegInfo.js';

const MAXIMUM_ERROR_DURATION_MS = 60000;

export type HlsOptions = {
  hlsTime: number; // Duration of each clip in seconds,
  hlsListSize: number; // Number of clips to have in the list
  hlsDeleteThreshold: number;
  streamBasePath: string;
  streamBaseUrl: string;
  segmentNameFormat: string;
  streamNameFormat: string;
  deleteThreshold: Nullable<number>;
  appendSegments: boolean;
};

export type MpegDashOptions = {
  windowSize: number; // number of segments kept in the manifest
  segmentDuration: number; // segment duration in secodns
  segmentType: 'auto' | 'mp4' | 'webm';
  fragType: 'auto' | 'every_frame' | 'duration' | 'pframes';
};

export type ConcatOptions = {
  // direct = ffmpeg process requests an ffconcat playlist from localhost
  //
  // hls = starts an underlying HLS session. The concat process takes
  // the HLS m3u playlist as input and stitches the generated mpeg-ts
  // files back together into a continuous stream
  mode: ConcatSessionType;
  // enableHls: boolean;
  // enableDash: boolean;
  outputFormat: OutputFormat;
  numThreads: number;
  // hlsOptions?: Partial<HlsOptions>;
  // dashOptions?: Partial<MpegDashOptions>;
  logOutput: boolean;
};

export const defaultHlsOptions: DeepRequired<HlsOptions> = {
  hlsTime: 2,
  hlsListSize: 3,
  hlsDeleteThreshold: 3,
  streamBasePath: 'stream_%v',
  segmentNameFormat: 'data%05d.ts',
  streamNameFormat: 'stream.m3u8',
  streamBaseUrl: 'hls/',
  deleteThreshold: 3,
  appendSegments: false,
};

export const defaultMpegDashOptions: DeepRequired<MpegDashOptions> = {
  segmentDuration: 2,
  windowSize: 3,
  segmentType: 'auto',
  fragType: 'auto',
};

export const defaultConcatOptions: DeepRequired<ConcatOptions> = {
  mode: 'hls_concat',
  numThreads: 2,
  outputFormat: MpegTsOutputFormat,
  logOutput: false,
};

const hardwareAccelToEncoder: Record<
  SupportedHardwareAccels,
  Record<SupportedVideoFormats, string>
> = {
  none: {
    h264: 'libx264',
    hevc: 'libx265',
    mpeg2: 'mpeg2video',
  },
  cuda: {
    h264: 'h264_nvenc',
    hevc: 'hevc_nvenc',
    mpeg2: 'h264_nvenc', // No mpeg2 video encoder
  },
  qsv: {
    h264: 'h264_qsv',
    hevc: 'hevc_qsv',
    mpeg2: 'mpeg2_qsv',
  },
  vaapi: {
    h264: 'h264_vaapi',
    hevc: 'hevc_vaapi',
    mpeg2: 'mpeg2_vaapi',
  },
  videotoolbox: {
    h264: 'h264_videotoolbox',
    hevc: 'hevc_videotoolbox',
    mpeg2: 'h264_videotoolbox',
  },
};

export type StreamOptions = {
  startTime: Duration;
  duration: Duration;
  watermark?: Watermark;
  realtime?: boolean; // = true,
  extraInputHeaders?: Record<string, string>;
  outputFormat: OutputFormat;
  ptsOffset?: number;
};

export type StreamSessionOptions = StreamOptions & {
  streamSource: StreamSource;
  streamDetails: StreamDetails;
};

export class FFMPEG implements IFFMPEG {
  private logger: Logger;
  private errorPicturePath: string;
  private ffmpegName: string;

  private wantedW: number;
  private wantedH: number;
  private apad: boolean;
  private ensureResolution: boolean;
  private volumePercent: number;
  private hasBeenKilled: boolean = false;
  private alignAudio: boolean;
  private capabilities: FFMPEGInfo;

  constructor(
    private opts: DeepReadonly<FfmpegSettings>,
    private channel: Channel,
    private audioOnly: boolean = false,
  ) {
    this.logger = LoggerFactory.child({
      caller: import.meta,
      className: FFMPEG.name,
      channel: channel.uuid,
    });
    this.opts = opts;
    this.errorPicturePath = makeLocalUrl('/images/generic-error-screen.png');
    this.ffmpegName = 'unnamed ffmpeg';
    this.channel = channel;
    this.capabilities = new FFMPEGInfo(this.opts);

    let targetResolution = opts.targetResolution;
    if (!isUndefined(channel.transcoding?.targetResolution)) {
      targetResolution = channel.transcoding.targetResolution;
    }

    if (
      !isUndefined(channel.transcoding?.videoBitrate) &&
      channel.transcoding.videoBitrate !== 0
    ) {
      this.opts = {
        ...this.opts,
        videoBitrate: channel.transcoding.videoBitrate,
      };
    }

    if (
      !isUndefined(channel.transcoding?.videoBufferSize) &&
      channel.transcoding.videoBufferSize !== 0
    ) {
      this.opts = {
        ...this.opts,
        videoBufferSize: channel.transcoding.videoBufferSize,
      };
    }

    this.wantedW = targetResolution.widthPx;
    this.wantedH = targetResolution.heightPx;

    this.apad = this.opts.normalizeAudio;
    this.ensureResolution = this.opts.normalizeResolution;
    this.volumePercent = this.opts.audioVolumePercent;
  }

  createConcatSession(
    streamUrl: string,
    opts: DeepReadonly<Partial<ConcatOptions>> = defaultConcatOptions,
  ): Promise<FfmpegTranscodeSession> {
    this.ffmpegName = 'Concat FFMPEG';
    const ffmpegArgs: string[] = [
      '-hide_banner',
      `-threads`,
      '1',
      '-loglevel',
      this.opts.logLevel,
      '-user_agent',
      `Ffmpeg Tunarr/${getTunarrVersion()}`,
      `-fflags`,
      `+genpts+discardcorrupt+igndts`,
      // '-re', // Research this https://stackoverflow.com/a/48479202
      `-f`,
      `concat`,
      `-safe`,
      `0`,
      '-stream_loop',
      '-1',
      `-protocol_whitelist`,
      `file,http,tcp,https,tcp,tls`,
      `-probesize`,
      '32',
      `-i`,
      streamUrl,
    ];

    // Workaround until new pipeline is in place...
    const scThreshold = this.opts.videoEncoder.includes('mpeg2')
      ? '1000000000'
      : '0';

    ffmpegArgs.push(
      '-flags',
      'cgop',
      '-sc_threshold',
      scThreshold,
      '-movflags',
      '+faststart',
      '-bf',
      '0',
    );

    if (!this.audioOnly) {
      ffmpegArgs.push(`-map`, `0:v`);
    }

    ffmpegArgs.push(
      `-map`,
      `0:a`,
      ...this.getVideoOutputOptions(),
      '-c:a',
      this.opts.audioEncoder,
      ...this.getAudioOutputOptions(),
      // This _seems_ to quell issues with non-monotonous DTS coming
      // from the input audio stream
      '-af',
      'aselect=concatdec_select,aresample=async=1',
      `-muxdelay`,
      this.opts.concatMuxDelay.toString(),
      `-muxpreload`,
      this.opts.concatMuxDelay.toString(),
      `-metadata`,
      `service_provider="tunarr"`,
      `-metadata`,
      `service_name="${this.channel.name}"`,
    );

    // NOTE: Most browsers don't support playback of AC3 audio due to licensing issues
    // We could offer a parameter to auto-convert to AAC...or offer a backup configuration
    // or just try and detect what the client supports and go from there.
    const outputFormat = opts.outputFormat ?? MpegTsOutputFormat;
    switch (outputFormat.type) {
      case 'mpegts':
        ffmpegArgs.push(
          `-f`,
          `mpegts`,
          '-mpegts_flags',
          '+initial_discontinuity',
          `pipe:1`,
        );
        break;
      case 'hls':
        ffmpegArgs.push(...this.getHlsOptions(outputFormat.hlsOptions));
        break;
      case 'dash':
        ffmpegArgs.push(...this.getDashOptions(outputFormat.options));
        break;
      default:
        throw new Error(
          `Unsupported output format for concat: ${outputFormat.type}`,
        );
    }

    return Promise.resolve(this.createProcess(ffmpegArgs));
  }

  createWrapperConcatSession(streamUrl: string, streamMode: ChannelStreamMode) {
    this.ffmpegName = 'Concat Wrapper FFMPEG';
    const ffmpegArgs = [
      '-nostdin',
      '-threads',
      '1',
      '-hide_banner',
      '-loglevel',
      this.opts.logLevel,
      '-user_agent',
      `Ffmpeg Tunarr/${getTunarrVersion()}`,
      '-nostats',
      '-fflags',
      '+genpts+discardcorrupt+igndts',
      '-reconnect',
      '1',
      '-reconnect_at_eof',
      '1',
      '-readrate',
      '1',
      ...(streamMode === 'mpegts'
        ? [
            '-safe',
            '0',
            '-stream_loop',
            '-1',
            `-protocol_whitelist`,
            `file,http,tcp,https,tcp,tls`,
            `-probesize`,
            '32',
          ]
        : []),
      '-i',
      streamUrl,
      '-map',
      '0',
      '-c',
      'copy',
      `-f`,
      `mpegts`,
      `pipe:1`,
    ];

    // Stream is potentially infinite
    return Promise.resolve(this.createProcess(ffmpegArgs));
  }

  createStreamSession({
    streamSource,
    streamDetails,
    startTime,
    duration,
    watermark: enableIcon,
    realtime = true,
    outputFormat,
    ptsOffset,
  }: StreamSessionOptions) {
    this.ffmpegName = 'Raw Stream FFMPEG';
    return this.createSession(
      streamSource,
      streamDetails,
      startTime,
      duration,
      realtime,
      enableIcon,
      outputFormat,
      ptsOffset,
    );
  }

  createErrorSession(
    title: string,
    subtitle: Maybe<string>,
    duration: Duration,
    outputFormat: OutputFormat = NutOutputFormat,
  ) {
    this.ffmpegName = 'Error Stream FFMPEG';
    if (this.opts.errorScreen === 'kill') {
      throw new Error('Error screen configured to end stream. Ending now.');
    }

    if (isUndefined(duration)) {
      this.logger.warn('No duration found for error stream, using placeholder');
      duration = dayjs.duration(MAXIMUM_ERROR_DURATION_MS);
    }

    // duration = dayjs.duration(
    //   Math.min(MAXIMUM_ERROR_DURATION_MS, duration.asMilliseconds()),
    // );
    const streamStats: StreamDetails = {
      videoDetails: [
        {
          // TODO:
          sampleAspectRatio: '1:1',
          displayAspectRatio: '1:1',
          width: this.wantedW,
          height: this.wantedH,
        },
      ],
      duration,
    };

    return this.createSession(
      new ErrorStreamSource(title, subtitle),
      streamStats,
      undefined,
      streamStats.duration!,
      true,
      /*watermark=*/ undefined,
      outputFormat,
    );
  }

  createOfflineSession(
    duration: Duration,
    outputFormat: OutputFormat = NutOutputFormat,
  ) {
    this.ffmpegName = 'Offline Stream FFMPEG';
    const streamStats = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration: duration,
    };

    return this.createSession(
      OfflineStreamSource.instance(),
      streamStats,
      undefined,
      duration,
      true,
      undefined,
      outputFormat,
    );
  }

  async createSession(
    streamSrc: StreamSource,
    streamStats: Maybe<StreamDetails>,
    startTime: Maybe<Duration>,
    duration: Duration,
    realtime: boolean,
    watermark: Maybe<Watermark>,
    outputFormat: OutputFormat = NutOutputFormat,
    ptsOffset: Nullable<number> = null,
  ): Promise<Maybe<FfmpegTranscodeSession>> {
    const ffmpegArgs: string[] = [
      '-hide_banner',
      `-threads`,
      this.opts.numThreads.toString(),
      `-fflags`,
      `+genpts+discardcorrupt+igndts`,
      '-loglevel',
      this.opts.logLevel,
    ];

    const videoStream = first(streamStats?.videoDetails);
    const audioStream = first(streamStats?.audioDetails);

    // Initialize like this because we're not checking whether or not
    // the input is hardware decodeable, yet.
    if (this.opts.hardwareAccelerationMode === 'vaapi') {
      const vaapiDevice = isNonEmptyString(this.opts.vaapiDevice)
        ? this.opts.vaapiDevice
        : isLinux()
        ? '/dev/dri/renderD128'
        : undefined;
      ffmpegArgs.push(
        // Crude workaround for no av1 decoding support
        ...(videoStream?.codec === 'av1' ? [] : ['-hwaccel', 'vaapi']),
        ...(isNonEmptyString(vaapiDevice)
          ? ['-vaapi_device', vaapiDevice]
          : []),
      );
    }

    if (streamSrc.type === 'http') {
      ffmpegArgs.push(
        '-reconnect',
        '1',
        '-reconnect_on_network_error',
        '1',
        '-reconnect_streamed',
        '1',
        '-multiple_requests',
        '1',
      );
    }

    let artificialBurst = false;

    if (!this.audioOnly || isNonEmptyString(streamSrc)) {
      const supportsBurst = await this.capabilities.hasOption(
        'readrate_initial_burst',
      );

      if (!realtime) {
        if (supportsBurst) {
          const burst = duration
            ? round(Math.min(45, duration.asSeconds() / 2))
            : 45;
          ffmpegArgs.push(
            '-readrate',
            '1.0',
            '-readrate_initial_burst',
            `${burst}`,
          );
        } else {
          ffmpegArgs.push('-readrate', '4.0');
          artificialBurst = true;
        }
      } else {
        ffmpegArgs.push(`-readrate`, '1.0');
      }
    }

    if (!isUndefined(startTime)) {
      ffmpegArgs.push(`-ss`, `${startTime.asSeconds()}`);
    }

    // Map correct audio index. '?' so doesn't fail if no stream available.
    const audioIndex = isUndefined(audioStream)
      ? 'a'
      : `${audioStream.index ?? 'a'}`;

    //TODO: Do something about missing audio stream
    let inputFiles = 0;
    let audioFile = -1;
    let videoFile = -1;
    let overlayFile = -1;
    if (streamSrc.type === 'http' || streamSrc.type === 'file') {
      if (streamSrc.type === 'http') {
        ffmpegArgs.push(`-i`, streamSrc.path);
        if (!isEmpty(streamSrc.extraHeaders)) {
          for (const [key, value] of Object.entries(streamSrc.extraHeaders)) {
            ffmpegArgs.push('-headers', `'${key}: ${value}'`);
          }
        }
      } else if (streamSrc.type === 'file') {
        ffmpegArgs.push(`-i`, streamSrc.path);
      }

      videoFile = inputFiles++;
      audioFile = videoFile;
    }

    // When we have an individual stream, there is a pipeline of possible
    // filters to apply.
    //
    let doOverlay = !isNil(watermark);
    let iW = videoStream?.width;
    let iH = videoStream?.height;

    // (explanation is the same for the video and audio streams)
    // The initial stream is called '[video]'
    let currentVideo = '[video]';
    let currentAudio = '[audio]';
    // Initially, videoComplex does nothing besides assigning the label
    // to the input stream
    const videoIndex = isNonEmptyString(videoStream?.streamIndex)
      ? videoStream?.streamIndex
      : 'v';
    let audioComplex = `;[${audioFile}:${audioIndex}]anull[audio]`;
    let videoComplex = `;[${videoFile}:${videoIndex}]null[video]`;

    // This is only tracked for the vaapi path at the moment
    let framesOnHardware = false;
    if (this.opts.hardwareAccelerationMode === 'vaapi') {
      videoComplex += `;${currentVideo}format=nv12|vaapi,hwupload=extra_hw_frames=64[hwupload]`;
      currentVideo = '[hwupload]';
      framesOnHardware = true;
    }

    // Depending on the options we will apply multiple filters
    // each filter modifies the current video stream. Adds a filter to
    // the videoComplex variable. The result of the filter becomes the
    // new currentVideo value.
    //
    // When adding filters, make sure that
    // videoComplex always begins wiht ; and doesn't end with ;

    if ((videoStream?.framerate ?? 0) >= this.opts.maxFPS + 0.000001) {
      videoComplex += `;${currentVideo}fps=${this.opts.maxFPS}[fpchange]`;
      currentVideo = '[fpchange]';
    }

    // deinterlace if desired
    if (
      videoStream?.scanType === 'interlaced' &&
      this.opts.deinterlaceFilter !== 'none'
    ) {
      if (framesOnHardware && this.opts.hardwareAccelerationMode === 'vaapi') {
        videoComplex += `;${currentVideo}deinterlace_vaapi=rate=field:auto=1[deinterlaced]`;
      } else {
        videoComplex += `;${currentVideo}${this.opts.deinterlaceFilter}[deinterlaced]`;
      }
      currentVideo = '[deinterlaced]';
    }

    // prepare input streams
    if (
      (streamSrc.type !== 'file' && streamSrc.type !== 'http') ||
      streamStats?.audioOnly
    ) {
      doOverlay = false; //never show icon in the error screen
      // for error stream, we have to generate the input as well
      this.apad = false; //all of these generate audio correctly-aligned to video so there is no need for apad
      // this.audioChannelsSampleRate = true; //we'll need these

      //all of the error strings already choose the resolution to
      //match iW x iH , so with this we save ourselves a second
      // scale filter
      iW = this.wantedW;
      iH = this.wantedH;

      if (!this.audioOnly) {
        ffmpegArgs.push('-r', '24');
        let pic: string | undefined;

        //does an image to play exist?
        if (
          (streamSrc.type === 'file' || streamSrc.type === 'http') &&
          streamStats?.audioOnly
        ) {
          pic = streamStats.placeholderImage;
        } else if (streamSrc.type === 'offline') {
          // TODO fix me
          const defaultOfflinePic = makeLocalUrl(
            '/images/generic-offline-screen.png',
          );
          pic = isEmpty(this.channel.offline?.picture)
            ? defaultOfflinePic
            : this.channel.offline?.picture;
        } else if (this.opts.errorScreen === 'pic') {
          pic = this.errorPicturePath;
        }

        if (!isNil(pic) && !isEmpty(pic)) {
          ffmpegArgs.push('-i', pic);
          //add 150 milliseconds just in case, exact duration seems to cut out the last bits of music some times.
          duration = duration.add(150);
          const filters = [
            'format=yuv420p',
            `scale=w=${iW}:h=${iH}:force_original_aspect_ratio=1`,
            `pad=${iW}:${iH}:(ow-iw)/2:(oh-ih)/2`,
            'loop=loop=-1:size=1:start=0',
          ];

          if (realtime) {
            filters.push('realtime');
          }
          if (this.opts.hardwareAccelerationMode === 'vaapi') {
            filters.push('format=nv12', 'hwupload=extra_hw_frames=64');
          }
          videoComplex = `;[${inputFiles++}:0]${filters.join(',')}[videox]`;
        } else if (this.opts.errorScreen == 'static') {
          ffmpegArgs.push('-f', 'lavfi', '-i', `nullsrc=s=64x36`);
          let realtimePart = '[videox]';
          if (realtime) {
            realtimePart = '[videoy];[videoy]realtime[videox]';
          }
          videoComplex = `;geq=random(1)*255:128:128[videoz];[videoz]scale=${iW}:${iH}${realtimePart}`;
          inputFiles++;
        } else if (this.opts.errorScreen == 'testsrc') {
          ffmpegArgs.push('-f', 'lavfi', '-i', `testsrc=size=${iW}x${iH}`);

          videoComplex = `${realtime ? ';realtime' : ''}[videox]`;
          inputFiles++;
        } else if (
          this.opts.errorScreen == 'text' &&
          streamSrc.type === 'error'
        ) {
          const sz2 = Math.ceil(iH / 33.0);
          const sz1 = Math.ceil((sz2 * 3) / 2);
          const sz3 = 2 * sz2;

          ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
          inputFiles++;

          videoComplex = `;drawtext=fontfile=${
            serverOptions().databaseDirectory
          }/font.ttf:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${
            streamSrc.title
          }',drawtext=fontfile=${
            serverOptions().databaseDirectory
          }/font.ttf:fontsize=${sz2}:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+${sz3})/2:text='${
            streamSrc.subtitle ?? ''
          }'[videoy];[videoy]realtime[videox]`;
        } else {
          //blank
          ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
          inputFiles++;
          videoComplex = `;realtime[videox]`;
        }
      }
      const durstr = `duration=${duration.asMilliseconds()}ms`;
      if (streamSrc.type === 'offline' || streamSrc.type === 'error') {
        // silent
        audioComplex = `;aevalsrc=0:${durstr}:s=${
          this.opts.audioSampleRate * 1000
        },aresample=async=1:first_pts=0[audioy]`;
        if (streamSrc.type === 'offline') {
          if (isNonEmptyString(this.channel.offline?.soundtrack)) {
            ffmpegArgs.push('-i', `${this.channel.offline.soundtrack}`);
            // I don't really understand why, but you need to use this
            // 'size' in order to make the soundtrack actually loop
            audioComplex = `;[${inputFiles++}:a]aloop=loop=-1:size=2147483647[audioy]`;
          }
        } else if (
          this.opts.errorAudio === 'whitenoise' ||
          (!(this.opts.errorAudio === 'sine') && this.audioOnly) //when it's in audio-only mode, silent stream is confusing for errors.
        ) {
          audioComplex = `;aevalsrc=random(0):${durstr}[audioy]`;
          this.volumePercent = Math.min(70, this.volumePercent);
        } else if (this.opts.errorAudio === 'sine') {
          audioComplex = `;sine=f=440[audioy]`;
          this.volumePercent = Math.min(70, this.volumePercent);
        }
        if (!this.audioOnly) {
          ffmpegArgs.push('-pix_fmt', 'yuv420p');
        }
        currentAudio = '[audioy]';
        if (realtime) {
          audioComplex += ';[audioy]arealtime[audiox]';
          currentAudio = '[audiox]';
        }
      }
      currentVideo = '[videox]';
    } else {
      // HACK: We know these will be defined already if we get this far
      iW = iW!;
      iH = iH!;
    }

    if (doOverlay && !isNil(watermark?.url)) {
      if (watermark.animated) {
        ffmpegArgs.push('-ignore_loop', '0', '-stream_loop', '-1');
      }
      ffmpegArgs.push(`-i`, `${watermark.url}`);
      overlayFile = inputFiles++;
      this.ensureResolution = true;
    }

    // Resolution fix: Add scale filter, current stream becomes [siz]
    const beforeSizeChange = currentVideo;
    const algo = this.opts.scalingAlgorithm;
    let resizeMsg = '';
    if (
      !streamStats?.audioOnly &&
      ((this.ensureResolution &&
        (videoStream?.anamorphic ||
          iW !== this.wantedW ||
          iH !== this.wantedH)) ||
        isLargerResolution(
          { widthPx: iW, heightPx: iH },
          { widthPx: this.wantedW, heightPx: this.wantedH },
        ))
    ) {
      // scaler stuff, need to change the size of the video and also add bars
      // calculate wanted aspect ratio
      const [width, height] = videoStream!.sampleAspectRatio
        .split(':')
        .map((i) => parseInt(i));
      const sarSize: Resolution = { widthPx: width, heightPx: height };
      let p = iW * sarSize.widthPx;
      let q = iH * sarSize.heightPx;
      const g = gcd(q, p); // and people kept telling me programming contests knowledge had no use real programming!
      p = Math.floor(p / g);
      q = Math.floor(q / g);
      const hypotheticalW1 = this.wantedW;
      const hypotheticalH1 = Math.floor((hypotheticalW1 * q) / p);
      const hypotheticalH2 = this.wantedH;
      const hypotheticalW2 = Math.floor((this.wantedH * p) / q);
      let cw: number, ch: number;
      if (hypotheticalH1 <= this.wantedH) {
        cw = hypotheticalW1;
        ch = hypotheticalH1;
      } else {
        cw = hypotheticalW2;
        ch = hypotheticalH2;
      }

      let scaleFilter = `scale=${cw}:${ch}:flags=${algo},format=yuv420p`;
      if (this.opts.hardwareAccelerationMode === 'vaapi') {
        scaleFilter = `scale_vaapi=w=${cw}:h=${ch}:mode=fast:extra_hw_frames=64`;
      }

      videoComplex += `;${currentVideo}${scaleFilter}[scaled]`;
      currentVideo = 'scaled';
      resizeMsg = `Stretch to ${cw} x ${ch}. To fit target resolution of ${this.wantedW} x ${this.wantedH}.`;
      if (this.ensureResolution) {
        this.logger.info(
          `First stretch to ${cw} x ${ch}. Then add padding to make it ${this.wantedW} x ${this.wantedH} `,
        );
      } else if (cw % 2 === 1 || ch % 2 === 1) {
        //we need to add padding so that the video dimensions are even
        const xw = cw + (cw % 2);
        const xh = ch + (ch % 2);
        resizeMsg = `Stretch to ${cw} x ${ch}. To fit target resolution of ${this.wantedW} x ${this.wantedH}. Then add 1 pixel of padding so that dimensions are not odd numbers, because they are frowned upon. The final resolution will be ${xw} x ${xh}`;
        this.wantedW = xw;
        this.wantedH = xh;
      } else {
        resizeMsg = `Stretch to ${cw} x ${ch}. To fit target resolution of ${this.wantedW} x ${this.wantedH}.`;
      }
      if (this.wantedW !== cw || this.wantedH !== ch) {
        if (framesOnHardware) {
          videoComplex += `;[${currentVideo}]hwdownload[hwdownloaded]`;
          currentVideo = 'hwdownloaded';
          framesOnHardware = false;
        }
        // also add black bars, because in this case it HAS to be this resolution
        videoComplex += `;[${currentVideo}]pad=${this.wantedW}:${this.wantedH}:(ow-iw)/2:(oh-ih)/2[blackpadded]`;
        currentVideo = 'blackpadded';
      }
      let name = 'siz';
      if (!this.ensureResolution && beforeSizeChange !== '[fpchange]') {
        name = 'minsiz';
      }

      if (framesOnHardware) {
        videoComplex += `;[${currentVideo}]hwdownload[hwdownloaded]`;
        currentVideo = 'hwdownloaded';
        framesOnHardware = false;
      }

      videoComplex += `;[${currentVideo}]setsar=1[${name}]`;
      currentVideo = `[${name}]`;
      iW = this.wantedW;
      iH = this.wantedH;
    } else if (this.opts.hardwareAccelerationMode === 'cuda') {
      const gpuCapabilities = await this.capabilities.getNvidiaCapabilities();
      // Use this as an analogue for detecting an attempt to encode 10-bit content
      // ... it might not be totally true, but we'll make this better.
      let canEncode = false;
      if (isSuccess(gpuCapabilities)) {
        canEncode = gpuCapabilities.canEncode(
          this.opts.videoFormat,
          first(streamStats?.videoDetails)?.profile,
          getPixelFormatForStream(streamStats!),
        );
      }

      if (!canEncode) {
        ffmpegArgs.push('-pix_fmt', 'yuv420p');
      }
    }

    // Channel watermark:
    // We're going to force this to cpu for now...
    if (doOverlay && !isNil(watermark) && !this.audioOnly) {
      const trimmed = videoComplex.slice(
        0,
        videoComplex.length - sanitizeFilterName(currentVideo).length,
      );
      videoComplex = `${trimmed},format=yuv420p${sanitizeFilterName(
        currentVideo,
      )}`;

      const pW = watermark.width;
      const w = Math.round((pW * iW) / 100.0);
      const mpHorz = watermark.horizontalMargin;
      const mpVert = watermark.verticalMargin;
      const horz = Math.round((mpHorz * iW) / 100.0);
      const vert = Math.round((mpVert * iH) / 100.0);

      // TODO: do not enable this if we are using fade points
      let waterVideo = `[${overlayFile}:v]`;
      const watermarkFilters: string[] = ['format=yuva420p'];

      if (!watermark.fixedSize) {
        watermarkFilters.push(`scale=${w}:-1`);
      }

      if (isDefined(watermark.opacity) && watermark.opacity < 100) {
        watermarkFilters.push(
          `colorchannelmixer=aa=${round(watermark.opacity / 100, 2)}`,
        );
      }

      if (!isEmpty(watermark?.fadeConfig)) {
        // Pick the first for now
        const fadeConfig = first(watermark?.fadeConfig)!;
        const periodMins = fadeConfig.periodMins;
        if (periodMins > 0) {
          const start = startTime ?? dayjs.duration(0);
          const streamDur =
            duration.asMilliseconds() > start.asMilliseconds()
              ? duration.subtract(start)
              : duration;
          const periodSeconds = periodMins * 60;
          const cycles = streamDur.asMilliseconds() / (periodSeconds * 1000);

          // If leading edge, fade in the watermark after the first second of programming
          // otherwise, wait a full period
          const fadeStartTime = fadeConfig.leadingEdge ? 1 : periodSeconds;
          // Make the watermark transparent before the first fade in
          watermarkFilters.push(
            `colorchannelmixer=aa=0:enable='between(t,0,${fadeStartTime})'`,
          );

          for (let cycle = 0, t = fadeStartTime; cycle < cycles; cycle++) {
            watermarkFilters.push(
              `fade=in:st=${t}:d=1:alpha=1:enable='between(t,${t},${
                t + (periodSeconds - 1)
              })'`,
            );
            watermarkFilters.push(
              `fade=out:st=${t + periodSeconds}:d=1:alpha=1:enable='between(t,${
                t + periodSeconds
              },${t + periodSeconds * 2})'`,
            );
            t += periodSeconds * 2;
          }
        }
      }

      if (!isEmpty(watermarkFilters)) {
        videoComplex += `;${waterVideo}${watermarkFilters.join(',')}[icn]`;
        waterVideo = '[icn]';
      }

      let position: string;
      switch (watermark.position) {
        case 'top-left':
          position = `x=${horz}:y=${vert}`;
          break;
        case 'top-right':
          position = `x=W-w-${horz}:y=${vert}`;
          break;
        case 'bottom-left':
          position = `x=${horz}:y=H-h-${vert}`;
          break;
        case 'bottom-right':
          position = `x=W-w-${horz}:y=H-h-${vert}`;
          break;
      }

      const icnDur =
        watermark.duration > 0
          ? `:enable='between(t,0,${watermark.duration})'`
          : '';
      const overlayShortest = watermark.animated ? 'shortest=1:' : '';
      const overlayFilters = [`overlay=${overlayShortest}${position}${icnDur}`];
      if (this.opts.hardwareAccelerationMode === 'vaapi') {
        overlayFilters.push('format=nv12', 'hwupload=extra_hw_frames=64');
      }
      videoComplex += `;${currentVideo}${waterVideo}${overlayFilters.join(
        ',',
      )}[comb]`;
      currentVideo = '[comb]';
    } else {
      if (this.opts.hardwareAccelerationMode === 'vaapi') {
        if (!framesOnHardware) {
          videoComplex += `;${currentVideo}format=nv12,hwupload=extra_hw_frames=64[hwuploaded]`;
          currentVideo = '[hwuploaded]';
          framesOnHardware = true;
        }
      } else {
        // HACK
        const trimmed = videoComplex.slice(
          0,
          videoComplex.length - sanitizeFilterName(currentVideo).length,
        );
        videoComplex = `${trimmed},format=yuv420p${sanitizeFilterName(
          currentVideo,
        )}`;
      }
    }

    if (this.volumePercent !== 100) {
      const f = round(this.volumePercent / 100.0, 2);
      audioComplex += `;${currentAudio}volume=${f}[boosted]`;
      currentAudio = '[boosted]';
    }

    // Align audio is just the apad filter applied to audio stream
    if (this.apad && !this.audioOnly) {
      //it doesn't make much sense to pad audio when there is no video
      const filters = [
        'aresample=48000',
        'aresample=async=1:first_pts=0',
        `apad=whole_dur=${duration.asMilliseconds()}ms`,
      ].join(',');
      audioComplex += `;${currentAudio}${filters}[padded]`;
      currentAudio = '[padded]';
    }

    let filterComplex = '';
    if (currentVideo === '[minsiz]') {
      // do not change resolution if no other transcoding will be done
      // and resolution normalization is off
      currentVideo = beforeSizeChange;
    } else {
      this.logger.debug(resizeMsg);
    }
    if (this.audioOnly !== true) {
      if (currentVideo !== '[video]') {
        filterComplex += videoComplex;
      } else {
        currentVideo = `${videoFile}:${videoIndex}`;
      }
    }
    // same with audio:
    if (currentAudio !== '[audio]') {
      filterComplex += audioComplex;
    } else {
      currentAudio = `${audioFile}:${audioIndex}`;
    }

    //If there is a filter complex, add it.
    if (isNonEmptyString(filterComplex)) {
      if (this.opts.hardwareAccelerationMode === 'vaapi') {
        // ffmpegArgs.push('-filter_hw_device', 'hw');
      }
      ffmpegArgs.push(`-filter_complex`, filterComplex.slice(1));
      if (this.alignAudio) {
        ffmpegArgs.push('-shortest');
      }
    }

    const videoOutputOptions: string[] = [];
    switch (outputFormat.type) {
      case 'hls':
      case 'mpegts':
        videoOutputOptions.push(...this.getVideoOutputOptions());
        break;
      case 'nut':
        videoOutputOptions.push('-c:v', 'rawvideo');
        break;
    }

    const audioOutputOptions: string[] = [];
    switch (outputFormat.type) {
      case 'hls':
      case 'mpegts':
        audioOutputOptions.push(...this.getAudioOutputOptions());
        break;
      case 'nut':
        audioOutputOptions.push('-c:a', 'flac');
        break;
    }

    if (!this.audioOnly) {
      ffmpegArgs.push(
        '-map',
        currentVideo,
        ...videoOutputOptions,
        `-sc_threshold`,
        `0`,
        '-video_track_timescale',
        '90000',
      );

      // We probably need this even if we're not audio only...
      if (ptsOffset !== null && ptsOffset > 0) {
        ffmpegArgs.push('-output_ts_offset', `${ptsOffset / 90_000}`);
      }
    }

    ffmpegArgs.push(
      '-map',
      currentAudio,
      '-flags',
      'cgop+ilme',
      ...audioOutputOptions,
      // TODO: Figure out why transitioning between still image streams
      // with generated audio and real streams causes PCM to break.
      // 'pcm_s16le',
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      `-muxdelay`,
      `0`,
      `-muxpreload`,
      `0`,
      '-fps_mode',
      'cfr',
    );

    ffmpegArgs.push(
      `-metadata`,
      `service_provider="tunarr"`,
      `-metadata`,
      `service_name="${this.channel.name}"`,
    );

    //t should be before -f
    if (artificialBurst) {
      duration =
        isDefined(duration) && duration.asMilliseconds() < 45_000
          ? duration
          : dayjs.duration({ seconds: 45 });
      ffmpegArgs.push('-t', `${duration.asMilliseconds()}ms`);
    } else if (!isUndefined(duration)) {
      ffmpegArgs.push(`-t`, `${duration.asMilliseconds()}ms`);
    }

    switch (outputFormat.type) {
      case 'hls':
        ffmpegArgs.push(
          ...this.getHlsOptions(outputFormat.hlsOptions, streamStats),
        );
        break;
      case 'nut':
        ffmpegArgs.push(`-f`, 'nut', `pipe:1`);
        break;
      case 'mpegts':
        ffmpegArgs.push(...this.mpegTsOutputFormatOptions());
        break;
    }

    if (this.hasBeenKilled) {
      this.logger.info('ffmpeg preemptively killed');
      return;
    }

    return this.createProcess(ffmpegArgs, duration);
  }

  private createProcess(
    ffmpegArgs: string[],
    streamDuration?: Duration,
  ): FfmpegTranscodeSession {
    const process = new FfmpegProcess(this.opts, this.ffmpegName, ffmpegArgs);

    // TODO: Do we need a more accurate measure of "streamEndTime" by passing in
    // the request start time? Or is this really inaccurate because we still have
    // a short amount of time before the stream is actually started...
    return new FfmpegTranscodeSession(
      process,
      streamDuration ?? dayjs.duration(-1),
      streamDuration ? dayjs().add(streamDuration) : dayjs(-1),
    );
  }

  private getHlsOptions(
    opts?: Partial<HlsOptions>,
    streamStats?: StreamDetails,
  ) {
    const hlsOpts = merge({}, defaultHlsOptions, opts);
    const baseUrl = hlsOpts.streamBaseUrl.endsWith('/')
      ? hlsOpts.streamBaseUrl
      : `${hlsOpts.streamBaseUrl}/`;

    const hlsFlags = ['program_date_time', 'omit_endlist', 'discont_start'];
    if (hlsOpts.hlsListSize > 0) {
      hlsFlags.push('delete_segments');
    }

    if (hlsOpts.appendSegments) {
      hlsFlags.push('append_list');
    }

    const frameRate = first(streamStats?.videoDetails)?.framerate ?? 24;

    return [
      '-g',
      this.opts.hardwareAccelerationMode === 'qsv'
        ? `${frameRate}`
        : `${frameRate * hlsOpts.hlsTime}`,
      '-keyint_min',
      `${frameRate * hlsOpts.hlsTime}`,
      '-force_key_frames',
      // Force a key frame every N seconds
      // TODO consider using the GOP parameter here as stated in the docs
      `expr:gte(t,n_forced*${hlsOpts.hlsTime / 2})`,
      '-f',
      'hls',
      '-hls_time',
      hlsOpts.hlsTime.toString(),
      '-hls_list_size',
      hlsOpts.hlsListSize.toString(),
      '-segment_list_flags',
      '+live',
      ...(hlsOpts.deleteThreshold && hlsOpts.deleteThreshold >= 0
        ? ['-hls_delete_threshold', `${hlsOpts.deleteThreshold}`]
        : []),
      '-hls_flags',
      `${hlsFlags.join('+')}`,
      '-hls_segment_type',
      'mpegts',
      '-hls_base_url',
      baseUrl,
      '-hls_segment_filename',
      path.join('streams', hlsOpts.streamBasePath, hlsOpts.segmentNameFormat),
      '-master_pl_name',
      'master.m3u8',
      path.join('streams', hlsOpts.streamBasePath, hlsOpts.streamNameFormat),
    ];
  }

  private getDashOptions(opts?: Partial<MpegDashOptions>): string[] {
    const dashOpts = merge({}, defaultMpegDashOptions, opts);
    return [
      '-f',
      'dash',
      '-seg_duration',
      dashOpts.segmentDuration.toString(),
      '-window_size',
      dashOpts.windowSize.toString(),
      '-extra_window_size',
      '3',
      '-dash_segment_type',
      dashOpts.segmentType,
      '-frag_type',
      dashOpts.fragType,
      '-hls_playlist',
      'true',
    ];
  }

  private mpegTsOutputFormatOptions() {
    return [
      `-f`,
      `mpegts`,
      '-mpegts_flags',
      '+initial_discontinuity',
      `pipe:1`,
    ];
  }

  private getVideoOutputOptions() {
    // Right now we're just going to use a simple combo of videoFormat + hwAccel
    // to specify an encoder. There's a lot more we can do with these settings,
    // but we're going to hold off for the new ffmpeg pipeline implementation
    // and just keep existing behavior here.
    const videoEncoder =
      hardwareAccelToEncoder[this.opts.hardwareAccelerationMode][
        this.opts.videoFormat
      ];

    return [
      '-c:v',
      videoEncoder,
      `-b:v`,
      `${this.opts.videoBitrate}k`,
      `-maxrate:v`,
      `${this.opts.videoBitrate}k`,
      `-bufsize:v`,
      `${this.opts.videoBufferSize}k`,
    ];
  }

  private getAudioOutputOptions() {
    const audioOutputOpts = [
      '-b:a',
      `${this.opts.audioBitrate}k`,
      '-maxrate:a',
      `${this.opts.audioBitrate}k`,
      '-bufsize:a',
      `${this.opts.audioBufferSize}k`,
    ];

    if (this.opts.normalizeAudio) {
      audioOutputOpts.push(
        '-ac',
        `${this.opts.audioChannels}`,
        '-ar',
        `${this.opts.audioSampleRate}k`,
      );
    }

    return audioOutputOpts;
  }
}

/**
 * True if the first param is a larger resolution than the right OR
 * if the first param has an odd number width or height.
 * @param left
 * @param right
 */
function isLargerResolution(left: Resolution, right: Resolution) {
  return (
    left.widthPx > right.widthPx ||
    left.heightPx > right.heightPx ||
    left.widthPx % 2 === 1 ||
    left.heightPx % 2 === 1
  );
}

function sanitizeFilterName(name: string) {
  if (name.startsWith('[') && name.endsWith(']')) {
    return name;
  }
  return `[${name}]`;
}
