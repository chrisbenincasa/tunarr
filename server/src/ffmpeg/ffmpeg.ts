import { FfmpegSettings, Watermark } from '@tunarr/types';
import {
  SupportedHardwareAccels,
  SupportedVideoFormats,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { Duration } from 'dayjs/plugin/duration.js';
import {
  first,
  isEmpty,
  isNil,
  isString,
  isUndefined,
  merge,
  round,
} from 'lodash-es';
import path from 'path';
import { DeepReadonly, DeepRequired } from 'ts-essentials';
import { Channel } from '../dao/direct/derivedTypes.js';
import { serverOptions } from '../globals.js';
import { StreamDetails } from '../stream/types.js';
import { Maybe } from '../types/util.js';
import { isDefined, isNonEmptyString } from '../util/index.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../util/serverUtil.js';
import { FfmpegProcess } from './FfmpegProcess.js';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.js';
import { FFMPEGInfo } from './ffmpegInfo.js';

const MAXIMUM_ERROR_DURATION_MS = 60000;

const STILLIMAGE_SUPPORTED_ENCODERS = [
  'mpeg2video',
  'libx264',
  'h264_videotoolbox',
];

export type FfmpegEvents = {
  end: (obj?: { code: number; cmd: string }) => void;
  error: (obj?: { code: number; cmd: string }) => void;
  close: (code?: number) => void;
};

type HlsOptions = {
  hlsTime: number; // Duration of each clip in seconds,
  hlsListSize: number; // Number of clips to have in the list
  hlsDeleteThreshold: number;
  streamBasePath: string;
  segmentNameFormat: string;
  streamNameFormat: string;
};

type DashOptions = {
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
  mode: 'direct' | 'hls';
  enableHls: boolean;
  enableDash: boolean;
  numThreads: number;
  hlsOptions?: Partial<HlsOptions>;
  dashOptions?: Partial<DashOptions>;
  logOutput: boolean;
};

export const defaultConcatOptions: DeepRequired<ConcatOptions> = {
  mode: 'direct',
  enableHls: false,
  enableDash: false,
  numThreads: 2,
  hlsOptions: {
    hlsTime: 2,
    hlsListSize: 3,
    hlsDeleteThreshold: 3,
    streamBasePath: 'stream_%v',
    segmentNameFormat: 'data%05d.ts',
    streamNameFormat: 'stream.m3u8',
  },
  dashOptions: {
    segmentDuration: 2,
    windowSize: 3,
    segmentType: 'auto',
    fragType: 'auto',
  },
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

export class FFMPEG {
  private logger: Logger;
  private errorPicturePath: string;
  private ffmpegName: string;

  private wantedW: number;
  private wantedH: number;
  private apad: boolean;
  private audioChannelsSampleRate: boolean; // ? what
  private ensureResolution: boolean;
  private volumePercent: number;
  private hasBeenKilled: boolean = false;
  private alignAudio: boolean;

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
    this.audioChannelsSampleRate = this.opts.normalizeAudio;
    this.ensureResolution = this.opts.normalizeResolution;
    this.volumePercent = this.opts.audioVolumePercent;
  }

  setAudioOnly(audioOnly: boolean) {
    this.audioOnly = audioOnly;
  }

  createConcatSession(
    streamUrl: string,
    opts: Partial<ConcatOptions> = defaultConcatOptions,
  ) {
    this.ffmpegName = 'Concat FFMPEG';
    const ffmpegArgs: string[] = [
      '-hide_banner',
      `-threads`,
      // (opts.numThreads ?? defaultConcatOptions.numThreads).toFixed(),
      '1',
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

    const audioOutputOpts = [
      '-b:a',
      `${this.opts.audioBitrate}k`,
      '-maxrate:a',
      `${this.opts.audioBitrate}k`,
      '-bufsize:a',
      `${this.opts.audioBufferSize}k`,
      // This _seems_ to quell issues with non-monotonous DTS coming
      // from the input audio stream
      '-af',
      'aselect=concatdec_select,aresample=async=1',
    ];

    if (this.audioChannelsSampleRate) {
      audioOutputOpts.push(
        '-ac',
        `${this.opts.audioChannels}`,
        '-ar',
        `${this.opts.audioSampleRate}k`,
      );
    }

    // Right now we're just going to use a simple combo of videoFormat + hwAccel
    // to specify an encoder. There's a lot more we can do with these settings,
    // but we're going to hold off for the new ffmpeg pipeline implementation
    // and just keep existing behavior here.
    const videoEncoder =
      hardwareAccelToEncoder[this.opts.hardwareAccelerationMode][
        this.opts.videoFormat
      ];

    ffmpegArgs.push(
      `-map`,
      `0:a`,
      '-c:v',
      videoEncoder,
      '-c:a',
      this.opts.audioEncoder,
      `-b:v`,
      `${this.opts.videoBitrate}k`,
      `-maxrate:v`,
      `${this.opts.videoBitrate}k`,
      `-bufsize:v`,
      `${this.opts.videoBufferSize}k`,
      ...audioOutputOpts,
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
    if (opts.enableHls) {
      const hlsOpts = merge({}, defaultConcatOptions, opts).hlsOptions;

      ffmpegArgs.push(
        '-f',
        'hls',
        '-hls_time',
        hlsOpts.hlsTime.toString(),
        '-hls_list_size',
        hlsOpts.hlsListSize.toString(),
        '-segment_list_flags',
        '+live',
        '-force_key_frames',
        // Force a key frame every N seconds
        // TODO consider using the GOP parameter here as stated in the docs
        `expr:gte(t,n_forced*${hlsOpts.hlsTime}/2)`,
        '-hls_delete_threshold',
        '3', // Num unreferenced segments
        '-hls_flags',
        'delete_segments+program_date_time+omit_endlist+discont_start+independent_segments',
        // '-hls_flags',
        // 'split_by_time',
        '-hls_segment_type',
        'mpegts',
        '-hls_base_url',
        'hls/',
        '-hls_segment_filename',
        path.join('streams', hlsOpts.streamBasePath, hlsOpts.segmentNameFormat),
        '-master_pl_name',
        'master.m3u8',
        path.join('streams', hlsOpts.streamBasePath, hlsOpts.streamNameFormat),
      );
    } else if (opts.enableDash) {
      const dashOpts = merge(defaultConcatOptions, opts).dashOptions;
      ffmpegArgs.push(
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
      );
    } else {
      ffmpegArgs.push(
        `-f`,
        `mpegts`,
        '-mpegts_flags',
        '+initial_discontinuity',
        `pipe:1`,
      );
    }

    return this.createProcess(ffmpegArgs);
  }

  createHlsConcatSession(streamUrl: string) {
    this.ffmpegName = 'HLS Concat FFMPEG';
    const ffmpegArgs = [
      '-nostdin',
      '-threads',
      '1',
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostats',
      '-fflags',
      '+genpts+discardcorrupt+igndts',
      '-readrate',
      '1',
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
    return this.createProcess(ffmpegArgs);
  }

  createStreamSession(
    streamUrl: string,
    streamStats: Maybe<StreamDetails>,
    startTime: Duration,
    duration: Duration,
    enableIcon: Maybe<Watermark>,
    realtime: boolean = true,
    extraInnputHeaders: Record<string, string> = {},
  ) {
    this.ffmpegName = 'Raw Stream FFMPEG';
    return this.createSession(
      streamUrl,
      streamStats,
      startTime,
      duration,
      realtime,
      enableIcon,
      extraInnputHeaders,
    );
  }

  createErrorSession(
    title: string,
    subtitle: Maybe<string>,
    duration: Duration,
  ) {
    this.ffmpegName = 'Error Stream FFMPEG';
    if (this.opts.errorScreen === 'kill') {
      throw new Error('Error screen configured to end stream. Ending now.');
    }

    if (isUndefined(duration)) {
      this.logger.warn('No duration found for error stream, using placeholder');
      duration = dayjs.duration(MAXIMUM_ERROR_DURATION_MS);
    }

    duration = dayjs.duration(
      Math.min(MAXIMUM_ERROR_DURATION_MS, duration.asMilliseconds()),
    );
    const streamStats: StreamDetails = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration,
    };

    return this.createSession(
      { errorTitle: title, subtitle: subtitle },
      streamStats,
      undefined,
      streamStats.duration!,
      true,
      /*watermark=*/ undefined,
    );
  }

  createOfflineSession(duration: Duration) {
    this.ffmpegName = 'Offline Stream FFMPEG';
    const streamStats = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration: duration,
    };

    return this.createSession(
      { errorTitle: 'offline' },
      streamStats,
      undefined,
      duration,
      true,
      undefined,
    );
  }

  async createSession(
    streamSrc: string | { errorTitle: string; subtitle?: string },
    streamStats: Maybe<StreamDetails>,
    startTime: Maybe<Duration>,
    duration: Duration,
    realtime: boolean,
    watermark: Maybe<Watermark>,
    extraInnputHeaders: Record<string, string> = {},
  ): Promise<Maybe<FfmpegTranscodeSession>> {
    const ffmpegArgs: string[] = [
      '-hide_banner',
      `-threads`,
      this.opts.numThreads.toString(),
      `-fflags`,
      `+genpts+discardcorrupt+igndts`,
      '-loglevel',
      'error',
    ];

    let useStillImageTune = false;
    let artificialBurst = false;

    if (!this.audioOnly || isNonEmptyString(streamSrc)) {
      const supportsBurst = await new FFMPEGInfo(this.opts).hasOption(
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
          console.log('using artificial burst');
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
    const audioIndex = isUndefined(streamStats)
      ? 'a'
      : `${streamStats.audioIndex}`;

    //TODO: Do something about missing audio stream
    let inputFiles = 0;
    let audioFile = -1;
    let videoFile = -1;
    let overlayFile = -1;
    if (isNonEmptyString(streamSrc)) {
      for (const [key, value] of Object.entries(extraInnputHeaders)) {
        ffmpegArgs.push('-headers', `'${key}: ${value}'`);
      }
      ffmpegArgs.push(`-i`, streamSrc);
      videoFile = inputFiles++;
      audioFile = videoFile;
    }

    // When we have an individual stream, there is a pipeline of possible
    // filters to apply.
    //
    let doOverlay = !isNil(watermark);
    let iW = streamStats!.videoWidth;
    let iH = streamStats!.videoHeight;

    // (explanation is the same for the video and audio streams)
    // The initial stream is called '[video]'
    let currentVideo = '[video]';
    let currentAudio = '[audio]';
    // Initially, videoComplex does nothing besides assigning the label
    // to the input stream
    const videoIndex = 'v';
    let audioComplex = `;[${audioFile}:${audioIndex}]anull[audio]`;
    let videoComplex = `;[${videoFile}:${videoIndex}]null[video]`;
    // Depending on the options we will apply multiple filters
    // each filter modifies the current video stream. Adds a filter to
    // the videoComplex variable. The result of the filter becomes the
    // new currentVideo value.
    //
    // When adding filters, make sure that
    // videoComplex always begins wiht ; and doesn't end with ;

    if ((streamStats?.videoFramerate ?? 0) >= this.opts.maxFPS + 0.000001) {
      videoComplex += `;${currentVideo}fps=${this.opts.maxFPS}[fpchange]`;
      currentVideo = '[fpchange]';
    }

    // deinterlace if desired
    if (
      streamStats?.videoScanType == 'interlaced' &&
      this.opts.deinterlaceFilter != 'none'
    ) {
      videoComplex += `;${currentVideo}${this.opts.deinterlaceFilter}[deinterlaced]`;
      currentVideo = '[deinterlaced]';
    }

    // prepare input streams
    if (!isString(streamSrc) || isEmpty(streamSrc) || streamStats?.audioOnly) {
      doOverlay = false; //never show icon in the error screen
      // for error stream, we have to generate the input as well
      this.apad = false; //all of these generate audio correctly-aligned to video so there is no need for apad
      this.audioChannelsSampleRate = true; //we'll need these

      //all of the error strings already choose the resolution to
      //match iW x iH , so with this we save ourselves a second
      // scale filter
      iW = this.wantedW;
      iH = this.wantedH;

      if (!this.audioOnly) {
        ffmpegArgs.push('-r', '24');
        let pic: string | undefined;

        //does an image to play exist?
        if (isString(streamSrc) && streamStats?.audioOnly) {
          pic = streamStats.placeholderImage;
        } else if (!isString(streamSrc) && streamSrc.errorTitle == 'offline') {
          // TODO fix me
          const defaultOfflinePic = makeLocalUrl(
            '/images/generic-offline-screen.png',
          );
          pic = this.channel.offline?.picture ?? defaultOfflinePic;
        } else if (this.opts.errorScreen == 'pic') {
          pic = this.errorPicturePath;
        }

        if (!isNil(pic) && !isEmpty(pic)) {
          ffmpegArgs.push('-i', pic);
          //add 150 milliseconds just in case, exact duration seems to cut out the last bits of music some times.
          duration = duration.add(150);
          videoComplex = `;[${inputFiles++}:0]format=yuv420p[formatted]`;
          videoComplex += `;[formatted]scale=w=${iW}:h=${iH}:force_original_aspect_ratio=1[scaled]`;
          videoComplex += `;[scaled]pad=${iW}:${iH}:(ow-iw)/2:(oh-ih)/2[padded]`;
          videoComplex += `;[padded]loop=loop=-1:size=1:start=0[looped]`;
          videoComplex += `;[looped]realtime[videox]`;
          // this tune apparently makes the video compress better
          // when it is the same image
          // Don't enable this for NVENC...it seems to break with a strange
          // error. Unclear if this affects other HW encoders
          if (STILLIMAGE_SUPPORTED_ENCODERS.includes(this.opts.videoEncoder)) {
            useStillImageTune = true;
          }
        } else if (this.opts.errorScreen == 'static') {
          ffmpegArgs.push('-f', 'lavfi', '-i', `nullsrc=s=64x36`);
          videoComplex = `;geq=random(1)*255:128:128[videoz];[videoz]scale=${iW}:${iH}[videoy];[videoy]realtime[videox]`;
          inputFiles++;
        } else if (this.opts.errorScreen == 'testsrc') {
          ffmpegArgs.push('-f', 'lavfi', '-i', `testsrc=size=${iW}x${iH}`);
          videoComplex = `;realtime[videox]`;
          inputFiles++;
        } else if (this.opts.errorScreen == 'text' && !isString(streamSrc)) {
          const sz2 = Math.ceil(iH / 33.0);
          const sz1 = Math.ceil((sz2 * 3) / 2);
          const sz3 = 2 * sz2;

          ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
          inputFiles++;

          videoComplex = `;drawtext=fontfile=${
            serverOptions().databaseDirectory
          }/font.ttf:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${
            streamSrc.errorTitle
          }',drawtext=fontfile=${
            serverOptions().databaseDirectory
          }/font.ttf:fontsize=${sz2}:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+${sz3})/2:text='${
            streamSrc.subtitle
          }'[videoy];[videoy]realtime[videox]`;
        } else {
          //blank
          ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
          inputFiles++;
          videoComplex = `;realtime[videox]`;
        }
      }
      const durstr = `duration=${duration.asMilliseconds()}ms`;
      if (!isNonEmptyString(streamSrc)) {
        // silent
        audioComplex = `;aevalsrc=0:${durstr}:s=${
          this.opts.audioSampleRate * 1000
        },aresample=async=1:first_pts=0[audioy]`;
        if (streamSrc.errorTitle === 'offline') {
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
        audioComplex += ';[audioy]arealtime[audiox]';
        currentAudio = '[audiox]';
      }
      ffmpegArgs.push('-ac', `${this.opts.audioChannels}`);
      currentVideo = '[videox]';
    } else {
      // HACK: We know these will be defined already if we get this far
      iW = iW!;
      iH = iH!;
    }

    if (doOverlay && !isNil(watermark?.url)) {
      if (watermark.animated) {
        ffmpegArgs.push('-ignore_loop', '0');
      }
      ffmpegArgs.push('-loop', '1');
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
        (streamStats?.anamorphic ||
          iW !== this.wantedW ||
          iH !== this.wantedH)) ||
        isLargerResolution(iW, iH, this.wantedW, this.wantedH))
    ) {
      //scaler stuff, need to change the size of the video and also add bars
      // calculate wanted aspect ratio
      let p = iW * streamStats!.pixelP!;
      let q = iH * streamStats!.pixelQ!;
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
      videoComplex += `;${currentVideo}scale=${cw}:${ch}:flags=${algo},format=yuv420p[scaled]`;
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
        // also add black bars, because in this case it HAS to be this resolution
        videoComplex += `;[${currentVideo}]pad=${this.wantedW}:${this.wantedH}:(ow-iw)/2:(oh-ih)/2[blackpadded]`;
        currentVideo = 'blackpadded';
      }
      let name = 'siz';
      if (!this.ensureResolution && beforeSizeChange != '[fpchange]') {
        name = 'minsiz';
      }
      videoComplex += `;[${currentVideo}]setsar=1,format=yuv420p[${name}]`;
      currentVideo = `[${name}]`;
      iW = this.wantedW;
      iH = this.wantedH;
    }

    // Channel watermark:
    if (doOverlay && !isNil(watermark) && !this.audioOnly) {
      const pW = watermark.width;
      const w = Math.round((pW * iW) / 100.0);
      const mpHorz = watermark.horizontalMargin;
      const mpVert = watermark.verticalMargin;
      const horz = Math.round((mpHorz * iW) / 100.0);
      const vert = Math.round((mpVert * iH) / 100.0);

      // TODO: do not enable this if we are using fade points
      let waterVideo = `[${overlayFile}:v]`;
      const watermarkFilters: string[] = [];
      if (!watermark.fixedSize) {
        watermarkFilters.push(`scale=${w}:-1`);
      }

      if (isDefined(watermark.opacity) && watermark.opacity < 100) {
        watermarkFilters.push(
          `format=yuva420p,colorchannelmixer=aa=${round(
            watermark.opacity / 100,
            2,
          )}`,
        );
      } else if (
        !isEmpty(watermark?.fadeConfig) &&
        isDefined(streamStats?.duration)
      ) {
        watermarkFilters.push(`format=yuva420p`);
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

      const icnDur =
        watermark.duration > 0
          ? `:enable='between(t,0,${watermark.duration})'`
          : '';

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

      const overlayShortest = watermark.animated ? 'shortest=1:' : '';
      videoComplex += `;${currentVideo}${waterVideo}overlay=${overlayShortest}${position}${icnDur}[comb]`;
      currentVideo = '[comb]';
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
    if (currentVideo == '[minsiz]') {
      //do not change resolution if no other transcoding will be done
      // and resolution normalization is off
      currentVideo = beforeSizeChange;
    } else {
      this.logger.debug(resizeMsg);
    }
    if (this.audioOnly !== true) {
      if (currentVideo !== '[video]') {
        filterComplex += videoComplex;
      } else {
        currentVideo = `${videoFile}:${videoIndex}${
          isNonEmptyString(streamStats?.videoStreamIndex)
            ? ':' + streamStats.videoStreamIndex
            : ''
        }`;
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
      ffmpegArgs.push(`-filter_complex`, filterComplex.slice(1));
      if (this.alignAudio) {
        ffmpegArgs.push('-shortest');
      }
    }

    if (!this.audioOnly) {
      ffmpegArgs.push(
        '-map',
        currentVideo,
        `-c:v`,
        'rawvideo',
        `-sc_threshold`,
        `0`,
        '-video_track_timescale',
        '90000',
      );
      if (useStillImageTune) {
        ffmpegArgs.push('-tune', 'stillimage');
      }
    }

    ffmpegArgs.push(
      '-map',
      currentAudio,
      '-flags',
      'cgop+ilme',
      `-c:a`,
      'flac',
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

    ffmpegArgs.push(`-f`, 'nut', `pipe:1`);

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
      streamDuration ? dayjs().add(streamDuration).valueOf() : -1,
    );
  }
}

function isLargerResolution(w1: number, h1: number, w2: number, h2: number) {
  return w1 > w2 || h1 > h2 || w1 % 2 == 1 || h1 % 2 == 1;
}

function gcd(a: number, b: number) {
  while (b != 0) {
    const c = b;
    b = a % b;
    a = c;
  }
  return a;
}
