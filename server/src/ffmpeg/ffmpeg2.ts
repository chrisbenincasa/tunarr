import { FfmpegSettings, Watermark } from '@tunarr/types';
import child_process, { ChildProcessByStdio } from 'child_process';
import events from 'events';
import { isEmpty, isNil, isString, isUndefined, merge, round } from 'lodash-es';
import path from 'path';
import { DeepReadonly, DeepRequired } from 'ts-essentials';
import { serverOptions } from '../globals.js';
import createLogger, { createFfmpegProcessLogger } from '../logger.js';
import { VideoStreamDetails } from '../stream/plex/plexTranscoder.js';
import { StreamContextChannel } from '../stream/types.js';
import { Maybe } from '../types/util.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import stream, { Writable } from 'stream';

const spawn = child_process.spawn;

const logger = createLogger(import.meta);

const MAXIMUM_ERROR_DURATION_MS = 60000;
const REALLY_RIDICULOUSLY_HIGH_FPS_FOR_TUNARRS_USECASE = 120;

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

type ConcatOptions = {
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

export class FFMPEG extends (events.EventEmitter as new () => TypedEventEmitter<FfmpegEvents>) {
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
    this.opts = opts;
    this.errorPicturePath = `http://localhost:${
      serverOptions().port
    }/images/generic-error-screen.png`;
    this.ffmpegName = 'unnamed ffmpeg';
    if (!this.opts.enableTranscoding) {
      // this ensures transcoding is completely disabled even if
      // some settings are true
      this.opts = {
        ...this.opts,
        normalizeAudio: false,
        normalizeAudioCodec: false,
        normalizeVideoCodec: false,
        errorScreen: 'kill',
        normalizeResolution: false,
        audioVolumePercent: 100,
        maxFPS: REALLY_RIDICULOUSLY_HIGH_FPS_FOR_TUNARRS_USECASE,
      };
    }
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

    if (!this.audioOnly) {
      ffmpegArgs.push(`-map`, `0:v`);
    }

    ffmpegArgs.push(
      `-map`,
      `0:a`,
      // We need to re-encode the streams for DASH
      ...(opts.enableDash
        ? ['-c:v', this.opts.videoEncoder, '-c:a', this.opts.audioEncoder]
        : [`-c`]),
      `copy`,
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
      ffmpegArgs.push(`-f`, `mpegts`, `pipe:1`);
    }

    return this.startProcess(ffmpegArgs, opts.logOutput ?? false);
  }

  spawnStream(
    streamUrl: string,
    streamStats: Maybe<VideoStreamDetails>,
    startTime: Maybe<number>,
    duration: Maybe<string>,
    enableIcon: Maybe<Watermark>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _: string, //LineupItem[type]
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
    if (!this.opts.enableTranscoding || this.opts.errorScreen == 'kill') {
      logger.error('error: ' + title + ' ; ' + subtitle);
      this.emit('error', {
        code: -1,
        cmd: `error stream disabled. ${title} ${subtitle}`,
      });
      return;
    }
    if (isUndefined(duration)) {
      //set a place-holder duration
      logger.warn('No duration found for error stream, using placeholder');
      duration = MAXIMUM_ERROR_DURATION_MS;
    }
    duration = Math.min(MAXIMUM_ERROR_DURATION_MS, duration);
    const streamStats: VideoStreamDetails = {
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
    if (!this.opts.enableTranscoding) {
      logger.info(
        'The channel has an offline period scheduled for this time slot. FFMPEG transcoding is disabled, so it is not possible to render an offline screen. Ending the stream instead',
      );
      this.emit('end', { code: -1, cmd: `offline stream disabled.` });
      return;
    }

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
    streamStats: Maybe<VideoStreamDetails>,
    startTime: Maybe<number>,
    duration: Maybe<string>,
    limitRead: boolean,
    watermark: Maybe<Watermark>,
  ) {
    const ffmpegArgs: string[] = [
      `-threads`,
      this.opts.numThreads.toString(),
      `-fflags`,
      `+genpts+discardcorrupt+igndts`,
    ];
    let useStillImageTune = false;

    if (
      limitRead === true &&
      (this.audioOnly !== true || isString(streamUrl))
    ) {
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
    if (isString(streamUrl) && !isEmpty(streamUrl)) {
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
          const defaultOfflinePic = `http://localhost:${
            serverOptions().port
          }/images/generic-offline-screen.png`;
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
      if (!isString(streamUrl)) {
        // silent
        audioComplex = `;aevalsrc=0:${durstr}[audioy]`;
        if (streamUrl.errorTitle == 'offline') {
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
          this.opts.errorAudio == 'whitenoise' ||
          (!(this.opts.errorAudio == 'sine') && this.audioOnly === true) //when it's in audio-only mode, silent stream is confusing for errors.
        ) {
          audioComplex = `;aevalsrc=random(0):${durstr}[audioy]`;
          this.volumePercent = Math.min(70, this.volumePercent);
        } else if (this.opts.errorAudio == 'sine') {
          audioComplex = `;sine=f=440:${durstr}[audioy]`;
          this.volumePercent = Math.min(70, this.volumePercent);
        }
        if (this.audioOnly !== true) {
          ffmpegArgs.push('-pix_fmt', 'yuv420p');
        }
        audioComplex += ';[audioy]arealtime[audiox]';
        currentAudio = '[audiox]';
      }
      currentVideo = '[videox]';
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
          iW != this.wantedW ||
          iH != this.wantedH)) ||
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
      videoComplex += `;${currentVideo}scale=${cw}:${ch}:flags=${algo}[scaled]`;
      currentVideo = 'scaled';
      resizeMsg = `Stretch to ${cw} x ${ch}. To fit target resolution of ${this.wantedW} x ${this.wantedH}.`;
      if (this.ensureResolution) {
        logger.info(
          `First stretch to ${cw} x ${ch}. Then add padding to make it ${this.wantedW} x ${this.wantedH} `,
        );
      } else if (cw % 2 == 1 || ch % 2 == 1) {
        //we need to add padding so that the video dimensions are even
        const xw = cw + (cw % 2);
        const xh = ch + (ch % 2);
        resizeMsg = `Stretch to ${cw} x ${ch}. To fit target resolution of ${this.wantedW} x ${this.wantedH}. Then add 1 pixel of padding so that dimensions are not odd numbers, because they are frowned upon. The final resolution will be ${xw} x ${xh}`;
        this.wantedW = xw;
        this.wantedH = xh;
      } else {
        resizeMsg = `Stretch to ${cw} x ${ch}. To fit target resolution of ${this.wantedW} x ${this.wantedH}.`;
      }
      if (this.wantedW != cw || this.wantedH != ch) {
        // also add black bars, because in this case it HAS to be this resolution
        videoComplex += `;[${currentVideo}]pad=${this.wantedW}:${this.wantedH}:(ow-iw)/2:(oh-ih)/2[blackpadded]`;
        currentVideo = 'blackpadded';
      }
      let name = 'siz';
      if (!this.ensureResolution && beforeSizeChange != '[fpchange]') {
        name = 'minsiz';
      }
      videoComplex += `;[${currentVideo}]setsar=1[${name}]`;
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
      if (!watermark.fixedSize) {
        videoComplex += `;${waterVideo}scale=${w}:-1[icn]`;
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

    let transcodeAudio = false;

    // Align audio is just the apad filter applied to audio stream
    if (this.apad && this.audioOnly !== true) {
      //it doesn't make much sense to pad audio when there is no video
      audioComplex += `;${currentAudio}apad=whole_dur=${streamStats?.duration}ms[padded]`;
      currentAudio = '[padded]';
    } else if (this.audioChannelsSampleRate) {
      //TODO: Do not set this to true if audio channels and sample rate are already good
      transcodeAudio = true;
    }

    // If no filters have been applied, then the stream will still be
    // [video] , in that case, we do not actually add the video stuff to
    // filter_complex and this allows us to avoid transcoding.
    let transcodeVideo =
      this.opts.normalizeVideoCodec &&
      isDifferentVideoCodec(streamStats?.videoCodec, this.opts.videoEncoder);
    transcodeAudio =
      this.opts.normalizeAudioCodec &&
      isDifferentAudioCodec(streamStats?.audioCodec, this.opts.audioEncoder);
    let filterComplex = '';
    if (!transcodeVideo && currentVideo == '[minsiz]') {
      //do not change resolution if no other transcoding will be done
      // and resolution normalization is off
      currentVideo = beforeSizeChange;
    } else {
      logger.debug(resizeMsg);
    }
    if (this.audioOnly !== true) {
      if (currentVideo != '[video]') {
        transcodeVideo = true; //this is useful so that it adds some lines below
        filterComplex += videoComplex;
      } else {
        currentVideo = `${videoFile}:${videoIndex}`;
      }
    }
    // same with audio:
    if (currentAudio != '[audio]') {
      transcodeAudio = true;
      filterComplex += audioComplex;
    } else {
      currentAudio = `${audioFile}:${audioIndex}`;
    }

    //If there is a filter complex, add it.
    if (filterComplex != '') {
      ffmpegArgs.push(`-filter_complex`, filterComplex.slice(1));
      if (this.alignAudio) {
        ffmpegArgs.push('-shortest');
      }
    }
    if (this.audioOnly !== true) {
      ffmpegArgs.push(
        '-map',
        currentVideo,
        `-c:v`,
        transcodeVideo ? this.opts.videoEncoder : 'copy',
        `-sc_threshold`,
        `1000000000`,
      );
      if (useStillImageTune) {
        ffmpegArgs.push('-tune', 'stillimage');
      }
    }
    ffmpegArgs.push('-map', currentAudio, `-flags`, `cgop+ilme`);
    if (transcodeVideo && this.audioOnly !== true) {
      // add the video encoder flags
      ffmpegArgs.push(
        `-b:v`,
        `${this.opts.videoBitrate}k`,
        `-maxrate:v`,
        `${this.opts.videoBitrate}k`,
        `-bufsize:v`,
        `${this.opts.videoBufferSize}k`,
      );
    }
    if (transcodeAudio) {
      // add the audio encoder flags
      ffmpegArgs.push(
        `-b:a`,
        `${this.opts.audioBitrate}k`,
        `-maxrate:a`,
        `${this.opts.audioBitrate}k`,
        `-bufsize:a`,
        `${this.opts.audioBufferSize}k`,
      );
      if (this.audioChannelsSampleRate) {
        ffmpegArgs.push(
          `-ac`,
          `${this.opts.audioChannels}`,
          `-ar`,
          `${this.opts.audioSampleRate}k`,
        );
      }
    }
    if (transcodeAudio && transcodeVideo) {
      logger.info('Video and Audio are being transcoded by ffmpeg');
    } else if (transcodeVideo) {
      logger.info(
        'Video is being transcoded by ffmpeg. Audio is being copied.',
      );
    } else if (transcodeAudio) {
      logger.info(
        'Audio is being transcoded by ffmpeg. Video is being copied.',
      );
    } else {
      logger.info(
        'Video and Audio are being copied. ffmpeg is not transcoding.',
      );
    }
    ffmpegArgs.push(
      `-c:a`,
      transcodeAudio ? this.opts.audioEncoder : 'copy',
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

    ffmpegArgs.push(`-f`, `mpegts`, `pipe:1`);

    const doLogs = this.opts.enableLogging;
    if (this.hasBeenKilled) {
      logger.info('ffmpeg preemptively killed');
      return;
    }

    logger.debug(`Starting ffmpeg with args: "${ffmpegArgs.join(' ')}"`);

    this.ffmpeg = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Pipe to our own stderr if enabled
    if (doLogs) {
      this.ffmpeg.stderr.pipe(process.stderr);
    }

    // Hide this behind a 'flag' for now...
    if (process.env.DEBUG_FFMPEG) {
      const ffmpegLogger = createFfmpegProcessLogger(
        `${this.channel.uuid}_${this.ffmpegName}`,
      );
      this.ffmpeg.stderr.on('end', () => ffmpegLogger.close());
      this.ffmpeg.stderr.pipe(
        new Writable({
          write(chunk, _, callback) {
            if (chunk instanceof Buffer) {
              ffmpegLogger.info(chunk.toString());
            }
            callback();
          },
        }),
      );
    }

    if (this.hasBeenKilled) {
      logger.info('Send SIGKILL to ffmpeg');
      this.ffmpeg.kill('SIGKILL');
      return;
    }

    this.ffmpegName = 'Stream FFMPEG';

    this.ffmpeg.on('error', (code, signal) => {
      logger.debug(
        `${this.ffmpegName} received error event: ${code}, ${signal}`,
      );
    });

    this.ffmpeg.on('exit', (code: number, signal) => {
      if (code === null) {
        if (!this.hasBeenKilled) {
          logger.warn(`${this.ffmpegName} exited due to signal: ${signal}`, {
            cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
          });
        } else {
          logger.debug(
            `${this.ffmpegName} exited due to signal: ${signal} as expected.`,
          );
        }
        this.emit('close', code);
      } else if (code === 0) {
        logger.debug(`${this.ffmpegName} exited normally.`);
        this.emit('end');
      } else if (code === 255) {
        if (this.hasBeenKilled) {
          logger.debug(`${this.ffmpegName} finished with code 255.`);
          this.emit('close', code);
          return;
        }
        if (!this.sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
          });
        }
        logger.warn(`${this.ffmpegName} exited with code 255.`);
        this.emit('close', code);
      } else {
        logger.error(`${this.ffmpegName} exited with code ${code}.`);
        this.emit('error', {
          code: code,
          cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
        });
      }
    });

    return this.ffmpeg.stdout;
  }

  private startProcess(ffmpegArgs: string[], enableLogging: boolean) {
    logger.debug(
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
    if (process.env.DEBUG_FFMPEG) {
      const ffmpegLogger = createFfmpegProcessLogger(
        `${this.channel.uuid}_${this.ffmpegName}`,
      );
      this.ffmpeg.stderr.on('end', () => ffmpegLogger.close());
      this.ffmpeg.stderr.pipe(
        new Writable({
          write(chunk, _, callback) {
            if (chunk instanceof Buffer) {
              ffmpegLogger.info(chunk.toString());
            }
            callback();
          },
        }),
      );
    }

    if (this.hasBeenKilled) {
      logger.silly('Sending SIGKILL to ffmpeg');
      this.ffmpeg.kill('SIGKILL');
      return;
    }

    // this.ffmpegName = isConcatPlaylist ? 'Concat FFMPEG' : 'Stream FFMPEG';

    this.ffmpeg.on('error', (code, signal) => {
      logger.error(
        `${this.ffmpegName} received error event: ${code}, ${signal}`,
      );
    });

    this.ffmpeg.on('exit', (code: number, signal) => {
      if (code === null) {
        if (!this.hasBeenKilled) {
          logger.info(`${this.ffmpegName} exited due to signal: ${signal}`, {
            cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
          });
        } else {
          logger.info(
            `${this.ffmpegName} exited due to signal: ${signal} as expected.`,
          );
        }
        this.emit('close', code);
      } else if (code === 0) {
        logger.info(`${this.ffmpegName} exited normally.`);
        this.emit('end');
      } else if (code === 255) {
        if (this.hasBeenKilled) {
          logger.info(`${this.ffmpegName} finished with code 255.`);
          this.emit('close', code);
          return;
        }
        if (!this.sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
          });
        }
        logger.info(`${this.ffmpegName} exited with code 255.`);
        this.emit('close', code);
      } else {
        logger.info(`${this.ffmpegName} exited with code ${code}.`);
        this.emit('error', {
          code: code,
          cmd: `${this.opts.ffmpegExecutablePath} ${ffmpegArgs.join(' ')}`,
        });
      }
    });

    return this.ffmpeg.stdout;
  }

  kill() {
    logger.debug(`${this.ffmpegName} RECEIVED kill() command`);
    this.hasBeenKilled = true;
    if (!isUndefined(this.ffmpeg)) {
      // TODO - maybe send SIGTERM here and give it some time before
      // dropping the hammer.
      this.ffmpeg.kill('SIGKILL');
    }
  }
}

function isDifferentVideoCodec(codec: Maybe<string>, encoder: string) {
  if (codec == 'mpeg2video') {
    return !encoder.includes('mpeg2');
  } else if (codec == 'h264') {
    return !encoder.includes('264');
  } else if (codec == 'hevc') {
    return !(encoder.includes('265') || encoder.includes('hevc'));
  }
  // if the encoder/codec combinations are unknown, always encode, just in case
  return true;
}

function isDifferentAudioCodec(codec: Maybe<string>, encoder: string) {
  if (codec == 'mp3') {
    return !(encoder.includes('mp3') || encoder.includes('lame'));
  } else if (codec == 'aac') {
    return !encoder.includes('aac');
  } else if (codec == 'ac3') {
    return !encoder.includes('ac3');
  } else if (codec == 'flac') {
    return !encoder.includes('flac');
  }
  // if the encoder/codec combinations are unknown, always encode, just in case
  return true;
}

function isLargerResolution(w1, h1, w2, h2) {
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
