import child_process, { ChildProcessByStdio } from 'child_process';
import events from 'events';
import { isUndefined } from 'lodash-es';
import { DeepReadonly } from 'ts-essentials';
import { FfmpegSettings, ImmutableChannel } from './dao/db.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { Readable } from 'stream';

const spawn = child_process.spawn;

const logger = createLogger(import.meta);

const MAXIMUM_ERROR_DURATION_MS = 60000;
const REALLY_RIDICULOUSLY_HIGH_FPS_FOR_DIZQUETVS_USECASE = 120;

export class FFMPEG extends events.EventEmitter {
  private opts: DeepReadonly<FfmpegSettings>;
  private errorPicturePath: string;
  private ffmpegName: string;
  private channel: any;
  private ffmpegPath: string;

  private wantedW: number;
  private wantedH: number;
  private sentData: boolean = false;
  private apad: boolean;
  private audioChannelsSampleRate: any;
  private ensureResolution: any;
  private volumePercent: any;
  private hasBeenKilled: boolean = false;
  private audioOnly: boolean = false;
  private alignAudio: boolean;

  private ffmpeg: ChildProcessByStdio<null, Readable, null>;

  constructor(opts: DeepReadonly<FfmpegSettings>, channel: ImmutableChannel) {
    super();
    this.opts = opts;
    this.errorPicturePath = `http://localhost:${
      serverOptions().port
    }/images/generic-error-screen.png`;
    this.ffmpegName = 'unnamed ffmpeg';
    if (!this.opts.enableTranscoding) {
      //this ensures transcoding is completely disabled even if
      // some settings are true
      this.opts = {
        ...this.opts,
        normalizeAudio: false,
        normalizeAudioCodec: false,
        normalizeVideoCodec: false,
        errorScreen: 'kill',
        normalizeResolution: false,
        audioVolumePercent: 100,
        maxFPS: REALLY_RIDICULOUSLY_HIGH_FPS_FOR_DIZQUETVS_USECASE,
      };
    }
    this.channel = channel;
    this.ffmpegPath = opts.ffmpegExecutablePath;

    let targetResolution = opts.targetResolution;
    if (!isUndefined(channel.transcoding?.targetResolution)) {
      targetResolution = channel.transcoding!.targetResolution;
    }

    if (
      !isUndefined(channel.transcoding?.videoBitrate) &&
      channel.transcoding!.videoBitrate !== 0
    ) {
      this.opts = {
        ...this.opts,
        videoBitrate: channel.transcoding!.videoBitrate,
      };
    }

    if (
      !isUndefined(channel.transcoding?.videoBufferSize) &&
      channel.transcoding!.videoBufferSize !== 0
    ) {
      this.opts = {
        ...this.opts,
        videoBufferSize: channel.transcoding!.videoBufferSize,
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

  async spawnConcat(streamUrl: string) {
    return await this.spawn(
      streamUrl,
      undefined,
      undefined,
      undefined,
      true,
      false,
      undefined,
      true,
    );
  }

  async spawnStream(
    streamUrl: string,
    streamStats,
    startTime,
    duration,
    enableIcon,
    type,
  ) {
    return await this.spawn(
      streamUrl,
      streamStats,
      startTime,
      duration,
      true,
      enableIcon,
      type,
      false,
    );
  }
  async spawnError(title, subtitle?: any, duration?: any) {
    if (!this.opts.enableTranscoding || this.opts.errorScreen == 'kill') {
      console.error('error: ' + title + ' ; ' + subtitle);
      this.emit('error', {
        code: -1,
        cmd: `error stream disabled. ${title} ${subtitle}`,
      });
      return;
    }
    if (isUndefined(duration)) {
      //set a place-holder duration
      logger.info('No duration found for error stream, using placeholder');
      duration = MAXIMUM_ERROR_DURATION_MS;
    }
    duration = Math.min(MAXIMUM_ERROR_DURATION_MS, duration);
    let streamStats = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration: duration,
    };
    return await this.spawn(
      { errorTitle: title, subtitle: subtitle },
      streamStats,
      undefined,
      `${streamStats.duration}ms`,
      true,
      false,
      'error',
      false,
    );
  }
  async spawnOffline(duration) {
    if (!this.opts.enableTranscoding) {
      logger.info(
        'The channel has an offline period scheduled for this time slot. FFMPEG transcoding is disabled, so it is not possible to render an offline screen. Ending the stream instead',
      );
      this.emit('end', { code: -1, cmd: `offline stream disabled.` });
      return;
    }

    let streamStats = {
      videoWidth: this.wantedW,
      videoHeight: this.wantedH,
      duration: duration,
    };
    return await this.spawn(
      { errorTitle: 'offline' },
      streamStats,
      undefined,
      `${duration}ms`,
      true,
      false,
      'offline',
      false,
    );
  }

  async spawn(
    streamUrl,
    streamStats,
    startTime,
    duration,
    limitRead,
    watermark,
    _,
    isConcatPlaylist,
  ) {
    let ffmpegArgs: string[] = [
      `-threads`,
      isConcatPlaylist ? '1' : this.opts.numThreads.toString(),
      `-fflags`,
      `+genpts+discardcorrupt+igndts`,
    ];
    let stillImage = false;

    if (
      limitRead === true &&
      (this.audioOnly !== true || isUndefined(streamUrl.errorTitle))
    ) {
      ffmpegArgs.push(`-re`);
    }

    if (typeof startTime !== 'undefined') ffmpegArgs.push(`-ss`, startTime);

    if (isConcatPlaylist == true)
      ffmpegArgs.push(
        `-f`,
        `concat`,
        `-safe`,
        `0`,
        `-protocol_whitelist`,
        `file,http,tcp,https,tcp,tls`,
      );

    // Map correct audio index. '?' so doesn't fail if no stream available.
    let audioIndex = isUndefined(streamStats)
      ? 'a'
      : `${streamStats.audioIndex}`;

    //TODO: Do something about missing audio stream
    if (!isConcatPlaylist) {
      let inputFiles = 0;
      let audioFile = -1;
      let videoFile = -1;
      let overlayFile = -1;
      if (isUndefined(streamUrl.errorTitle)) {
        ffmpegArgs.push(`-i`, streamUrl);
        videoFile = inputFiles++;
        audioFile = videoFile;
      }

      // When we have an individual stream, there is a pipeline of possible
      // filters to apply.
      //
      var doOverlay = isUndefined(watermark) || watermark != null;
      var iW = streamStats.videoWidth;
      var iH = streamStats.videoHeight;

      // (explanation is the same for the video and audio streams)
      // The initial stream is called '[video]'
      var currentVideo = '[video]';
      var currentAudio = '[audio]';
      // Initially, videoComplex does nothing besides assigning the label
      // to the input stream
      var videoIndex = 'v';
      var audioComplex = `;[${audioFile}:${audioIndex}]anull[audio]`;
      var videoComplex = `;[${videoFile}:${videoIndex}]null[video]`;
      // Depending on the options we will apply multiple filters
      // each filter modifies the current video stream. Adds a filter to
      // the videoComplex variable. The result of the filter becomes the
      // new currentVideo value.
      //
      // When adding filters, make sure that
      // videoComplex always begins wiht ; and doesn't end with ;

      if (streamStats.videoFramerate >= this.opts.maxFPS + 0.000001) {
        videoComplex += `;${currentVideo}fps=${this.opts.maxFPS}[fpchange]`;
        currentVideo = '[fpchange]';
      }

      // deinterlace if desired
      if (
        streamStats.videoScanType == 'interlaced' &&
        this.opts.deinterlaceFilter != 'none'
      ) {
        videoComplex += `;${currentVideo}${this.opts.deinterlaceFilter}[deinterlaced]`;
        currentVideo = '[deinterlaced]';
      }

      // prepare input streams
      if (
        typeof streamUrl.errorTitle !== 'undefined' ||
        streamStats.audioOnly
      ) {
        doOverlay = false; //never show icon in the error screen
        // for error stream, we have to generate the input as well
        this.apad = false; //all of these generate audio correctly-aligned to video so there is no need for apad
        this.audioChannelsSampleRate = true; //we'll need these

        //all of the error strings already choose the resolution to
        //match iW x iH , so with this we save ourselves a second
        // scale filter
        iW = this.wantedW;
        iH = this.wantedH;

        if (this.audioOnly !== true) {
          ffmpegArgs.push('-r', '24');
          let pic: any;

          //does an image to play exist?
          if (isUndefined(streamUrl.errorTitle) && streamStats.audioOnly) {
            pic = streamStats.placeholderImage;
          } else if (streamUrl.errorTitle == 'offline') {
            pic = `${this.channel.offlinePicture}`;
          } else if (this.opts.errorScreen == 'pic') {
            pic = `${this.errorPicturePath}`;
          }

          if (pic != null) {
            ffmpegArgs.push('-i', pic);
            if (
              isUndefined(duration) &&
              typeof streamStats.duration !== 'undefined'
            ) {
              //add 150 milliseconds just in case, exact duration seems to cut out the last bits of music some times.
              duration = `${streamStats.duration + 150}ms`;
            }
            videoComplex = `;[${inputFiles++}:0]format=yuv420p[formatted]`;
            videoComplex += `;[formatted]scale=w=${iW}:h=${iH}:force_original_aspect_ratio=1[scaled]`;
            videoComplex += `;[scaled]pad=${iW}:${iH}:(ow-iw)/2:(oh-ih)/2[padded]`;
            videoComplex += `;[padded]loop=loop=-1:size=1:start=0[looped]`;
            videoComplex += `;[looped]realtime[videox]`;
            //this tune apparently makes the video compress better
            // when it is the same image
            stillImage = true;
          } else if (this.opts.errorScreen == 'static') {
            ffmpegArgs.push('-f', 'lavfi', '-i', `nullsrc=s=64x36`);
            videoComplex = `;geq=random(1)*255:128:128[videoz];[videoz]scale=${iW}:${iH}[videoy];[videoy]realtime[videox]`;
            inputFiles++;
          } else if (this.opts.errorScreen == 'testsrc') {
            ffmpegArgs.push('-f', 'lavfi', '-i', `testsrc=size=${iW}x${iH}`);
            videoComplex = `;realtime[videox]`;
            inputFiles++;
          } else if (this.opts.errorScreen == 'text') {
            var sz2 = Math.ceil(iH / 33.0);
            var sz1 = Math.ceil((sz2 * 3) / 2);
            var sz3 = 2 * sz2;

            ffmpegArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${iW}x${iH}`);
            inputFiles++;

            videoComplex = `;drawtext=fontfile=${
              serverOptions().database
            }/font.ttf:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${
              streamUrl.errorTitle
            }',drawtext=fontfile=${
              serverOptions().database
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
        let durstr = `duration=${streamStats.duration}ms`;
        if (typeof streamUrl.errorTitle !== 'undefined') {
          //silent
          audioComplex = `;aevalsrc=0:${durstr}[audioy]`;
          if (streamUrl.errorTitle == 'offline') {
            if (
              typeof this.channel.offlineSoundtrack !== 'undefined' &&
              this.channel.offlineSoundtrack != ''
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
      if (doOverlay) {
        if (watermark.animated === true) {
          ffmpegArgs.push('-ignore_loop', '0');
        }
        ffmpegArgs.push(`-i`, `${watermark.url}`);
        overlayFile = inputFiles++;
        this.ensureResolution = true;
      }

      // Resolution fix: Add scale filter, current stream becomes [siz]
      let beforeSizeChange = currentVideo;
      let algo = this.opts.scalingAlgorithm;
      let resizeMsg = '';
      if (
        !streamStats.audioOnly &&
        ((this.ensureResolution &&
          (streamStats.anamorphic ||
            iW != this.wantedW ||
            iH != this.wantedH)) ||
          isLargerResolution(iW, iH, this.wantedW, this.wantedH))
      ) {
        //scaler stuff, need to change the size of the video and also add bars
        // calculate wanted aspect ratio
        let p = iW * streamStats.pixelP;
        let q = iH * streamStats.pixelQ;
        let g = gcd(q, p); // and people kept telling me programming contests knowledge had no use real programming!
        p = Math.floor(p / g);
        q = Math.floor(q / g);
        let hypotheticalW1 = this.wantedW;
        let hypotheticalH1 = Math.floor((hypotheticalW1 * q) / p);
        let hypotheticalH2 = this.wantedH;
        let hypotheticalW2 = Math.floor((this.wantedH * p) / q);
        let cw, ch;
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
          let xw = cw + (cw % 2);
          let xh = ch + (ch % 2);
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
      if (doOverlay && this.audioOnly !== true) {
        var pW = watermark.width;
        var w = Math.round((pW * iW) / 100.0);
        var mpHorz = watermark.horizontalMargin;
        var mpVert = watermark.verticalMargin;
        var horz = Math.round((mpHorz * iW) / 100.0);
        var vert = Math.round((mpVert * iH) / 100.0);

        let posAry = {
          'top-left': `x=${horz}:y=${vert}`,
          'top-right': `x=W-w-${horz}:y=${vert}`,
          'bottom-left': `x=${horz}:y=H-h-${vert}`,
          'bottom-right': `x=W-w-${horz}:y=H-h-${vert}`,
        };
        let icnDur = '';
        if (watermark.duration > 0) {
          icnDur = `:enable='between(t,0,${watermark.duration})'`;
        }
        let waterVideo = `[${overlayFile}:v]`;
        if (!watermark.fixedSize) {
          videoComplex += `;${waterVideo}scale=${w}:-1[icn]`;
          waterVideo = '[icn]';
        }
        let p = posAry[watermark.position];
        if (isUndefined(p)) {
          throw Error('Invalid watermark position: ' + watermark.position);
        }
        let overlayShortest = '';
        if (watermark.animated) {
          overlayShortest = 'shortest=1:';
        }
        videoComplex += `;${currentVideo}${waterVideo}overlay=${overlayShortest}${p}${icnDur}[comb]`;
        currentVideo = '[comb]';
      }

      if (this.volumePercent != 100) {
        var f = this.volumePercent / 100.0;
        audioComplex += `;${currentAudio}volume=${f}[boosted]`;
        currentAudio = '[boosted]';
      }
      // Align audio is just the apad filter applied to audio stream
      if (this.apad && this.audioOnly !== true) {
        //it doesn't make much sense to pad audio when there is no video
        audioComplex += `;${currentAudio}apad=whole_dur=${streamStats.duration}ms[padded]`;
        currentAudio = '[padded]';
      } else if (this.audioChannelsSampleRate) {
        //TODO: Do not set this to true if audio channels and sample rate are already good
        transcodeAudio = true;
      }

      // If no filters have been applied, then the stream will still be
      // [video] , in that case, we do not actually add the video stuff to
      // filter_complex and this allows us to avoid transcoding.
      var transcodeVideo =
        this.opts.normalizeVideoCodec &&
        isDifferentVideoCodec(streamStats.videoCodec, this.opts.videoEncoder);
      var transcodeAudio =
        this.opts.normalizeAudioCodec &&
        isDifferentAudioCodec(streamStats.audioCodec, this.opts.audioEncoder);
      var filterComplex = '';
      if (!transcodeVideo && currentVideo == '[minsiz]') {
        //do not change resolution if no other transcoding will be done
        // and resolution normalization is off
        currentVideo = beforeSizeChange;
      } else {
        logger.info(resizeMsg);
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
        if (stillImage) {
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
          `${this.opts.videoBufferSize}k`,
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
    } else {
      //Concat stream is simpler and should always copy the codec
      ffmpegArgs.push(`-probesize`, '32' /*`100000000`*/, `-i`, streamUrl);
      if (this.audioOnly !== true) {
        ffmpegArgs.push(`-map`, `0:v`);
      }
      ffmpegArgs.push(
        `-map`,
        `0:${audioIndex}`,
        `-c`,
        `copy`,
        `-muxdelay`,
        this.opts.concatMuxDelay,
        `-muxpreload`,
        this.opts.concatMuxDelay,
      );
    }

    ffmpegArgs.push(
      `-metadata`,
      `service_provider="dizqueTV"`,
      `-metadata`,
      `service_name="${this.channel.name}"`,
    );

    //t should be before -f
    if (typeof duration !== 'undefined') {
      ffmpegArgs.push(`-t`, `${duration}`);
    }

    ffmpegArgs.push(`-f`, `mpegts`, `pipe:1`);

    let doLogs = this.opts.enableLogging && !isConcatPlaylist;
    if (this.hasBeenKilled) {
      return;
    }
    this.ffmpeg = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', doLogs ? process.stderr : 'ignore'],
    });
    if (this.hasBeenKilled) {
      logger.info('Send SIGKILL to ffmpeg');
      this.ffmpeg.kill('SIGKILL');
      return;
    }

    this.ffmpegName = isConcatPlaylist ? 'Concat FFMPEG' : 'Stream FFMPEG';

    this.ffmpeg.on('error', (code, signal) => {
      logger.info(
        `${this.ffmpegName} received error event: ${code}, ${signal}`,
      );
    });
    this.ffmpeg.on('exit', (code, signal) => {
      if (code === null) {
        if (!this.hasBeenKilled) {
          logger.info(`${this.ffmpegName} exited due to signal: ${signal}`);
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
    logger.info(`${this.ffmpegName} RECEIVED kill() command`);
    this.hasBeenKilled = true;
    if (typeof this.ffmpeg != 'undefined') {
      logger.info(`${this.ffmpegName} this.ffmpeg.kill()`);
      this.ffmpeg.kill('SIGKILL');
    }
  }
}

function isDifferentVideoCodec(codec, encoder) {
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

function isDifferentAudioCodec(codec, encoder) {
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

function gcd(a, b) {
  while (b != 0) {
    let c = b;
    b = a % b;
    a = c;
  }
  return a;
}
