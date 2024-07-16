import { FfmpegSettings, Watermark } from '@tunarr/types';
import child_process, { ChildProcessByStdio } from 'child_process';
import events from 'events';
import { isEmpty, isNil, isString, isUndefined, merge, round } from 'lodash-es';
import path from 'path';
import { DeepReadonly, DeepRequired } from 'ts-essentials';
import { serverOptions } from '../globals.js';
import { StreamDetails } from '../stream/plex/PlexTranscoder.js';
import { StreamContextChannel } from '../stream/types.js';
import { Maybe } from '../types/util.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import stream from 'stream';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { isDefined, isNonEmptyString } from '../util/index.js';
import { makeLocalUrl } from '../util/serverUtil.js';
import {
  SupportedHardwareAccels,
  SupportedVideoFormats,
} from '@tunarr/types/schemas';

const spawn = child_process.spawn;

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
  enableHls: boolean;
  enableDash: boolean;
  numThreads: number;
  hlsOptions?: Partial<HlsOptions>;
  dashOptions?: Partial<DashOptions>;
  logOutput: boolean;
};

const defaultConcatOptions: DeepRequired<ConcatOptions> = {
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

export class FFMPEG extends (events.EventEmitter as new () => TypedEventEmitter<FfmpegEvents>) {
  private logger: Logger;
  private opts: DeepReadonly<FfmpegSettings>;
  private errorPicturePath: string;
  private ffmpegName: string;
  private channel: StreamContextChannel;
  private ffmpegPath: string;

  private wantedW: number;
  private wantedH: number;
  private sentData: boolean = false;
  private apad: boolean;
  private audioChannelsSampleRate: boolean; // ? what
  private ensureResolution: boolean;
  private volumePercent: number;
  private hasBeenKilled: boolean = false;
  private audioOnly: boolean = false;
  private alignAudio: boolean;

  private ffmpeg: ChildProcessByStdio<null, stream.Readable, stream.Readable>;

  constructor(
    opts: DeepReadonly<FfmpegSettings>,
    channel: StreamContextChannel,
  ) {
    super();
    this.logger = LoggerFactory.child({
      caller: import.meta,
      channel: channel.uuid,
    });
    this.opts = opts;
    this.errorPicturePath = makeLocalUrl('/images/generic-error-screen.png');
    this.ffmpegName = 'unnamed ffmpeg';
    this.channel = channel;
    this.ffmpegPath = opts.ffmpegExecutablePath;

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

  spawnConcat(
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
      '-re', // Research this https://stackoverflow.com/a/48479202
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
      const hlsOpts = merge(defaultConcatOptions, opts).hlsOptions;

      ffmpegArgs.push(
        '-f',
        'hls',
        '-hls_time',
        hlsOpts.hlsTime.toString(),
        '-hls_list_size',
        hlsOpts.hlsListSize.toString(),
        '-force_key_frames',
        // Force a key frame every N seconds
        // TODO consider using the GOP parameter here as stated in the docs
        `expr:gte(t,n_forced*${hlsOpts.hlsTime})`,
        '-hls_delete_threshold',
        '3', // Num unreferenced segments
        '-hls_flags',
        'independent_segments',
        '-hls_flags',
        'split_by_time',
        '-hls_segment_type',
        'mpegts',
        '-hls_flags',
        'delete_segments',
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

    return this.startProcess(ffmpegArgs, this.opts.enableLogging);
  }

  spawnStream(
    streamUrl: string,
    streamStats: Maybe<StreamDetails>,
    startTime: Maybe<number>,
    duration: Maybe<string>,
    enableIcon: Maybe<Watermark>,
  ) {
    return this.spawn(
      streamUrl,
      streamStats,
      startTime,
      duration,
      true,
      enableIcon,
    );
  }

  spawnError(title: string, subtitle?: string, duration?: number) {
    if (this.opts.errorScreen === 'kill') {
      this.logger.error('error: ' + title + ' ; ' + subtitle);
      this.emit('error', {
        code: -1,
        cmd: `error stream disabled. ${title} ${subtitle}`,
      });
      return;
    }
    if (isUndefined(duration)) {
      //set a place-holder duration
      this.logger.warn('No duration found for error stream, using placeholder');
      duration = MAXIMUM_ERROR_DURATION_MS;
    }
    duration = Math.min(MAXIMUM_ERROR_DURATION_MS, duration);
    const streamStats: StreamDetails = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration: duration,
    };
    return this.spawn(
      { errorTitle: title, subtitle: subtitle },
      streamStats,
      undefined,
      `${streamStats.duration}ms`,
      true,
      /*watermark=*/ undefined,
    );
  }

  spawnOffline(duration: number) {
    const streamStats = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration: duration,
    };

    return this.spawn(
      { errorTitle: 'offline' },
      streamStats,
      undefined,
      `${duration}ms`,
      true,
      undefined,
    );
  }

  spawn(
    streamUrl: string | { errorTitle: string; subtitle?: string },
    streamStats: Maybe<StreamDetails>,
    startTime: Maybe<number>,
    duration: Maybe<string>,
    limitRead: boolean,
    watermark: Maybe<Watermark>,
  ) {
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

    if (limitRead && (!this.audioOnly || isNonEmptyString(streamUrl))) {
      ffmpegArgs.push(`-re`);
    }

    if (!isUndefined(startTime)) {
      ffmpegArgs.push(`-ss`, startTime.toString());
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
    if (isNonEmptyString(streamUrl)) {
      ffmpegArgs.push(`-i`, streamUrl);
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
    if (!isString(streamUrl) || isEmpty(streamUrl) || streamStats?.audioOnly) {
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
        if (isString(streamUrl) && streamStats?.audioOnly) {
          pic = streamStats.placeholderImage;
        } else if (!isString(streamUrl) && streamUrl.errorTitle == 'offline') {
          // TODO fix me
          const defaultOfflinePic = makeLocalUrl(
            '/images/generic-offline-screen.png',
          );
          pic = this.channel.offlinePicture ?? defaultOfflinePic;
        } else if (this.opts.errorScreen == 'pic') {
          pic = this.errorPicturePath;
        }

        if (!isNil(pic) && !isEmpty(pic)) {
          ffmpegArgs.push('-i', pic);
          if (isUndefined(duration) && !isUndefined(streamStats?.duration)) {
            //add 150 milliseconds just in case, exact duration seems to cut out the last bits of music some times.
            duration = `${streamStats.duration + 150}ms`;
          }
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
        } else if (this.opts.errorScreen == 'text' && !isString(streamUrl)) {
          const sz2 = Math.ceil(iH / 33.0);
          const sz1 = Math.ceil((sz2 * 3) / 2);
          const sz3 = 2 * sz2;

          ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
          inputFiles++;

          videoComplex = `;drawtext=fontfile=${
            serverOptions().databaseDirectory
          }/font.ttf:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${
            streamUrl.errorTitle
          }',drawtext=fontfile=${
            serverOptions().databaseDirectory
          }/font.ttf:fontsize=${sz2}:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+${sz3})/2:text='${
            streamUrl.subtitle
          }'[videoy];[videoy]realtime[videox]`;
        } else {
          //blank
          ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
          inputFiles++;
          videoComplex = `;realtime[videox]`;
        }
      }
      const durstr = `duration=${streamStats?.duration}ms`;
      if (!isNonEmptyString(streamUrl)) {
        // silent
        audioComplex = `;aevalsrc=0:${durstr}:s=48000,aresample=async=1:first_pts=0[audioy]`;
        if (streamUrl.errorTitle === 'offline') {
          if (
            !isUndefined(this.channel.offlineSoundtrack) &&
            !isEmpty(this.channel.offlineSoundtrack)
          ) {
            ffmpegArgs.push('-i', `${this.channel.offlineSoundtrack}`);
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

      const icnDur =
        watermark.duration > 0
          ? `:enable='between(t,0,${watermark.duration})'`
          : '';
      let waterVideo = `[${overlayFile}:v]`;
      const watermarkFilters: string[] = [];
      if (!watermark.fixedSize) {
        watermarkFilters.push(`scale=${w}:-1`);
      }

      if (isDefined(watermark.opacity) && watermark.opacity < 100) {
        watermarkFilters.push(
          `format=argb,colorchannelmixer=aa=${round(
            watermark.opacity / 100,
            2,
          )}`,
        );
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
        `apad=whole_dur=${streamStats?.duration}ms`,
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
      'pcm_s16le',
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      `-muxdelay`,
      `0`,
      `-muxpreload`,
      `0`,
    );

    ffmpegArgs.push(
      `-metadata`,
      `service_provider="tunarr"`,
      `-metadata`,
      `service_name="${this.channel.name}"`,
    );

    //t should be before -f
    if (!isUndefined(duration)) {
      ffmpegArgs.push(`-t`, `${duration}`);
    }

    ffmpegArgs.push(`-f`, 'nut', `pipe:1`);

    const doLogs = this.opts.enableLogging;
    if (this.hasBeenKilled) {
      this.logger.info('ffmpeg preemptively killed');
      return;
    }

    const argsWithTokenRedacted = ffmpegArgs
      .join(' ')
      .replaceAll(/(.*X-Plex-Token=)([A-z0-9_\\-]+)(.*)/g, '$1REDACTED$3');
    this.logger.debug(`Starting ffmpeg with args: "%s"`, argsWithTokenRedacted);

    this.ffmpeg = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Pipe to our own stderr if enabled
    if (doLogs) {
      this.ffmpeg.stderr.pipe(process.stderr);
    }

    // Hide this behind a 'flag' for now...
    // if (process.env.DEBUG_FFMPEG) {
    //   const ffmpegLogger = createFfmpegProcessLogger(
    //     `${this.channel.uuid}_${this.ffmpegName}`,
    //   );
    //   this.ffmpeg.stderr.on('end', () => ffmpegthis.Logger.close());
    //   this.ffmpeg.stderr.pipe(
    //     new Writable({
    //       write(chunk, _, callback) {
    //         if (chunk instanceof Buffer) {
    //           ffmpegthis.Logger.info(chunk.toString());
    //         }
    //         callback();
    //       },
    //     }),
    //   );
    // }

    if (this.hasBeenKilled) {
      this.logger.info('Send SIGKILL to ffmpeg');
      this.ffmpeg.kill('SIGKILL');
      return;
    }

    this.ffmpegName = 'Stream FFMPEG';

    this.ffmpeg.on('error', (code, signal) => {
      this.logger.debug(
        `${this.ffmpegName} received error event: ${code}, ${signal}`,
      );
    });

    this.ffmpeg.on('exit', (code: number, signal) => {
      if (code === null) {
        if (!this.hasBeenKilled) {
          this.logger.warn(
            `${this.ffmpegName} exited due to signal: ${signal}`,
            {
              cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
            },
          );
        } else {
          this.logger.debug(
            `${this.ffmpegName} exited due to signal: ${signal} as expected.`,
          );
        }
        this.emit('close', code);
      } else if (code === 0) {
        this.logger.debug(`${this.ffmpegName} exited normally.`);
        this.emit('end');
      } else if (code === 255) {
        if (this.hasBeenKilled) {
          this.logger.debug(`${this.ffmpegName} finished with code 255.`);
          this.emit('close', code);
          return;
        }
        if (!this.sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
          });
        }
        this.logger.warn(`${this.ffmpegName} exited with code 255.`);
        this.emit('close', code);
      } else {
        this.logger.error(`${this.ffmpegName} exited with code ${code}.`);
        this.emit('error', {
          code: code,
          cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
        });
      }
    });

    return this.ffmpeg.stdout;
  }

  private startProcess(ffmpegArgs: string[], enableLogging: boolean) {
    this.logger.debug(
      'Starting ffmpeg concat process with args: ' + ffmpegArgs.join(' '),
    );

    // const test = createWriteStream('./test.log', { flags: 'a' });
    this.ffmpeg = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Pipe to our own stderr if enabled
    if (enableLogging) {
      this.ffmpeg.stderr.pipe(process.stderr);
    }

    // Hide this behind a 'flag' for now...
    // if (process.env.DEBUG_FFMPEG) {
    //   const ffmpegLogger = createFfmpegProcessLogger(
    //     `${this.channel.uuid}_${this.ffmpegName}`,
    //   );
    //   this.ffmpeg.stderr.on('end', () => ffmpegthis.Logger.close());
    //   this.ffmpeg.stderr.pipe(
    //     new Writable({
    //       write(chunk, _, callback) {
    //         if (chunk instanceof Buffer) {
    //           ffmpegthis.Logger.info(chunk.toString());
    //         }
    //         callback();
    //       },
    //     }),
    //   );
    // }

    if (this.hasBeenKilled) {
      this.logger.trace('Sending SIGKILL to ffmpeg');
      this.ffmpeg.kill('SIGKILL');
      return;
    }

    // this.ffmpegName = isConcatPlaylist ? 'Concat FFMPEG' : 'Stream FFMPEG';

    this.ffmpeg.on('error', (code, signal) => {
      this.logger.error(
        `${this.ffmpegName} received error event: ${code}, ${signal}`,
      );
    });

    this.ffmpeg.on('exit', (code: number, signal) => {
      if (code === null) {
        if (!this.hasBeenKilled) {
          this.logger.info(
            `${this.ffmpegName} exited due to signal: ${signal}`,
            {
              cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
            },
          );
        } else {
          this.logger.info(
            `${this.ffmpegName} exited due to signal: ${signal} as expected.`,
          );
        }
        this.emit('close', code);
      } else if (code === 0) {
        this.logger.info(`${this.ffmpegName} exited normally.`);
        this.emit('end');
      } else if (code === 255) {
        if (this.hasBeenKilled) {
          this.logger.info(`${this.ffmpegName} finished with code 255.`);
          this.emit('close', code);
          return;
        }
        if (!this.sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
          });
        }
        this.logger.info(`${this.ffmpegName} exited with code 255.`);
        this.emit('close', code);
      } else {
        this.logger.info(`${this.ffmpegName} exited with code ${code}.`);
        this.emit('error', {
          code: code,
          cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
        });
      }
    });

    return this.ffmpeg.stdout;
  }

  kill() {
    this.logger.debug(`${this.ffmpegName} RECEIVED kill() command`);
    this.hasBeenKilled = true;
    if (!isUndefined(this.ffmpeg)) {
      // TODO - maybe send SIGTERM here and give it some time before
      // dropping the hammer.
      this.ffmpeg.kill('SIGKILL');
    }
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
