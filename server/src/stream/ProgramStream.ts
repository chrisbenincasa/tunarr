import { Watermark } from '@tunarr/types';
import dayjs from 'dayjs';
import { isUndefined } from 'lodash-es';
import { PassThrough } from 'stream';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { FFMPEG } from '../ffmpeg/ffmpeg.js';
import { Maybe } from '../types/util.js';
import { isDefined, isNonEmptyString } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../util/serverUtil.js';
import { PlayerContext } from './PlayerStreamContext.js';

/**
 * Base class implementing the functionality of managing an output stream
 * for a given program. This clasas is essentially a lineup item + transcode session
 */
export abstract class ProgramStream implements ProgramStream {
  protected logger = LoggerFactory.child({ className: this.constructor.name });
  private _transcodeSession: FfmpegTranscodeSession;

  constructor(
    public context: PlayerContext,
    protected settingsDB: SettingsDB = getSettings(),
  ) {}

  async setup(): Promise<FfmpegTranscodeSession> {
    if (this.isInitialized()) {
      return this._transcodeSession;
    }

    this.transcodeSession = await this.setupInternal();
    return this.transcodeSession;
  }

  isInitialized(): boolean {
    return isDefined(this._transcodeSession);
  }

  async start(sink: PassThrough) {
    if (!this.isInitialized()) {
      await this.setup();
    }

    this._transcodeSession.on('error', () => {
      this.tryReplaceWithErrorStream(sink).catch(() => {});
    });

    return this._transcodeSession.start(sink);
  }

  shutdown(): void {
    if (this.isInitialized()) {
      this.transcodeSession.kill();
    }
    this.shutdownInternal();
  }

  protected shutdownInternal(): void {}

  protected abstract setupInternal(): Promise<FfmpegTranscodeSession>;

  get transcodeSession() {
    return this._transcodeSession;
  }

  set transcodeSession(session: FfmpegTranscodeSession) {
    this._transcodeSession = session;
    this._transcodeSession.on('close', () => this.shutdown());
    this._transcodeSession.on('end', () => this.shutdown());
    this._transcodeSession.on('error', () => this.shutdown());
  }

  private async tryReplaceWithErrorStream(sink: PassThrough) {
    try {
      const errorSession = await this.getErrorStream(this.context);

      if (isUndefined(errorSession)) {
        sink.push(null);
        return;
      }

      errorSession.start(sink);
      this.transcodeSession = errorSession;

      this.transcodeSession.on('end', () => {
        sink.push(null);
      });
    } catch (e) {
      this.logger.error(e, 'Error while trying to spawn error stream! YIKES');
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
      duration.asMilliseconds(),
    );
  }

  protected getWatermark(): Maybe<Watermark> {
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
      if (isNonEmptyString(watermark.url)) {
        icon = watermark.url;
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
