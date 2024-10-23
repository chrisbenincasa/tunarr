import { Watermark } from '@tunarr/types';
import dayjs from 'dayjs';
import events from 'events';
import { isUndefined } from 'lodash-es';
import { PassThrough } from 'stream';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { OutputFormat } from '../ffmpeg/OutputFormat.js';
import { FFMPEG, StreamOptions } from '../ffmpeg/ffmpeg.js';
import { serverContext } from '../serverContext.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Result } from '../types/result.js';
import { Maybe } from '../types/util.js';
import {
  attempt,
  isDefined,
  isNonEmptyString,
  isSuccess,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../util/serverUtil.js';
import { PlayerContext } from './PlayerStreamContext.js';

type ProgramStreamEvents = {
  // Emitted when the stream has reached a fatal error point
  // This means that both the program and error stream have failed to play.
  error: () => void;
};

/**
 * Base class implementing the functionality of managing an output stream
 * for a given program. This class is essentially a lineup item + transcode session
 */
export abstract class ProgramStream extends (events.EventEmitter as new () => TypedEventEmitter<ProgramStreamEvents>) {
  protected logger = LoggerFactory.child({ className: this.constructor.name });
  private outStream: PassThrough;
  private hadError: boolean = false;
  private _transcodeSession: FfmpegTranscodeSession;

  constructor(
    public context: PlayerContext,
    protected outputFormat: OutputFormat,
    protected settingsDB: SettingsDB = getSettings(),
  ) {
    super();
  }

  async setup(
    opts?: Partial<StreamOptions>,
  ): Promise<Result<FfmpegTranscodeSession>> {
    if (this.isInitialized()) {
      return Result.success(this._transcodeSession);
    }

    const result = await this.setupInternal(opts);

    result.forEach((value) => {
      this.transcodeSession = value;
    });

    return result;
  }

  isInitialized(): boolean {
    return isDefined(this._transcodeSession);
  }

  async start(sink?: PassThrough) {
    if (!this.isInitialized()) {
      await this.setup();
    }

    return (this.outStream = this._transcodeSession.start(sink));
  }

  shutdown(): void {
    if (this.isInitialized()) {
      this.transcodeSession.kill();
    }
    this.shutdownInternal();
  }

  protected shutdownInternal(): void {}

  protected abstract setupInternal(
    opts?: Partial<StreamOptions>,
  ): Promise<Result<FfmpegTranscodeSession>>;

  get transcodeSession() {
    return this._transcodeSession;
  }

  set transcodeSession(session: FfmpegTranscodeSession) {
    this._transcodeSession = session;
    this._transcodeSession.on('end', () => this.shutdown());
    this._transcodeSession.on('error', () => {
      if (this.hadError) {
        // We're streaming the error and something went wrong with that..
        // time to just bail.
        this.shutdown();
        this.emit('error');
      } else {
        this.hadError = true;
        const failedStream = this._transcodeSession;
        failedStream.kill();
        this.tryReplaceWithErrorStream(this.outStream).catch((e) => {
          this.logger.error(e, 'Error while setting up ');
        });
      }
    });
  }

  private async tryReplaceWithErrorStream(sink?: PassThrough) {
    const out = sink ?? new PassThrough();
    try {
      const errorSession = await this.getErrorStream(this.context);

      if (isUndefined(errorSession)) {
        out.push(null);
        return;
      }

      errorSession.start(out);
      this.transcodeSession = errorSession;

      this.transcodeSession.on('end', () => {
        out.push(null);
      });
    } catch (e) {
      this.logger.error(e, 'Error while trying to spawn error stream! YIKES');
      throw e;
    }
  }

  private getErrorStream(context: PlayerContext) {
    const ffmpeg = new FFMPEG(
      this.settingsDB.ffmpegSettings(),
      context.channel,
      context.audioOnly,
    );

    const duration = dayjs.duration(
      dayjs(this.transcodeSession.streamEndTime).diff(),
    );

    return ffmpeg.createErrorSession(
      'Playback Error',
      'Check server logs for details',
      duration,
      this.outputFormat,
    );
  }

  protected async getWatermark(): Promise<Maybe<Watermark>> {
    const channel = this.context.channel;

    if (this.settingsDB.ffmpegSettings().disableChannelOverlay) {
      return;
    }

    if (
      this.context.lineupItem.type === 'commercial' &&
      this.context.channel.disableFillerOverlay
    ) {
      return;
    }

    if (channel.watermark?.enabled) {
      const watermark = { ...channel.watermark };
      let icon: string;
      // Capture this so it can't change asynchronously.
      const watermarkUrl = watermark.url;
      if (isNonEmptyString(watermarkUrl) && URL.canParse(watermarkUrl)) {
        const parsed = new URL(watermarkUrl);
        if (parsed.host.includes('localhost')) {
          icon = watermarkUrl;
        } else {
          const cachedWatermarkUrl = await attempt(() =>
            serverContext().cacheImageService.getOrDownloadImageUrl(
              watermarkUrl,
            ),
          );

          if (
            isSuccess(cachedWatermarkUrl) &&
            isNonEmptyString(cachedWatermarkUrl?.path)
          ) {
            icon = cachedWatermarkUrl.path;
          } else {
            icon = makeLocalUrl('/images/tunarr.png');
          }
        }
      } else if (isNonEmptyString(channel.icon?.path)) {
        icon = channel.icon.path;
      } else {
        icon = makeLocalUrl('/images/tunarr.png');
      }

      return {
        ...watermark,
        enabled: true,
        url: icon,
      };
    }

    return;
  }
}
